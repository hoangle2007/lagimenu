import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { sql } from '../db/index';
import { getCanonicalMerchantId } from '../lib/shop-utils';

export function statusLabelForWebPush(status: string): string {
  const s = (status || '').toLowerCase();
  const map: Record<string, string> = {
    pending: '⏳ Đang đợi xác nhận',
    confirmed: '✅ Đang order',
    processing: '✅ Đang order',
    preparing: '✅ Đang order',
    waiting_drinks: '🧃 Đang đợi nước',
    served: '🎉 Đã nhận nước',
    ready: '✅ Đang order',
    completed: '✅ Đang order',
    paid: '💰 Đã thanh toán',
    unpaid: '❌ Chưa thanh toán',
    cancelled: '❌ Đã hủy',
  };
  return map[s] ?? '⏳ Đang đợi xác nhận';
}

function formatVnd(amount: string | number): string {
  const n =
    typeof amount === 'string'
      ? parseFloat(amount.replace(/[^\d.]/g, '')) || 0
      : amount;
  return new Intl.NumberFormat('vi-VN').format(Math.round(n));
}

type SubRow = { endpoint: string; p256dh: string; auth: string };

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);
  private enabled = false;

  onModuleInit() {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (pub && priv) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:support@kivomenu.app',
        pub,
        priv,
      );
      this.enabled = true;
      this.logger.log('Web Push (VAPID) enabled.');
    } else {
      this.logger.warn(
        'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY missing — Web Push disabled.',
      );
    }
  }

  getPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY ?? null;
  }

  async saveSubscription(
    incomingMerchantId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  ): Promise<void> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    await sql`
      INSERT INTO push_subscriptions (merchant_id, endpoint, p256dh, auth)
      VALUES (${merchantId}, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
      ON CONFLICT (endpoint) DO UPDATE SET
        merchant_id = EXCLUDED.merchant_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth
    `;
  }

  async removeSubscription(
    incomingMerchantId: string,
    endpoint: string,
  ): Promise<void> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    await sql`DELETE FROM push_subscriptions WHERE merchant_id = ${merchantId} AND endpoint = ${endpoint}`;
  }

  async notifyNewOrder(
    incomingMerchantId: string,
    p: {
      orderId: number;
      tableNumber: string;
      totalAmount: string | number;
      totalItems: number;
      status: string;
    },
  ): Promise<void> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const title = '🔔 Đơn mới!';
    const id6 = String(p.orderId).slice(-6);
    const body =
      `Bàn: ${p.tableNumber}\n` +
      `Order: #${id6}\n` +
      `Giá: ${formatVnd(p.totalAmount)}₫\n` +
      `Số lượng: ${p.totalItems} món\n` +
      `Tình trạng: ${statusLabelForWebPush(p.status)}`;
    await this.sendPayload(merchantId, { title, body });
  }

  async notifyLoyaltyRedeem(
    incomingMerchantId: string,
    p: {
      tableNumber: string;
      rewardTitle: string;
      pointsCost: number;
      phoneLast4: string;
      balanceAfter: number;
    },
  ): Promise<void> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const title = '🎁 Khách đổi quà tích điểm';
    const tableLine =
      p.tableNumber && p.tableNumber !== '—'
        ? `Bàn: ${p.tableNumber}\n`
        : '';
    const body =
      `${tableLine}` +
      `Quà: ${p.rewardTitle}\n` +
      `Trừ: ${p.pointsCost} điểm\n` +
      `SĐT cuối: *${p.phoneLast4}\n` +
      `Điểm còn: ${p.balanceAfter}`;
    await this.sendPayload(merchantId, { title, body });
  }

  async notifyOrderStatus(
    incomingMerchantId: string,
    p: {
      orderId: number;
      tableNumber: string;
      totalAmount: string | number;
      totalItems: number;
      status: string;
    },
  ): Promise<void> {
    const merchantId = await getCanonicalMerchantId(incomingMerchantId);
    const title = '📣 Cập nhật đơn';
    const id6 = String(p.orderId).slice(-6);
    const body =
      `Bàn: ${p.tableNumber}\n` +
      `Order: #${id6}\n` +
      `Giá: ${formatVnd(p.totalAmount)}₫\n` +
      `Số lượng: ${p.totalItems} món\n` +
      `Tình trạng: ${statusLabelForWebPush(p.status)}`;
    await this.sendPayload(merchantId, { title, body });
  }

  private async sendPayload(
    merchantId: string,
    payload: { title: string; body: string },
  ): Promise<void> {
    if (!this.enabled) return;

    const rows = (await sql`
      SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE merchant_id = ${merchantId}
    `) as unknown as SubRow[];

    if (!rows.length) {
      this.logger.debug(`No Web Push subscriptions for merchant ${merchantId}`);
      return;
    }

    const data = JSON.stringify(payload);
    for (const row of rows) {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          data,
          { TTL: 3600 },
        );
      } catch (e: unknown) {
        const err = e as { statusCode?: number };
        this.logger.warn(`Web push failed: ${(e as Error).message}`);
        if (err.statusCode === 404 || err.statusCode === 410) {
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${row.endpoint}`;
        }
      }
    }
  }
}
