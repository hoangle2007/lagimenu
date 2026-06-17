import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { sql } from '../db/index';

export interface AdminMerchant {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  account_status: string;
  created_at: string;
  order_count: number;
  total_revenue: number;
  product_count: number;
  owner_name: string;
  owner_email: string;
  employee_count: number;
}

// Matches frontend ShopSummary interface
export type ShopSummary = AdminMerchant;

export interface AdminOrder {
  id: string;
  shop_id: string;
  order_number: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_price: number;
  created_at: string;
}

export interface AdminProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  category_id: string;
  category_name: string;
}

export interface ToppingGroupWithItems {
  id: string;
  name: string;
  is_required: boolean;
  items: { id: string; name: string; price: number; isDefault: boolean }[];
}

export interface AdminEmployee {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

@Injectable()
export class SuperAdminService {
  async getAllShops(): Promise<ShopSummary[]> {
    return (await sql`
      SELECT
        m.id,
        m.name,
        m.slug,
        m.phone,
        m.address,
        m.is_open                           AS is_active,
        COALESCE(m.account_status, 'approved') AS account_status,
        m.created_at::text                  AS created_at,
        m.name                              AS owner_name,
        m.email                             AS owner_email,
        COUNT(DISTINCT o.id)                AS order_count,
        COALESCE(SUM(o.total_price::numeric) FILTER (WHERE o.status IS DISTINCT FROM 'cancelled'), 0)::bigint AS total_revenue,
        COUNT(DISTINCT p.id)                AS product_count,
        COUNT(DISTINCT e.id)                AS employee_count
      FROM merchants m
      LEFT JOIN orders o ON o.merchant_id = m.id
      LEFT JOIN products p ON p.merchant_id = m.id
      LEFT JOIN "Employee" e ON e."shopId"::text = m.id::text
      WHERE m.role = 'merchant'
      GROUP BY m.id
      ORDER BY m.created_at DESC
    `) as unknown as ShopSummary[];
  }

  async getShopOrders(shopId: string): Promise<AdminOrder[]> {
    return (await sql`
      SELECT
        o.id,
        o.merchant_id AS shop_id,
        o.id::text AS order_number,
        o.status,
        o.customer_name,
        o.customer_phone,
        o.total_price::text AS total_price,
        o.created_at::text     AS created_at
      FROM orders o
      WHERE o.merchant_id = ${shopId}
      ORDER BY o.created_at DESC
      LIMIT 200
    `) as unknown as AdminOrder[];
  }

  async getShopProducts(shopId: string): Promise<AdminProduct[]> {
    return (await sql`
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.image_url,
        p.is_available,
        p.category_id,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.merchant_id = ${shopId}
      ORDER BY p.id
    `) as unknown as AdminProduct[];
  }

  async getShopToppingGroups(
    _shopId: string,
  ): Promise<ToppingGroupWithItems[]> {
    return [];
  }

  async getOrderItems(orderId: string): Promise<any[]> {
    return await sql`
      SELECT oi.*, p.name as product_name
      FROM order_items oi
      LEFT JOIN products p ON p.id::text = oi.product_id::text
      WHERE oi.order_id::text = ${orderId}::text
    `;
  }

  async getShopEmployees(shopId: string): Promise<AdminEmployee[]> {
    return (await sql`
      SELECT e.id, u.name, u.email, u.role, e."isActive" as is_active, e."createdAt"::text AS created_at
      FROM "Employee" e
      JOIN "User" u ON u.id = e."userId"
      WHERE e."shopId"::text = ${shopId}::text
      ORDER BY e."createdAt" DESC
    `) as unknown as AdminEmployee[];
  }

  async getOverview(): Promise<{
    totalShops: number;
    totalOrders: number;
    totalRevenue: number;
    activeShops: number;
  }> {
    const [stats] = (await sql`
      SELECT
        COUNT(DISTINCT m.id) FILTER (WHERE m.role = 'merchant') AS total_shops,
        COUNT(DISTINCT o.id)                         AS total_orders,
        COALESCE(SUM(o.total_price::numeric) FILTER (WHERE o.status IS DISTINCT FROM 'cancelled'), 0)::bigint AS total_revenue,
        COUNT(DISTINCT m.id) FILTER (WHERE m.role = 'merchant' AND m.is_open = true) AS active_shops
      FROM merchants m
      LEFT JOIN orders o ON o.merchant_id = m.id
    `) as unknown as {
      total_shops: string;
      total_orders: string;
      total_revenue: bigint;
      active_shops: string;
    }[];

    const r = stats;
    return {
      totalShops: Number(r?.total_shops ?? 0),
      totalOrders: Number(r?.total_orders ?? 0),
      totalRevenue: Number(r?.total_revenue ?? 0),
      activeShops: Number(r?.active_shops ?? 0),
    };
  }

  async listMerchantAccounts(status?: string) {
    if (status && status !== 'all') {
      return (await sql`
        SELECT id, name, email, phone, slug, created_at::text AS created_at,
               COALESCE(account_status, 'approved') AS account_status
        FROM merchants
        WHERE role = 'merchant' AND COALESCE(account_status, 'approved') = ${status}
        ORDER BY created_at DESC
      `) as unknown as unknown[];
    }
    return (await sql`
      SELECT id, name, email, phone, slug, created_at::text AS created_at,
             COALESCE(account_status, 'approved') AS account_status
      FROM merchants
      WHERE role = 'merchant'
      ORDER BY created_at DESC
    `) as unknown as unknown[];
  }

  async setMerchantAccountStatus(
    id: string,
    next: 'approved' | 'rejected' | 'suspended',
  ) {
    await sql`UPDATE merchants SET account_status = ${next} WHERE id = ${id} AND role = 'merchant'`;
    return { ok: true };
  }

  async deleteMerchantAccount(id: string) {
    await sql`DELETE FROM merchants WHERE id = ${id} AND role = 'merchant'`;
    return { ok: true };
  }

  async listPlatformOrders(merchantId?: string, status?: string, limit = 100) {
    if (merchantId && status) {
      return (await sql`
        SELECT o.id, o.merchant_id, o.status, o.table_number, o.total_price::text AS total_price,
               o.created_at::text AS created_at, m.name AS merchant_name
        FROM orders o
        JOIN merchants m ON m.id = o.merchant_id
        WHERE o.merchant_id = ${merchantId} AND o.status = ${status}
        ORDER BY o.created_at DESC
        LIMIT ${limit}
      `) as unknown as unknown[];
    }
    if (merchantId) {
      return (await sql`
        SELECT o.id, o.merchant_id, o.status, o.table_number, o.total_price::text AS total_price,
               o.created_at::text AS created_at, m.name AS merchant_name
        FROM orders o
        JOIN merchants m ON m.id = o.merchant_id
        WHERE o.merchant_id = ${merchantId}
        ORDER BY o.created_at DESC
        LIMIT ${limit}
      `) as unknown as unknown[];
    }
    if (status) {
      return (await sql`
        SELECT o.id, o.merchant_id, o.status, o.table_number, o.total_price::text AS total_price,
               o.created_at::text AS created_at, m.name AS merchant_name
        FROM orders o
        JOIN merchants m ON m.id = o.merchant_id
        WHERE o.status = ${status}
        ORDER BY o.created_at DESC
        LIMIT ${limit}
      `) as unknown as unknown[];
    }
    return (await sql`
      SELECT o.id, o.merchant_id, o.status, o.table_number, o.total_price::text AS total_price,
             o.created_at::text AS created_at, m.name AS merchant_name
      FROM orders o
      JOIN merchants m ON m.id = o.merchant_id
      ORDER BY o.created_at DESC
      LIMIT ${limit}
    `) as unknown as unknown[];
  }

  async listPlatformUsers(limit: number) {
    return (await sql`
      SELECT u.id, u.email, u.name, u.role, u.merchant_id, m.name AS merchant_name, u.created_at::text AS created_at
      FROM "User" u
      JOIN merchants m ON m.id = u.merchant_id
      ORDER BY u.created_at DESC
      LIMIT ${limit}
    `) as unknown as unknown[];
  }

  async getDailyOrderSeries() {
    return (await sql`
      SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS d,
             COUNT(*)::int AS cnt
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY 1
      ORDER BY 1
    `) as unknown as { d: string; cnt: number }[];
  }

  async getAllSystemSettings() {
    return (await sql`SELECT key, value, updated_at::text AS updated_at FROM system_settings ORDER BY key`) as unknown as {
      key: string;
      value: string | null;
      updated_at: string;
    }[];
  }

  async upsertSystemSetting(key: string, value: string | null) {
    await sql`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
  }

  async listNotificationsForMerchant(merchantId: string, limit: number) {
    return (await sql`
      SELECT id, title, body, is_read, created_at::text AS created_at
      FROM "Notification"
      WHERE merchant_id = ${merchantId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as unknown as unknown[];
  }

  async listCustomers(limit = 200) {
    return (await sql`
      SELECT id, email, name, phone, "isActive" AS is_active, "createdAt"::text AS created_at
      FROM "Customer"
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `) as unknown as {
      id: string;
      email: string;
      name: string;
      phone: string | null;
      is_active: boolean;
      created_at: string;
    }[];
  }

  async setCustomerActive(id: string, active: boolean) {
    const [row] = (await sql`
      UPDATE "Customer" SET "isActive" = ${active} WHERE id::text = ${id}::text RETURNING id
    `) as unknown as { id: string }[];
    if (!row) throw new NotFoundException('Customer not found');
    return { ok: true };
  }

  async listAdminAccounts() {
    return (await sql`
      SELECT id, email, name, role, created_at::text AS created_at
      FROM merchants
      WHERE role IN ('admin', 'super_admin')
      ORDER BY created_at DESC
    `) as unknown as {
      id: string;
      email: string;
      name: string;
      role: string;
      created_at: string;
    }[];
  }

  async resetMerchantPassword(merchantId: string, newPassword: string) {
    if (newPassword.length < 6) {
      throw new BadRequestException('Mật khẩu tối thiểu 6 ký tự');
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    const [row] = (await sql`
      UPDATE merchants SET password = ${hashed}
      WHERE id::text = ${merchantId}::text AND role = 'merchant'
      RETURNING id
    `) as unknown as { id: string }[];
    if (!row) throw new NotFoundException('Merchant not found');
    return { ok: true };
  }

  async updatePlatformUser(
    userId: string,
    body: { name?: string; role?: string },
  ) {
    if (body.role && body.role !== 'EMPLOYEE') {
      throw new BadRequestException(
        'Chỉ được đặt role EMPLOYEE cho nhân viên nền tảng',
      );
    }
    const [exists] =
      await sql`SELECT id FROM "User" WHERE id::text = ${userId}::text`;
    if (!exists) throw new NotFoundException('User not found');
    if (body.name !== undefined) {
      await sql`UPDATE "User" SET name = ${body.name} WHERE id::text = ${userId}::text`;
    }
    if (body.role !== undefined) {
      await sql`UPDATE "User" SET role = ${body.role} WHERE id::text = ${userId}::text`;
    }
    return { ok: true };
  }

  async resetPlatformUserPassword(userId: string, newPassword: string) {
    if (newPassword.length < 6) {
      throw new BadRequestException('Mật khẩu tối thiểu 6 ký tự');
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    const [row] = (await sql`
      UPDATE "User" SET password_hash = ${hashed} WHERE id::text = ${userId}::text RETURNING id
    `) as unknown as { id: string }[];
    if (!row) throw new NotFoundException('User not found');
    return { ok: true };
  }

  async patchMerchantShop(
    merchantId: string,
    body: { is_open?: boolean; account_status?: string },
  ) {
    const allowed = new Set(['pending', 'approved', 'rejected', 'suspended']);
    if (
      body.account_status !== undefined &&
      !allowed.has(body.account_status)
    ) {
      throw new BadRequestException('account_status không hợp lệ');
    }
    const [m] =
      await sql`SELECT id FROM merchants WHERE id::text = ${merchantId}::text AND role = 'merchant'`;
    if (!m) throw new NotFoundException('Merchant not found');

    if (body.is_open !== undefined) {
      await sql`UPDATE merchants SET is_open = ${body.is_open} WHERE id::text = ${merchantId}::text`;
    }
    if (body.account_status !== undefined) {
      await sql`UPDATE merchants SET account_status = ${body.account_status} WHERE id::text = ${merchantId}::text`;
    }
    return { ok: true };
  }

  async getRevenueSummary() {
    const [row] = (await sql`
      SELECT
        COALESCE(SUM(o.total_price::numeric) FILTER (WHERE o.status IS DISTINCT FROM 'cancelled'), 0)::bigint AS total,
        COUNT(*) FILTER (WHERE o.status IS DISTINCT FROM 'cancelled')::bigint AS order_cnt
      FROM orders o
    `) as unknown as { total: bigint; order_cnt: bigint }[];
    const byShop = (await sql`
      SELECT m.id, m.name,
             COUNT(o.id) FILTER (WHERE o.status IS DISTINCT FROM 'cancelled')::int AS orders,
             COALESCE(SUM(o.total_price::numeric) FILTER (WHERE o.status IS DISTINCT FROM 'cancelled'), 0)::bigint AS revenue
      FROM merchants m
      LEFT JOIN orders o ON o.merchant_id = m.id
      WHERE m.role = 'merchant'
      GROUP BY m.id
      ORDER BY revenue DESC NULLS LAST
    `) as unknown as {
      id: string;
      name: string;
      orders: number;
      revenue: bigint;
    }[];
    return {
      totalRevenue: Number(row?.total ?? 0),
      orderCount: Number(row?.order_cnt ?? 0),
      byShop: byShop.map((s) => ({
        merchantId: s.id,
        name: s.name,
        orders: s.orders,
        revenue: Number(s.revenue),
      })),
    };
  }
}
