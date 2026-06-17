import { randomUUID } from 'crypto';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  startOfDay,
  endOfDay,
  startOfISOWeek,
  endOfISOWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from 'date-fns';
import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { sql } from '../db/index';
import { PushNotificationService } from '../push/push-notification.service';
import { WebPushService } from '../push/web-push.service';
import { SocketGateway } from '../socket/socket.gateway';
import { getCanonicalMerchantId } from '../lib/shop-utils';
import { normalizeIp } from '../lib/request-ip';
import { haversineDistanceM } from '../lib/geo';
import type {
  CreateOrderDto,
  UpdateOrderStatusDto,
  PatchOrderDto,
  MergeTablesDto,
  SplitTableDto,
  MergeBillsDto,
  SplitBillItemsDto,
  CreateLoyaltyRewardDto,
  PatchLoyaltyRewardDto,
  RedeemLoyaltyDto,
  PatchLoyaltySettingsDto,
  AdjustLoyaltyPointsDto,
} from './orders.dto';
import { VALID_TRANSITIONS, isValidTransition } from './orders.dto';
import { normalizeVnCustomerPhone } from '../lib/phone-utils';
import {
  clampLoyaltyVndPerPoint,
  formatEarnRuleLabel,
  formatEarnRuleLabelShort,
} from '../lib/loyalty-earn';

type OrderRow = {
  id: number;
  merchant_id: string;
  status: string;
  table_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_price: number;
  type: string;
  created_at: Date;
  client_ip?: string | null;
  client_lat?: number | null;
  client_lng?: number | null;
  bill_group_id?: string | null;
  merged_from_table_number?: string | null;
};

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

function padTableNumber(num: string): string {
  if (!num) return 'Mang về';
  if (num === 'Mang về') return num;

  // Extract number from "Bàn 2", "Table 2", "02", etc.
  const cleaned = num
    .toString()
    .toLowerCase()
    .replace('bàn', '')
    .replace('table', '')
    .replace('#', '')
    .trim();

  if (isNaN(Number(cleaned))) return num;
  return cleaned.padStart(2, '0');
}

@Injectable()
export class OrdersService {
  constructor(
    private push: PushNotificationService,
    private webPush: WebPushService,
    private socketGateway: SocketGateway,
  ) {}

  async createOrder(
    data: CreateOrderDto,
    meta: { clientIp: string } = { clientIp: '' },
  ): Promise<OrderRow> {
    const merchantId = await getCanonicalMerchantId(data.merchantId);
    const [mrow] = (await sql`
      SELECT COALESCE(table_count, 99)::int AS tc,
        latitude AS latitude,
        longitude AS longitude,
        geo_fence_radius_m AS geo_fence_radius_m,
        COALESCE(require_customer_location, false) AS require_customer_location
      FROM merchants WHERE id = ${merchantId}
    `) as unknown as {
      tc: number;
      latitude: number | null;
      longitude: number | null;
      geo_fence_radius_m: number | null;
      require_customer_location: boolean;
    }[];
    const requestedTableNumber = padTableNumber(data.tableNumber ?? 'Mang về');
    let tableNumber = requestedTableNumber;
    if (requestedTableNumber !== 'Mang về') {
      const [linked] = (await sql`
        SELECT parent_table_number FROM table_sessions
        WHERE merchant_id = ${merchantId}
          AND table_number = ${requestedTableNumber}
          AND status = 'active'
        LIMIT 1
      `) as unknown as { parent_table_number: string | null }[];
      if (linked?.parent_table_number) {
        tableNumber = padTableNumber(linked.parent_table_number);
      }
    }
    const customerName = data.customerName ?? 'Khách';
    const isCounterOrder = tableNumber === 'Mang về';
    const orderType = String(data.type ?? 'order');
    const isLoyaltyPayRequest = orderType === 'loyalty_pay_request';
    const isServiceRequest =
      orderType === 'call_staff' ||
      orderType === 'call_payment' ||
      isLoyaltyPayRequest;
    const fromPos = (data as any).fromPos === true;
    const clientIpNorm = normalizeIp(meta.clientIp || '');

    if (!fromPos && clientIpNorm) {
      const [blocked] = (await sql`
        SELECT 1 AS x FROM merchant_blocked_ips
        WHERE merchant_id = ${merchantId} AND ip = ${clientIpNorm}
        LIMIT 1
      `) as unknown as { x: number }[];
      if (blocked) {
        throw new ForbiddenException(
          'Không thể đặt món từ mạng này. Liên hệ quán nếu cần hỗ trợ.',
        );
      }
    }

    if (!fromPos && mrow?.require_customer_location === true) {
      const mLat = mrow.latitude;
      const mLng = mrow.longitude;
      if (mLat == null || mLng == null) {
        throw new BadRequestException(
          'Quán chưa cấu hình vị trí trên bản đồ. Vui lòng báo chủ quán bật vị trí trong cài đặt.',
        );
      }
      const cLat = data.customerLat;
      const cLng = data.customerLng;
      if (cLat == null || cLng == null) {
        throw new BadRequestException(
          'Quán yêu cầu bật định vị để đặt món. Vui lòng cho phép truy cập vị trí trên trình duyệt.',
        );
      }
      const radiusM = mrow.geo_fence_radius_m ?? 150;
      const dist = haversineDistanceM(mLat, mLng, cLat, cLng);
      if (dist > radiusM) {
        throw new BadRequestException(
          `Bạn đang ngoài phạm vi quán (>${radiusM}m). Hãy tới quán và thử lại.`,
        );
      }
    }

    if (
      !isCounterOrder &&
      !isServiceRequest &&
      !isNaN(Number(tableNumber)) &&
      mrow?.tc
    ) {
      const n = parseInt(tableNumber, 10);
      if (!Number.isNaN(n) && n > mrow.tc) {
        throw new BadRequestException(
          `Bàn không hợp lệ (quán có tối đa ${mrow.tc} bàn).`,
        );
      }
    }

    // Only check session for table orders (not counter orders or service requests)
    if (!isCounterOrder && !isServiceRequest) {
      // Check if there's an active session for this table
      const [session] = (await sql`
        SELECT status FROM table_sessions
        WHERE merchant_id = ${merchantId}
          AND table_number = ${tableNumber}
          AND status = 'active'
        LIMIT 1
      `) as unknown as { status: string }[];

      if (!session) {
        // No active session — check if table was already paid/completed
        const [lastSession] = (await sql`
          SELECT status FROM table_sessions
          WHERE merchant_id = ${merchantId}
            AND table_number = ${tableNumber}
          ORDER BY created_at DESC
          LIMIT 1
        `) as unknown as { status: string }[];

        // POS orders: always create a new session if none active (even after a completed/paid one)
        if (fromPos) {
          await sql`
            INSERT INTO table_sessions (id, merchant_id, table_number, status)
            VALUES (${randomUUID()}, ${merchantId}, ${tableNumber}, 'active')
          `;
        } else {
          // Customer orders: reject if session was completed/paid
          if (
            lastSession &&
            (lastSession.status === 'completed' ||
              lastSession.status === 'paid')
          ) {
            throw new BadRequestException(
              'Phiên đặt món đã kết thúc. Vui lòng quét lại mã QR tại bàn để tiếp tục.',
            );
          }
          // Otherwise (no session ever existed), create a new active one
          await sql`
            INSERT INTO table_sessions (id, merchant_id, table_number, status)
            VALUES (${randomUUID()}, ${merchantId}, ${tableNumber}, 'active')
          `;
        }
      }
    }

    const hasItems = data.items && data.items.length > 0;

    const clip = clientIpNorm || null;
    const cLatIns =
      data.customerLat != null && Number.isFinite(data.customerLat)
        ? data.customerLat
        : null;
    const cLngIns =
      data.customerLng != null && Number.isFinite(data.customerLng)
        ? data.customerLng
        : null;
    const accIns =
      data.locationAccuracyM != null && Number.isFinite(data.locationAccuracyM)
        ? data.locationAccuracyM
        : null;

    const [existingBill] = (await sql`
      SELECT bill_group_id FROM orders
      WHERE merchant_id = ${merchantId}
        AND table_number = ${tableNumber}
        AND status NOT IN ('paid', 'cancelled')
      ORDER BY created_at DESC
      LIMIT 1
    `) as unknown as { bill_group_id: string | null }[];
    const billGroupId = existingBill?.bill_group_id || randomUUID();

    const [order] = (await sql`
      INSERT INTO orders
        (merchant_id, table_number, session_id, customer_name, customer_phone, total_price, status, type,
         client_ip, client_lat, client_lng, client_location_accuracy_m, bill_group_id, merged_from_table_number)
      VALUES (
        ${merchantId}, ${tableNumber}, ${data.sessionId ?? null},
        ${customerName}, ${data.customerPhone ?? null}, ${data.totalPrice}, 'pending', ${orderType},
        ${clip}, ${cLatIns}, ${cLngIns}, ${accIns}, ${billGroupId}, ${
          requestedTableNumber !== tableNumber ? requestedTableNumber : null
        }
      )
      RETURNING id, merchant_id, status, table_number,
               customer_name, customer_phone, total_price, type, created_at,
              client_ip, client_lat, client_lng, bill_group_id
    `) as unknown as OrderRow[];

    // Only insert order items for actual product orders (not service requests)
    if (!isServiceRequest && hasItems) {
      for (const item of data.items) {
        const productId = item.productId ?? '1';
        const orderNote = (data as any).notes ?? (data as any).note ?? '';
        const itemNote = (item as any).note ?? (item as any).notes ?? '';
        const mergedNote =
          orderNote && itemNote
            ? `${itemNote} | Ghi chú đơn: ${orderNote}`
            : itemNote || orderNote || null;
        await sql`
          INSERT INTO order_items (order_id, product_id, quantity, price, note)
          VALUES (${order.id}, ${Number(productId)}, ${item.quantity}, ${item.price}, ${mergedNote})
        `;
      }

      const totalItems = data.items.reduce((sum, i) => sum + i.quantity, 0);
      this.push.notifyShop(merchantId, {
        title: '🆕 Đơn hàng mới',
        body: `Bàn ${tableNumber} — ${totalItems} món — ${formatVND(data.totalPrice)}`,
        data: {
          orderId: String(order.id),
          tableNumber,
          totalAmount: String(data.totalPrice),
          type: 'new_order',
        },
        type: 'new_order',
      });
      this.socketGateway.emitShopNotification(merchantId, 'newOrder', {
        id: order.id,
        merchantId: order.merchant_id,
        status: order.status,
        tableNumber: order.table_number,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        totalPrice: String(order.total_price),
        type: order.type,
        createdAt: order.created_at,
        billGroupId: order.bill_group_id ?? billGroupId,
      });
      void this.webPush.notifyNewOrder(merchantId, {
        orderId: order.id,
        tableNumber,
        totalAmount: data.totalPrice ?? order.total_price,
        totalItems: data.items.reduce((sum, i) => sum + i.quantity, 0),
        status: order.status,
      });
    } else if (isServiceRequest) {
      let title: string;
      let body: string;
      let pushType:
        | 'call_staff'
        | 'call_payment'
        | 'loyalty_pay';
      let socketEvent: string;
      const socketPayload: {
        tableNumber: string;
        loyaltyPaymentMethod?: 'at_table' | 'bank_qr';
        paymentPreference?: 'at_table' | 'bank_qr';
      } = { tableNumber };

      if (orderType === 'call_staff') {
        title = '📋 Gọi nhân viên';
        body = `Bàn ${tableNumber}`;
        pushType = 'call_staff';
        socketEvent = 'callStaff';
      } else if (orderType === 'call_payment') {
        const pref = data.paymentPreference;
        title = '💳 Yêu cầu thanh toán';
        if (pref === 'at_table') {
          body = `Bàn ${tableNumber} — Thu ngân tại bàn`;
        } else if (pref === 'bank_qr') {
          body = `Bàn ${tableNumber} — QR ngân hàng`;
        } else {
          body = `Bàn ${tableNumber}`;
        }
        pushType = 'call_payment';
        socketEvent = 'callPayment';
        if (pref === 'at_table' || pref === 'bank_qr') {
          socketPayload.paymentPreference = pref;
        }
      } else {
        const method = data.loyaltyPaymentMethod!;
        const methodVi =
          method === 'at_table' ? 'Thu ngân tại bàn' : 'QR ngân hàng';
        title = '⭐ Thanh toán tích điểm';
        body = `Bàn ${tableNumber} — ${methodVi}`;
        pushType = 'loyalty_pay';
        socketEvent = 'loyaltyPayRequest';
        socketPayload.loyaltyPaymentMethod = method;
      }

      const pushData: Record<string, string> = {
        orderId: String(order.id),
        tableNumber: String(tableNumber),
        type: orderType,
      };
      if (isLoyaltyPayRequest && data.loyaltyPaymentMethod) {
        pushData.loyaltyPaymentMethod = String(data.loyaltyPaymentMethod);
      }
      if (orderType === 'call_payment' && data.paymentPreference) {
        pushData.paymentPreference = String(data.paymentPreference);
      }

      this.push.notifyShop(merchantId, {
        title,
        body,
        data: pushData,
        type: pushType,
      });
      this.socketGateway.emitShopNotification(
        merchantId,
        socketEvent,
        socketPayload,
      );
    }

    return order;
  }

  async getMerchantOrders(
    incomingMerchantId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    orders: OrderRow[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const offset = (page - 1) * limit;

    // Get total count
    const [countResult] = (await sql`
      SELECT COUNT(*) as total FROM orders WHERE merchant_id = ${merchantId}
    `) as unknown as { total: number }[];

    const orders = (await sql`
      SELECT o.id, o.merchant_id, o.status, o.table_number,
             o.customer_name, o.customer_phone, o.total_price, o.type, o.created_at,
             o.client_ip, o.client_lat, o.client_lng,
             o.merged_from_table_number,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'productId', oi.product_id,
                   'quantity', oi.quantity,
                   'price', oi.price,
                   'note', oi.note,
                   'notes', oi.note,
                   'product', json_build_object(
                     'id', p.id,
                     'name', p.name
                   )
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.merchant_id = ${merchantId}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `) as unknown as OrderRow[];

    const total = Number(countResult?.total ?? 0);
    const totalPages = Math.ceil(total / limit);

    return { orders, total, page, totalPages };
  }

  async getOrder(id: number): Promise<OrderRow> {
    if (isNaN(id)) throw new NotFoundException('Invalid order ID format');
    const [order] = (await sql`
      SELECT id, merchant_id, status, table_number,
             customer_name, customer_phone, total_price, type, created_at
      FROM orders WHERE id = ${id}
    `) as unknown as OrderRow[];
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(
    incomingMerchantId: string,
    id: number,
    data: UpdateOrderStatusDto,
  ): Promise<OrderRow> {
    if (isNaN(id)) throw new NotFoundException('Invalid order ID format');
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);

    // Validate current status allows this transition
    const [currentOrder] = (await sql`
      SELECT id, status, merchant_id FROM orders WHERE id = ${id} AND merchant_id = ${merchantId}
    `) as unknown as OrderRow[];
    if (!currentOrder) throw new NotFoundException('Order not found');

    if (!isValidTransition(currentOrder.status, data.status)) {
      throw new BadRequestException(
        `Không thể chuyển từ trạng thái '${currentOrder.status}' sang '${data.status}'. ` +
          `Các trạng thái hợp lệ: ${VALID_TRANSITIONS[currentOrder.status]?.join(', ') || 'không có'}`,
      );
    }

    const pm = data.paymentMethod ?? null;
    const [updated] = (await sql`
      UPDATE orders SET
        status = ${data.status},
        payment_method = COALESCE(${pm}, payment_method)
      WHERE id = ${id} AND merchant_id = ${merchantId}
      RETURNING id, merchant_id, status, table_number,
                customer_name, customer_phone, total_price, type, created_at
    `) as unknown as OrderRow[];
    if (!updated) throw new NotFoundException('Order not found');

    // Broadcast real-time status update to all devices in this merchant's room
    const payload = {
      id: updated.id,
      merchantId: updated.merchant_id,
      status: updated.status,
      tableNumber: updated.table_number,
      customerName: updated.customer_name,
      customerPhone: updated.customer_phone,
      totalPrice: String(updated.total_price),
      type: updated.type,
      createdAt: updated.created_at,
    };
    // Broadcast using both canonical merchantId and the incoming one (Shop UUID / slug)
    this.socketGateway.emitShopNotification(
      merchantId,
      'orderStatusUpdated',
      payload,
    );
    if (incomingMerchantId !== merchantId) {
      this.socketGateway.emitShopNotification(
        incomingMerchantId,
        'orderStatusUpdated',
        payload,
      );
    }

    if (updated.status === 'ready') {
      const readyPayload = {
        orderId: updated.id,
        tableNumber: updated.table_number,
      };
      this.socketGateway.emitShopNotification(
        merchantId,
        'readyToServe',
        readyPayload,
      );
      if (incomingMerchantId !== merchantId) {
        this.socketGateway.emitShopNotification(
          incomingMerchantId,
          'readyToServe',
          readyPayload,
        );
      }
    }

    if (updated.status === 'paid') {
      await this.applyLoyaltyForOrder(updated.id, merchantId);
    }

    const [cnt] = (await sql`
      SELECT COALESCE(SUM(quantity), 0)::int AS c FROM order_items WHERE order_id = ${id}
    `) as unknown as { c: number }[];
    const totalItems = Number(cnt?.c ?? 0);
    void this.webPush.notifyOrderStatus(merchantId, {
      orderId: updated.id,
      tableNumber: updated.table_number,
      totalAmount: updated.total_price,
      totalItems: totalItems || 1,
      status: updated.status,
    });

    return updated;
  }

  /** PATCH body — same as status update; default paymentMethod cash when marking paid */
  async patchOrder(
    incomingMerchantId: string,
    id: number,
    data: PatchOrderDto,
  ): Promise<OrderRow> {
    const paymentMethod =
      data.status === 'paid'
        ? (data.paymentMethod ?? 'cash')
        : data.paymentMethod;
    return this.updateStatus(incomingMerchantId, id, {
      status: data.status,
      paymentMethod,
    });
  }

  private async fetchMerchantLoyaltyVndPerPoint(merchantId: string): Promise<number> {
    const [row] = (await sql`
      SELECT loyalty_vnd_per_point AS v
      FROM merchants
      WHERE id = ${merchantId}
      LIMIT 1
    `) as unknown as { v: number | string | null }[];
    return clampLoyaltyVndPerPoint(Number(row?.v ?? 1000));
  }

  private async assertProductBelongsToMerchant(
    merchantId: string,
    productId: number,
  ): Promise<void> {
    const [row] = (await sql`
      SELECT 1 AS x FROM products
      WHERE id = ${productId} AND merchant_id = ${merchantId}
      LIMIT 1
    `) as unknown as { x: number }[];
    if (!row) {
      throw new BadRequestException('Món không thuộc quán hoặc không tồn tại');
    }
  }

  private async applyLoyaltyForOrder(orderId: number, merchantId: string) {
    const [order] = (await sql`
      SELECT id, customer_phone, customer_name, total_price
      FROM orders
      WHERE id = ${orderId} AND merchant_id = ${merchantId}
      LIMIT 1
    `) as unknown as {
      id: number;
      customer_phone: string | null;
      customer_name: string | null;
      total_price: string | number;
    }[];
    if (!order?.customer_phone) return;
    const phone =
      normalizeVnCustomerPhone(order.customer_phone) ??
      String(order.customer_phone).replace(/\D/g, '');
    if (!phone) return;

    const [dup] = (await sql`
      SELECT 1 AS x
      FROM loyalty_transactions
      WHERE merchant_id = ${merchantId}
        AND order_id = ${orderId}
        AND reason = 'order_paid'
      LIMIT 1
    `) as unknown as { x: number }[];
    if (dup) return;

    const total = Number(order.total_price || 0);
    const vndPerPoint = await this.fetchMerchantLoyaltyVndPerPoint(merchantId);
    const earned = Math.max(0, Math.floor(total / vndPerPoint));
    if (earned <= 0) return;
    const earnNote = `+${earned} điểm — thanh toán đơn #${orderId}`;
    await sql`
      INSERT INTO loyalty_accounts (merchant_id, customer_phone, customer_name, points)
      VALUES (${merchantId}, ${phone}, ${order.customer_name}, ${earned})
      ON CONFLICT (merchant_id, customer_phone)
      DO UPDATE SET
        points = loyalty_accounts.points + EXCLUDED.points,
        customer_name = COALESCE(EXCLUDED.customer_name, loyalty_accounts.customer_name),
        updated_at = NOW()
    `;
    await sql`
      INSERT INTO loyalty_transactions (merchant_id, order_id, customer_phone, delta_points, reason, note)
      VALUES (${merchantId}, ${orderId}, ${phone}, ${earned}, 'order_paid', ${earnNote})
    `;
  }

  async getActiveOrders(incomingMerchantId: string): Promise<OrderRow[]> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);

    return (await sql`
      SELECT o.id, o.merchant_id, o.status, o.table_number,
             o.customer_name, o.customer_phone, o.total_price, o.type, o.created_at,
             o.client_ip, o.client_lat, o.client_lng,
             o.merged_from_table_number,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'productId', oi.product_id,
                   'quantity', oi.quantity,
                   'price', oi.price,
                   'note', oi.note,
                   'notes', oi.note,
                   'product', json_build_object(
                     'id', p.id,
                     'name', p.name
                   )
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.merchant_id = ${merchantId}
        AND o.status NOT IN ('completed', 'cancelled', 'paid')
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `) as unknown as OrderRow[];
  }

  async getActiveOrdersForTable(
    incomingMerchantId: string,
    tableNumber: string,
  ): Promise<OrderRow[]> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const paddedTableNumber = padTableNumber(tableNumber);
    const altTableNumber = !isNaN(Number(paddedTableNumber))
      ? `Bàn ${parseInt(paddedTableNumber)}`
      : paddedTableNumber;

    return (await sql`
      SELECT o.id, o.merchant_id as "merchantId", o.status, o.table_number as "tableNumber",
             o.customer_name as "customerName", o.customer_phone as "customerPhone", 
             o.total_price as "totalPrice", o.type, o.created_at as "createdAt",
             o.merged_from_table_number as "mergedFromTableNumber",
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'productId', oi.product_id,
                   'quantity', oi.quantity,
                   'price', oi.price,
                   'note', oi.note,
                   'notes', oi.note,
                   'product', json_build_object(
                     'id', p.id,
                     'name', p.name
                   )
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.merchant_id = ${merchantId}
        AND (o.table_number = ${paddedTableNumber} OR o.table_number = ${altTableNumber} OR o.table_number = ${tableNumber.replace(/^0+/, '')})
        AND o.status NOT IN ('cancelled', 'paid')
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `) as unknown as OrderRow[];
  }

  async payAllTableOrders(
    incomingMerchantId: string,
    tableNumber: string,
  ): Promise<OrderRow[]> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const paddedTableNumber = padTableNumber(tableNumber);
    const altTableNumber = !isNaN(Number(paddedTableNumber))
      ? `Bàn ${parseInt(paddedTableNumber)}`
      : paddedTableNumber;

    // Mark all active orders as paid
    const orders = (await sql`
      UPDATE orders SET status = 'paid'
      WHERE merchant_id = ${merchantId}
        AND (table_number = ${paddedTableNumber} OR table_number = ${altTableNumber})
        AND status NOT IN ('paid', 'cancelled')
      RETURNING id, merchant_id, status, table_number,
                customer_name, customer_phone, total_price, type, created_at
    `) as unknown as OrderRow[];

    // Mark the table session as completed so customers can't order anymore
    await sql`
      UPDATE table_sessions
      SET status = 'completed', completed_at = NOW()
      WHERE merchant_id = ${merchantId}
        AND (table_number = ${paddedTableNumber} OR table_number = ${altTableNumber})
        AND status = 'active'
    `;

    return orders;
  }

  async getRevenueReport(
    incomingMerchantId: string,
    period: 'today' | 'week' | 'month',
  ): Promise<{
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    items: { date: string; revenue: number; orders: number }[];
  }> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const [mr] = (await sql`
      SELECT COALESCE(timezone, 'Asia/Ho_Chi_Minh') AS tz FROM merchants WHERE id = ${merchantId}
    `) as unknown as { tz: string }[];
    const tz = mr?.tz || 'Asia/Ho_Chi_Minh';

    const nowZ = toZonedTime(new Date(), tz);
    let startWall: Date;
    let endWall: Date;
    if (period === 'today') {
      startWall = startOfDay(nowZ);
      endWall = endOfDay(nowZ);
    } else if (period === 'week') {
      startWall = startOfISOWeek(nowZ);
      endWall = endOfISOWeek(nowZ);
    } else {
      startWall = startOfMonth(nowZ);
      endWall = endOfMonth(nowZ);
    }

    const start = fromZonedTime(startWall, tz);
    const end = fromZonedTime(endWall, tz);
    // postgres driver binds parameters as strings — Date objects throw ERR_INVALID_ARG_TYPE
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const rows = (await sql`
      SELECT
        to_char(day_local, 'YYYY-MM-DD') AS d,
        COALESCE(SUM(total_price::numeric), 0)::bigint AS revenue,
        COUNT(*)::int AS cnt
      FROM (
        SELECT
          total_price,
          (created_at AT TIME ZONE ${tz})::date AS day_local
        FROM orders
        WHERE merchant_id = ${merchantId}
          AND status = 'paid'
          AND created_at >= ${startIso}::timestamptz
          AND created_at <= ${endIso}::timestamptz
      ) AS by_day
      GROUP BY day_local
      ORDER BY day_local
    `) as unknown as { d: string; revenue: string; cnt: number }[];

    const [sum] = (await sql`
      SELECT
        COALESCE(SUM(total_price::numeric), 0)::bigint AS total,
        COUNT(*)::int AS cnt
      FROM orders
      WHERE merchant_id = ${merchantId}
        AND status = 'paid'
        AND created_at >= ${startIso}::timestamptz
        AND created_at <= ${endIso}::timestamptz
    `) as unknown as { total: string; cnt: number }[];

    const totalRevenue = Number(sum?.total ?? 0);
    const totalOrders = Number(sum?.cnt ?? 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const byDay = new Map(
      rows.map((r) => [
        r.d,
        { revenue: Number(r.revenue), orders: Number(r.cnt) },
      ]),
    );
    const days = eachDayOfInterval({ start: startWall, end: endWall });
    const items = days.map((d) => {
      const date = formatInTimeZone(d, tz, 'yyyy-MM-dd');
      const m = byDay.get(date);
      return { date, revenue: m?.revenue ?? 0, orders: m?.orders ?? 0 };
    });

    return { totalRevenue, totalOrders, averageOrderValue, items };
  }

  async searchOrderHistory(
    incomingMerchantId: string,
    opts: {
      q?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const offset = (page - 1) * limit;
    const pattern = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
    const from = opts.from?.trim() || null;
    const to = opts.to?.trim() || null;

    const [countRow] = (await sql`
      SELECT COUNT(*)::bigint AS c FROM orders o
      WHERE o.merchant_id = ${merchantId}
        AND (${pattern}::text IS NULL OR o.id::text ILIKE ${pattern}
             OR COALESCE(o.customer_name, '') ILIKE ${pattern}
             OR o.table_number ILIKE ${pattern})
        AND (${from}::text IS NULL OR o.created_at >= ${from}::timestamptz)
        AND (${to}::text IS NULL OR o.created_at <= ${to}::timestamptz)
    `) as unknown as { c: string }[];
    const total = Number(countRow?.c ?? 0);

    const orders = (await sql`
      SELECT o.id, o.merchant_id, o.status, o.table_number,
             o.customer_name, o.customer_phone, o.total_price, o.type, o.created_at,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', oi.id,
                   'productId', oi.product_id,
                   'quantity', oi.quantity,
                   'price', oi.price,
                   'note', oi.note,
                   'notes', oi.note,
                   'product', json_build_object('id', p.id, 'name', p.name)
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), '[]'
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.merchant_id = ${merchantId}
        AND (${pattern}::text IS NULL OR o.id::text ILIKE ${pattern}
             OR COALESCE(o.customer_name, '') ILIKE ${pattern}
             OR o.table_number ILIKE ${pattern})
        AND (${from}::text IS NULL OR o.created_at >= ${from}::timestamptz)
        AND (${to}::text IS NULL OR o.created_at <= ${to}::timestamptz)
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `) as unknown as OrderRow[];

    return {
      orders,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getTopProductsAndSlowMovers(incomingMerchantId: string, days = 30) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const daysInt = Math.min(365, Math.max(1, days));
    const top = (await sql`
      SELECT p.id, p.name,
             COALESCE(SUM(oi.quantity), 0)::int AS units_sold
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id = p.id
      LEFT JOIN orders o ON o.id = oi.order_id
        AND o.merchant_id = ${merchantId}
        AND o.status = 'paid'
        AND o.created_at >= NOW() - (${daysInt}::int * INTERVAL '1 day')
      WHERE p.merchant_id = ${merchantId}
      GROUP BY p.id, p.name
      HAVING COALESCE(SUM(oi.quantity), 0) > 0
      ORDER BY units_sold DESC
      LIMIT 8
    `) as unknown as { id: number; name: string; units_sold: number }[];

    const slow = (await sql`
      SELECT p.id, p.name
      FROM products p
      WHERE p.merchant_id = ${merchantId}
        AND NOT EXISTS (
          SELECT 1 FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE oi.product_id = p.id
            AND o.merchant_id = ${merchantId}
            AND o.created_at >= NOW() - (${daysInt}::int * INTERVAL '1 day')
        )
      ORDER BY p.id
      LIMIT 12
    `) as unknown as { id: number; name: string }[];

    return { topSellers: top, zeroRecentSales: slow };
  }

  async mergeTables(incomingMerchantId: string, body: MergeTablesDto) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const master = padTableNumber(body.masterTableNumber);
    const sources = body.sourceTableNumbers.map((t) => padTableNumber(t)).filter((t) => t !== master);
    if (sources.length === 0) throw new BadRequestException('Không có bàn nguồn hợp lệ để ghép.');
    const [masterBill] = (await sql`
      SELECT bill_group_id FROM orders
      WHERE merchant_id = ${merchantId}
        AND table_number = ${master}
        AND status NOT IN ('paid', 'cancelled')
      ORDER BY created_at DESC
      LIMIT 1
    `) as unknown as { bill_group_id: string | null }[];
    const groupId = masterBill?.bill_group_id || randomUUID();
    await sql.begin(async (raw) => {
      const tx = raw as unknown as typeof sql;
      await tx`
        UPDATE table_sessions
        SET parent_table_number = ${master}
        WHERE merchant_id = ${merchantId}
          AND table_number = ANY(${sources})
          AND status = 'active'
      `;
      await tx`
        UPDATE orders
        SET table_number = ${master},
            bill_group_id = ${groupId},
            merged_from_table_number = COALESCE(merged_from_table_number, table_number)
        WHERE merchant_id = ${merchantId}
          AND table_number = ANY(${sources})
          AND status NOT IN ('paid', 'cancelled')
      `;
      await tx`
        UPDATE orders
        SET bill_group_id = ${groupId}
        WHERE merchant_id = ${merchantId}
          AND table_number = ${master}
          AND status NOT IN ('paid', 'cancelled')
      `;
    });
    return { masterTableNumber: master, sourceTableNumbers: sources, billGroupId: groupId };
  }

  async splitTable(incomingMerchantId: string, body: SplitTableDto) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const master = padTableNumber(body.masterTableNumber);
    const source = padTableNumber(body.sourceTableNumber);
    await sql.begin(async (raw) => {
      const tx = raw as unknown as typeof sql;
      await tx`
        UPDATE table_sessions
        SET parent_table_number = NULL
        WHERE merchant_id = ${merchantId}
          AND table_number = ${source}
          AND parent_table_number = ${master}
          AND status = 'active'
      `;
      await tx`
        UPDATE orders
        SET table_number = ${source},
            bill_group_id = ${randomUUID()},
            merged_into_order_id = NULL,
            merged_from_table_number = NULL
        WHERE merchant_id = ${merchantId}
          AND merged_from_table_number = ${source}
          AND table_number = ${master}
          AND status NOT IN ('paid', 'cancelled')
      `;
    });
    return { masterTableNumber: master, sourceTableNumber: source };
  }

  async mergeBills(incomingMerchantId: string, body: MergeBillsDto) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const [target] = (await sql`
      SELECT id, bill_group_id
      FROM orders
      WHERE id = ${body.targetOrderId}
        AND merchant_id = ${merchantId}
      LIMIT 1
    `) as unknown as { id: number; bill_group_id: string | null }[];
    if (!target) throw new NotFoundException('Không tìm thấy bill đích.');
    const groupId = target.bill_group_id || randomUUID();
    await sql`
      UPDATE orders
      SET merged_into_order_id = ${target.id},
          bill_group_id = ${groupId}
      WHERE merchant_id = ${merchantId}
        AND id = ANY(${body.sourceOrderIds.filter((id) => id !== target.id)})
        AND status NOT IN ('paid', 'cancelled')
    `;
    await sql`
      UPDATE orders
      SET bill_group_id = ${groupId}
      WHERE merchant_id = ${merchantId} AND id = ${target.id}
    `;
    return { targetOrderId: target.id, mergedOrderIds: body.sourceOrderIds, billGroupId: groupId };
  }

  async splitBillItems(incomingMerchantId: string, body: SplitBillItemsDto) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const [source] = (await sql`
      SELECT id, table_number, customer_name, customer_phone, status, type
      FROM orders
      WHERE id = ${body.sourceOrderId}
        AND merchant_id = ${merchantId}
      LIMIT 1
    `) as unknown as {
      id: number;
      table_number: string;
      customer_name: string | null;
      customer_phone: string | null;
      status: string;
      type: string;
    }[];
    if (!source) throw new NotFoundException('Không tìm thấy bill nguồn.');
    const [newOrder] = (await sql`
      INSERT INTO orders (
        merchant_id, table_number, customer_name, customer_phone, status, type, total_price, bill_group_id
      )
      VALUES (
        ${merchantId},
        ${body.newTableNumber ? padTableNumber(body.newTableNumber) : source.table_number},
        ${body.customerName ?? source.customer_name},
        ${body.customerPhone ?? source.customer_phone},
        'pending',
        ${source.type},
        '0',
        ${randomUUID()}
      )
      RETURNING id
    `) as unknown as { id: number }[];
    await sql`
      UPDATE order_items
      SET order_id = ${newOrder.id},
          split_from_item_id = COALESCE(split_from_item_id, id)
      WHERE order_id = ${source.id}
        AND id = ANY(${body.itemIds})
    `;
    await sql`
      UPDATE orders o SET total_price = COALESCE((
        SELECT SUM((oi.price::numeric) * oi.quantity) FROM order_items oi WHERE oi.order_id = o.id
      ), 0)::text
      WHERE o.id = ANY(${[source.id, newOrder.id]})
    `;
    return { sourceOrderId: source.id, newOrderId: newOrder.id };
  }

  async getTableBillDetails(incomingMerchantId: string, tableNumber: string) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const table = padTableNumber(tableNumber);
    const rows = (await sql`
      SELECT id, table_number, bill_group_id, merged_into_order_id, status, total_price, created_at
      FROM orders
      WHERE merchant_id = ${merchantId}
        AND table_number = ${table}
        AND status NOT IN ('paid', 'cancelled')
      ORDER BY created_at ASC
    `) as unknown as any[];
    return { tableNumber: table, bills: rows };
  }

  async getLoyaltyAccount(incomingMerchantId: string, phone: string) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const canon =
      normalizeVnCustomerPhone(phone) ?? String(phone).replace(/\D/g, '');
    const vndPerPoint = await this.fetchMerchantLoyaltyVndPerPoint(merchantId);
    const earnRuleLabel = formatEarnRuleLabel(vndPerPoint);
    if (!canon) {
      return {
        merchant_id: merchantId,
        customer_phone: phone,
        points: 0,
        earnRuleLabel,
        vndPerPoint,
      };
    }
    const [acc] = (await sql`
      SELECT merchant_id, customer_phone, customer_name, points, updated_at
      FROM loyalty_accounts
      WHERE merchant_id = ${merchantId}
        AND customer_phone = ${canon}
      LIMIT 1
    `) as unknown as any[];
    const base =
      acc ??
      ({
        merchant_id: merchantId,
        customer_phone: canon,
        points: 0,
      } as Record<string, unknown>);
    return {
      ...base,
      earnRuleLabel,
      vndPerPoint,
    };
  }

  async getLoyaltyTransactions(incomingMerchantId: string, phone: string, limit = 50) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const canon =
      normalizeVnCustomerPhone(phone) ?? String(phone).replace(/\D/g, '');
    if (!canon) return [];
    return (await sql`
      SELECT
        t.id,
        t.order_id,
        t.delta_points,
        t.reason,
        t.reward_id,
        t.note,
        t.created_at,
        r.title AS reward_title
      FROM loyalty_transactions t
      LEFT JOIN loyalty_rewards r ON r.id = t.reward_id
      WHERE t.merchant_id = ${merchantId}
        AND t.customer_phone = ${canon}
      ORDER BY t.created_at DESC
      LIMIT ${Math.min(200, Math.max(1, limit))}
    `) as unknown as any[];
  }

  async getLoyaltyOverview(incomingMerchantId: string) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const [members] = (await sql`
      SELECT COUNT(*)::int AS c FROM loyalty_accounts WHERE merchant_id = ${merchantId}
    `) as unknown as { c: number }[];
    const [pts] = (await sql`
      SELECT COALESCE(SUM(points), 0)::bigint AS s
      FROM loyalty_accounts
      WHERE merchant_id = ${merchantId}
    `) as unknown as { s: bigint | number | string }[];
    const [rw] = (await sql`
      SELECT COUNT(*)::int AS c
      FROM loyalty_rewards
      WHERE merchant_id = ${merchantId} AND active = true
    `) as unknown as { c: number }[];
    const totalPointsHeld = Number(pts?.s ?? 0);
    const vndPerPoint = await this.fetchMerchantLoyaltyVndPerPoint(merchantId);
    return {
      memberCount: Number(members?.c ?? 0),
      totalPointsHeld: Number.isFinite(totalPointsHeld) ? totalPointsHeld : 0,
      activeRewardsCount: Number(rw?.c ?? 0),
      earnRuleLabel: formatEarnRuleLabelShort(vndPerPoint),
      vndPerPoint,
    };
  }

  async getLoyaltySettings(incomingMerchantId: string) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const vndPerPoint = await this.fetchMerchantLoyaltyVndPerPoint(merchantId);
    return {
      vndPerPoint,
      earnRuleLabel: formatEarnRuleLabel(vndPerPoint),
    };
  }

  async updateLoyaltySettings(
    incomingMerchantId: string,
    dto: PatchLoyaltySettingsDto,
  ) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const vndPerPoint = clampLoyaltyVndPerPoint(dto.vndPerPoint);
    await sql`
      UPDATE merchants
      SET loyalty_vnd_per_point = ${vndPerPoint}
      WHERE id = ${merchantId}
    `;
    return {
      vndPerPoint,
      earnRuleLabel: formatEarnRuleLabel(vndPerPoint),
    };
  }

  async adjustLoyaltyPointsManual(
    incomingMerchantId: string,
    dto: AdjustLoyaltyPointsDto,
  ) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const phone =
      normalizeVnCustomerPhone(dto.phone) ?? String(dto.phone).replace(/\D/g, '');
    if (!phone || phone.length < 8) {
      throw new BadRequestException('Số điện thoại không hợp lệ');
    }
    const delta = dto.deltaPoints;
    const noteBase =
      dto.note?.trim() != null && dto.note.trim() !== ''
        ? `Quầy: ${dto.note.trim()}`
        : delta > 0
          ? 'Cộng điểm thủ công (chủ quán)'
          : 'Trừ điểm thủ công (chủ quán)';

    if (delta > 0) {
      await sql`
        INSERT INTO loyalty_accounts (merchant_id, customer_phone, customer_name, points)
        VALUES (${merchantId}, ${phone}, NULL, ${delta})
        ON CONFLICT (merchant_id, customer_phone)
        DO UPDATE SET
          points = loyalty_accounts.points + EXCLUDED.points,
          updated_at = NOW()
      `;
      await sql`
        INSERT INTO loyalty_transactions (merchant_id, order_id, customer_phone, delta_points, reason, note)
        VALUES (${merchantId}, NULL, ${phone}, ${delta}, 'manual_adjust', ${noteBase})
      `;
      const [acc] = (await sql`
        SELECT points FROM loyalty_accounts
        WHERE merchant_id = ${merchantId} AND customer_phone = ${phone}
        LIMIT 1
      `) as unknown as { points: number }[];
      return { ok: true as const, points: Number(acc?.points ?? 0), phone };
    }

    const abs = -delta;
    const upd = (await sql`
      UPDATE loyalty_accounts
      SET points = points + ${delta}, updated_at = NOW()
      WHERE merchant_id = ${merchantId}
        AND customer_phone = ${phone}
        AND points >= ${abs}
      RETURNING points
    `) as unknown as { points: number }[];
    if (!upd?.length) {
      throw new BadRequestException('Không đủ điểm để trừ hoặc chưa có tài khoản tích điểm');
    }
    await sql`
      INSERT INTO loyalty_transactions (merchant_id, order_id, customer_phone, delta_points, reason, note)
      VALUES (${merchantId}, NULL, ${phone}, ${delta}, 'manual_adjust', ${noteBase})
    `;
    return { ok: true as const, points: Number(upd[0].points), phone };
  }

  async getLoyaltyProgramBriefPublic(incomingMerchantId: string) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const vndPerPoint = await this.fetchMerchantLoyaltyVndPerPoint(merchantId);
    const [rw] = (await sql`
      SELECT COUNT(*)::int AS c
      FROM loyalty_rewards
      WHERE merchant_id = ${merchantId} AND active = true
    `) as unknown as { c: number }[];
    const rewardCount = Number(rw?.c ?? 0);
    return {
      rewardCount,
      hasActiveRewards: rewardCount > 0,
      earnRuleLabel: formatEarnRuleLabelShort(vndPerPoint),
    };
  }

  async getLoyaltyRewardsPublic(incomingMerchantId: string) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    return (await sql`
      SELECT r.id, r.title, r.description,
             r.image_url AS "imageUrl",
             r.highlight_label AS "highlightLabel",
             r.points_cost AS "pointsCost", r.sort_order AS "sortOrder",
             r.product_id AS "productId",
             p.name AS "productName"
      FROM loyalty_rewards r
      LEFT JOIN products p ON p.id = r.product_id
      WHERE r.merchant_id = ${merchantId} AND r.active = true
      ORDER BY r.sort_order ASC, r.id ASC
    `) as unknown as {
      id: number;
      title: string;
      description: string | null;
      imageUrl: string | null;
      highlightLabel: string | null;
      pointsCost: number;
      sortOrder: number;
      productId: number | null;
      productName: string | null;
    }[];
  }

  async getLoyaltyTransactionsPublic(
    incomingMerchantId: string,
    phone: string,
    limit = 50,
  ) {
    return this.getLoyaltyTransactions(incomingMerchantId, phone, limit);
  }

  async redeemLoyaltyPublic(incomingMerchantId: string, dto: RedeemLoyaltyDto) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const phone = normalizeVnCustomerPhone(dto.phone) ?? String(dto.phone).replace(/\D/g, '');
    if (!phone || phone.length < 8) {
      throw new BadRequestException('Số điện thoại không hợp lệ');
    }

    const [reward] = (await sql`
      SELECT r.id, r.merchant_id, r.points_cost, r.title, r.active,
             p.name AS product_name
      FROM loyalty_rewards r
      LEFT JOIN products p ON p.id = r.product_id
      WHERE r.id = ${dto.rewardId}
      LIMIT 1
    `) as unknown as {
      id: number;
      merchant_id: string;
      points_cost: number;
      title: string;
      active: boolean;
      product_name: string | null;
    }[];
    if (!reward || reward.merchant_id !== merchantId) {
      throw new NotFoundException('Phần quà không tồn tại');
    }
    if (!reward.active) {
      throw new BadRequestException('Phần quà không còn áp dụng');
    }

    const cost = Number(reward.points_cost);
    if (!Number.isFinite(cost) || cost <= 0) {
      throw new BadRequestException('Cấu hình điểm quà không hợp lệ');
    }

    const updated = (await sql`
      UPDATE loyalty_accounts
      SET points = points - ${cost}, updated_at = NOW()
      WHERE merchant_id = ${merchantId}
        AND customer_phone = ${phone}
        AND points >= ${cost}
      RETURNING points
    `) as unknown as { points: number }[];

    if (!updated?.length) {
      throw new BadRequestException('Không đủ điểm hoặc chưa có tài khoản tích điểm');
    }

    const newBal = Number(updated[0].points);
    const menuHint = reward.product_name
      ? ` — món: ${reward.product_name}`
      : '';
    const redeemNote = `Đổi quà: ${reward.title}${menuHint}`;
    const [insRow] = (await sql`
      INSERT INTO loyalty_transactions (merchant_id, order_id, customer_phone, delta_points, reason, reward_id, note)
      VALUES (${merchantId}, NULL, ${phone}, ${-cost}, 'redeem', ${dto.rewardId}, ${redeemNote})
      RETURNING id
    `) as unknown as { id: number }[];
    const transactionId = Number(insRow?.id ?? 0);

    const phoneLast4 = phone.length >= 4 ? phone.slice(-4) : phone;
    const hintTableRaw = dto.tableNumber?.trim();
    const displayTable = hintTableRaw ? padTableNumber(hintTableRaw) : '—';

    const socketPayload: {
      transactionId: number;
      tableNumber: string;
      rewardTitle: string;
      pointsCost: number;
      customerPhoneLast4: string;
      newBalance: number;
      rewardId: number;
      sessionId?: string;
    } = {
      transactionId,
      tableNumber: displayTable,
      rewardTitle: reward.title,
      pointsCost: cost,
      customerPhoneLast4: phoneLast4,
      newBalance: newBal,
      rewardId: reward.id,
    };
    if (dto.sessionId?.trim()) {
      socketPayload.sessionId = dto.sessionId.trim();
    }

    this.push.notifyShop(merchantId, {
      title: '🎁 Khách đổi quà tích điểm',
      body:
        displayTable !== '—'
          ? `Bàn ${displayTable} — ${reward.title} (−${cost} điểm) · SĐT *${phoneLast4}`
          : `${reward.title} (−${cost} điểm) · SĐT *${phoneLast4}`,
      data: {
        transactionId: String(transactionId),
        tableNumber: displayTable,
        rewardId: String(reward.id),
        pointsCost: String(cost),
        phoneLast4,
        ...(dto.sessionId?.trim() ? { sessionId: dto.sessionId.trim() } : {}),
      },
      type: 'loyalty_redeem',
    });
    this.socketGateway.emitShopNotification(merchantId, 'loyaltyRedeem', socketPayload);
    void this.webPush.notifyLoyaltyRedeem(merchantId, {
      tableNumber: displayTable,
      rewardTitle: reward.title,
      pointsCost: cost,
      phoneLast4,
      balanceAfter: newBal,
    });

    return {
      ok: true,
      points: newBal,
      rewardTitle: reward.title,
      rewardId: reward.id,
      transactionId,
    };
  }

  async listLoyaltyRewardsMerchant(incomingMerchantId: string) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    return (await sql`
      SELECT r.id, r.title, r.description,
             r.image_url AS "imageUrl",
             r.highlight_label AS "highlightLabel",
             r.points_cost AS "pointsCost", r.active,
             r.sort_order AS "sortOrder",
             r.product_id AS "productId",
             p.name AS "productName",
             r.created_at AS "createdAt", r.updated_at AS "updatedAt"
      FROM loyalty_rewards r
      LEFT JOIN products p ON p.id = r.product_id
      WHERE r.merchant_id = ${merchantId}
      ORDER BY r.sort_order ASC, r.id ASC
    `) as unknown as any[];
  }

  async createLoyaltyReward(
    incomingMerchantId: string,
    dto: CreateLoyaltyRewardDto,
  ) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    let productId: number | null = null;
    if (dto.productId != null) {
      await this.assertProductBelongsToMerchant(merchantId, dto.productId);
      productId = dto.productId;
    }
    const [row] = (await sql`
      INSERT INTO loyalty_rewards (merchant_id, product_id, title, description, image_url, highlight_label, points_cost, active, sort_order)
      VALUES (
        ${merchantId},
        ${productId},
        ${dto.title},
        ${dto.description ?? null},
        ${dto.imageUrl ?? null},
        ${dto.highlightLabel ?? null},
        ${dto.pointsCost},
        ${dto.active ?? true},
        ${dto.sortOrder ?? 0}
      )
      RETURNING id, title, description,
                product_id AS "productId",
                image_url AS "imageUrl",
                highlight_label AS "highlightLabel",
                points_cost AS "pointsCost", active,
                sort_order AS "sortOrder", created_at AS "createdAt"
    `) as unknown as any[];
    return row;
  }

  async updateLoyaltyReward(
    incomingMerchantId: string,
    rewardId: number,
    dto: PatchLoyaltyRewardDto,
  ) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const [cur] = (await sql`
      SELECT id, title, description, image_url, highlight_label, points_cost, active, sort_order, product_id
      FROM loyalty_rewards
      WHERE id = ${rewardId} AND merchant_id = ${merchantId}
      LIMIT 1
    `) as unknown as {
      id: number;
      title: string;
      description: string | null;
      image_url: string | null;
      highlight_label: string | null;
      points_cost: number;
      active: boolean;
      sort_order: number;
      product_id: number | null;
    }[];
    if (!cur) throw new NotFoundException('Phần quà không tồn tại');

    const title = dto.title ?? cur.title;
    const description =
      dto.description !== undefined ? dto.description : cur.description;
    const imageUrl =
      dto.imageUrl !== undefined ? dto.imageUrl : cur.image_url;
    const highlightLabel =
      dto.highlightLabel !== undefined ? dto.highlightLabel : cur.highlight_label;
    const pointsCost = dto.pointsCost ?? cur.points_cost;
    const active = dto.active ?? cur.active;
    const sortOrder = dto.sortOrder ?? cur.sort_order;

    let resolvedProductId: number | null = cur.product_id;
    if (dto.productId !== undefined) {
      if (dto.productId === null) {
        resolvedProductId = null;
      } else {
        await this.assertProductBelongsToMerchant(merchantId, dto.productId);
        resolvedProductId = dto.productId;
      }
    }

    const [row] = (await sql`
      UPDATE loyalty_rewards
      SET title = ${title},
          description = ${description},
          image_url = ${imageUrl},
          highlight_label = ${highlightLabel},
          points_cost = ${pointsCost},
          active = ${active},
          sort_order = ${sortOrder},
          product_id = ${resolvedProductId},
          updated_at = NOW()
      WHERE id = ${rewardId} AND merchant_id = ${merchantId}
      RETURNING id, title, description,
                product_id AS "productId",
                image_url AS "imageUrl",
                highlight_label AS "highlightLabel",
                points_cost AS "pointsCost", active,
                sort_order AS "sortOrder", updated_at AS "updatedAt"
    `) as unknown as any[];
    return row;
  }

  async deleteLoyaltyReward(incomingMerchantId: string, rewardId: number) {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const res = (await sql`
      DELETE FROM loyalty_rewards
      WHERE id = ${rewardId} AND merchant_id = ${merchantId}
      RETURNING id
    `) as unknown as { id: number }[];
    if (!res?.length) throw new NotFoundException('Phần quà không tồn tại');
    return { ok: true, id: rewardId };
  }
}
