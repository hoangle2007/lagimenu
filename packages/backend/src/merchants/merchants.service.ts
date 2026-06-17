import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { sql } from '../db/index';
import { getCanonicalMerchantId } from '../lib/shop-utils';
import { normalizeIp } from '../lib/request-ip';

export interface MerchantRow {
  id: string;
  email: string;
  password: string;
  name: string;
  slogan: string | null;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  open_time: string | null;
  close_time: string | null;
  table_count: number | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_owner: string | null;
  auto_accept: boolean;
  notify_sound: boolean;
  is_open: boolean;
  banner_url: string | null;
  qr_secret: string | null;
  role: string;
  created_at: Date;
  fcm_token: string | null;
  slug?: string;
  latitude?: number | null;
  longitude?: number | null;
  geo_fence_radius_m?: number | null;
  require_customer_location?: boolean;
}

@Injectable()
export class MerchantsService {
  async getOrderGuardConfig(merchantIdOrSlug: string) {
    const id = await getCanonicalMerchantId(merchantIdOrSlug);
    const [row] = (await sql`
      SELECT latitude, longitude, geo_fence_radius_m,
        COALESCE(require_customer_location, false) AS require_customer_location
      FROM merchants WHERE id = ${id}
    `) as unknown as {
      latitude: number | null;
      longitude: number | null;
      geo_fence_radius_m: number | null;
      require_customer_location: boolean;
    }[];
    if (!row) throw new NotFoundException('Merchant not found');
    if (!row.require_customer_location) {
      return { requireLocation: false as const };
    }
    return {
      requireLocation: true as const,
      centerLat: row.latitude,
      centerLng: row.longitude,
      radiusM: row.geo_fence_radius_m ?? 150,
    };
  }

  async listBlockedIps(merchantId: string) {
    const id = await getCanonicalMerchantId(merchantId);
    return (await sql`
      SELECT id::text AS id, ip, note, created_at::text AS created_at
      FROM merchant_blocked_ips
      WHERE merchant_id = ${id}
      ORDER BY created_at DESC
    `) as unknown as {
      id: string;
      ip: string;
      note: string | null;
      created_at: string;
    }[];
  }

  async addBlockedIp(merchantId: string, ip: string, note?: string | null) {
    const id = await getCanonicalMerchantId(merchantId);
    const nip = normalizeIp(ip);
    if (!nip) throw new BadRequestException('IP không hợp lệ');
    try {
      await sql`
        INSERT INTO merchant_blocked_ips (merchant_id, ip, note)
        VALUES (${id}, ${nip}, ${note ?? null})
      `;
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as Error).message)
          : '';
      if (msg.includes('unique') || msg.includes('duplicate')) {
        throw new BadRequestException('IP này đã có trong danh sách chặn');
      }
      throw e;
    }
    return { ok: true };
  }

  async removeBlockedIp(merchantId: string, blockId: string) {
    const id = await getCanonicalMerchantId(merchantId);
    const rows = (await sql`
      DELETE FROM merchant_blocked_ips
      WHERE id = ${blockId}::uuid AND merchant_id = ${id}
      RETURNING id
    `) as unknown as { id: string }[];
    if (!rows.length)
      throw new NotFoundException('Không tìm thấy bản ghi chặn IP');
    return { ok: true };
  }

  async getPaymentInfo(id: string) {
    const m = await this.getMerchant(id);
    return {
      bankName: m.bank_name ?? null,
      bankAccount: m.bank_account ?? null,
      bankOwner: m.bank_owner ?? null,
    };
  }

  async patchSettings(
    id: string,
    body: Partial<{
      wifi_ssid: string;
      wifi_password: string;
      timezone: string;
      opening_hours_json: string | null;
      feature_flags_json: string | null;
    }>,
  ): Promise<MerchantRow> {
    const existing =
      (await sql`SELECT * FROM merchants WHERE id = ${id}`) as unknown as MerchantRow[];
    if (!existing.length) throw new NotFoundException('Merchant not found');
    const e = existing[0];
    const ex = e as any;
    const wifiSsid =
      body.wifi_ssid !== undefined ? body.wifi_ssid : ex.wifi_ssid;
    const wifiPassword =
      body.wifi_password !== undefined ? body.wifi_password : ex.wifi_password;
    const timezone =
      body.timezone !== undefined
        ? body.timezone
        : (ex.timezone ?? 'Asia/Ho_Chi_Minh');
    const openingHours =
      body.opening_hours_json !== undefined
        ? body.opening_hours_json
        : (ex.opening_hours_json ?? null);
    const featureFlags =
      body.feature_flags_json !== undefined
        ? body.feature_flags_json
        : (ex.feature_flags_json ?? null);
    const rows = (await sql`
      UPDATE merchants SET
        wifi_ssid = ${wifiSsid ?? null},
        wifi_password = ${wifiPassword ?? null},
        timezone = ${timezone},
        opening_hours_json = ${openingHours},
        feature_flags_json = ${featureFlags}
      WHERE id = ${id}
      RETURNING *
    `) as unknown as MerchantRow[];
    return rows[0];
  }

  async listStaffInvites(merchantId: string) {
    return (await sql`
      SELECT id, email, role, token, expires_at::text AS expires_at, created_at::text AS created_at
      FROM staff_invites
      WHERE merchant_id = ${merchantId}
      ORDER BY created_at DESC
    `) as unknown as unknown[];
  }

  async createStaffInvite(merchantId: string, email: string, role: string) {
    const token =
      crypto.randomUUID().replace(/-/g, '') +
      crypto.randomUUID().replace(/-/g, '');
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [row] = (await sql`
      INSERT INTO staff_invites (merchant_id, email, token, role, expires_at)
      VALUES (${merchantId}, ${email}, ${token}, ${role}, ${expires.toISOString()})
      RETURNING id, email, role, token, expires_at::text AS expires_at, created_at::text AS created_at
    `) as unknown as unknown[];
    return row;
  }

  async getMerchant(id: string): Promise<MerchantRow> {
    try {
      // Find merchant by their own ID OR slug
      const rows = (await sql`
        SELECT *
        FROM merchants
        WHERE id::text = ${id}::text OR slug = ${id}
      `) as unknown as MerchantRow[];
      if (!rows || rows.length === 0) {
        throw new NotFoundException('Merchant not found');
      }
      return rows[0];
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('DB Error in getMerchant:', error);
      throw new NotFoundException('Merchant not found or DB error');
    }
  }

  async updateMerchant(
    id: string,
    data: Partial<{
      name: string;
      slogan: string;
      address: string;
      phone: string;
      logo_url: string;
      open_time: string;
      close_time: string;
      table_count: number;
      bank_name: string;
      bank_account: string;
      bank_owner: string;
      auto_accept: boolean;
      notify_sound: boolean;
      is_open: boolean;
      banner_url: string;
      qr_secret: string;
      slug: string;
      latitude: number | null;
      longitude: number | null;
      geo_fence_radius_m: number | null;
      require_customer_location: boolean;
    }>,
  ): Promise<MerchantRow> {
    try {
      const existing =
        (await sql`SELECT * FROM merchants WHERE id = ${id}`) as unknown as MerchantRow[];
      if (!existing.length) throw new NotFoundException('Merchant not found');
      const e = existing[0];
      const ex = e as any;

      const rows = (await sql`
        UPDATE merchants SET
          name        = ${data.name ?? e.name ?? null},
          slogan      = ${data.slogan ?? e.slogan ?? null},
          address     = ${data.address ?? e.address ?? null},
          phone       = ${data.phone ?? e.phone ?? null},
          logo_url    = ${data.logo_url ?? e.logo_url ?? null},
          open_time   = ${data.open_time ?? e.open_time ?? null},
          close_time  = ${data.close_time ?? e.close_time ?? null},
          table_count = ${data.table_count ?? e.table_count ?? null},
          bank_name   = ${data.bank_name ?? e.bank_name ?? null},
          bank_account= ${data.bank_account ?? e.bank_account ?? null},
          bank_owner  = ${data.bank_owner ?? e.bank_owner ?? null},
          auto_accept = ${data.auto_accept ?? e.auto_accept ?? null},
          notify_sound= ${data.notify_sound ?? e.notify_sound ?? null},
          is_open     = ${data.is_open ?? e.is_open ?? null},
          banner_url  = ${data.banner_url ?? e.banner_url ?? null},
          qr_secret   = ${data.qr_secret ?? e.qr_secret ?? null},
          slug        = ${data.slug ?? e.slug ?? null},
          latitude    = ${data.latitude !== undefined ? data.latitude : (ex.latitude ?? null)},
          longitude   = ${data.longitude !== undefined ? data.longitude : (ex.longitude ?? null)},
          geo_fence_radius_m = ${data.geo_fence_radius_m !== undefined ? data.geo_fence_radius_m : (ex.geo_fence_radius_m ?? null)},
          require_customer_location = ${data.require_customer_location !== undefined ? data.require_customer_location : (ex.require_customer_location ?? false)}
        WHERE id = ${id}
        RETURNING *
      `) as unknown as MerchantRow[];
      return rows[0];
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('DB Error in updateMerchant:', error);
      throw new NotFoundException('Merchant not found or DB error');
    }
  }

  async getCustomers(merchantId: string) {
    try {
      const canonicalId = await getCanonicalMerchantId(merchantId);
      const customers = await sql`
        SELECT 
          COALESCE(customer_phone, customer_name, 'Anonymous') as id,
          COALESCE(MAX(customer_name), 'Khách vãng lai') as name,
          MAX(customer_phone) as phone,
          MAX(created_at) as "lastOrderAt",
          MAX(created_at) as "createdAt",
          COUNT(*)::int as "totalOrders",
          SUM(total_price::numeric)::float as "totalSpent"
        FROM orders
        WHERE merchant_id = ${canonicalId}
          AND (customer_phone IS NOT NULL OR customer_name IS NOT NULL)
        GROUP BY COALESCE(customer_phone, customer_name, 'Anonymous')
        ORDER BY "lastOrderAt" DESC
      `;
      return customers;
    } catch (error) {
      console.error('DB Error in getCustomers:', error);
      return [];
    }
  }
}
