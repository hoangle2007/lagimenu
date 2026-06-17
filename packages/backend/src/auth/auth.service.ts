import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { sql } from '../db/index';
import { normalizeStaffNotifyRole } from '../socket/shop-notification.constants';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  /** Notify platform admins (rows in merchants with admin roles) via per-admin Notification feed. */
  private async notifyAdminsNewMerchantRegistration(line: string) {
    const admins = (await sql`
      SELECT id FROM merchants WHERE role IN ('super_admin', 'admin')
    `) as unknown as { id: string }[];
    const title = 'Merchant đăng ký mới';
    const body = line;
    for (const a of admins) {
      await sql`
        INSERT INTO "Notification" (merchant_id, title, body, is_read)
        VALUES (${a.id}, ${title}, ${body}, false)
      `;
    }
  }

  async register(data: {
    email: string;
    password: string;
    shopName: string;
    ownerName: string;
    phone?: string;
  }) {
    const existing =
      await sql`SELECT id FROM merchants WHERE email = ${data.email}`;
    if (existing.length > 0) {
      throw new ConflictException('Email already registered');
    }
    const [cust] =
      await sql`SELECT id FROM "Customer" WHERE email = ${data.email}`;
    if (cust) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const id = crypto.randomUUID();
    const slug = data.shopName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const phone = data.phone?.trim() || null;

    const accountStatus =
      process.env.E2E_AUTO_APPROVE_MERCHANT === 'true' ||
      process.env.E2E_AUTO_APPROVE_MERCHANT === '1'
        ? 'approved'
        : 'pending';

    await sql`
      INSERT INTO merchants (id, email, password, name, slug, role, account_status, phone)
      VALUES (${id}, ${data.email}, ${hashedPassword}, ${data.shopName}, ${slug}, 'merchant', ${accountStatus}, ${phone})
    `;

    await this.notifyAdminsNewMerchantRegistration(
      `${data.ownerName} — ${data.shopName} (${data.email}) đang chờ duyệt.`,
    );

    if (accountStatus === 'approved') {
      return this.login({ email: data.email, password: data.password });
    }

    return {
      pending: true,
      message:
        'Đăng ký thành công. Tài khoản đang chờ admin duyệt. Chúng tôi sẽ liên hệ qua email.',
    };
  }

  async login(data: { email: string; password: string }) {
    const row = await sql`
      SELECT id, email, name, password, role, COALESCE(account_status, 'approved') AS account_status
      FROM merchants WHERE email = ${data.email}
    `;
    const merch = row[0];

    if (!merch || !(await bcrypt.compare(data.password, merch.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const acc =
      (merch as { account_status?: string }).account_status ?? 'approved';
    const payload = {
      sub: merch.id,
      email: merch.email,
      name: merch.name,
      role:
        merch.role === 'super_admin' || merch.role === 'admin'
          ? merch.role
          : 'merchant',
      shopId: merch.id,
      merchantId: merch.id,
      accountStatus: acc,
    };

    const token = this.jwtService.sign(payload);
    return {
      token,
      access_token: token,
      user: {
        id: merch.id,
        email: merch.email,
        name: merch.name,
        role: payload.role,
        shopId: merch.id,
        merchantId: merch.id,
        accountStatus: acc,
      },
    };
  }

  async refreshToken(jwtUser: {
    userId?: string;
    sub?: string;
    email?: string;
    name?: string;
    role?: string;
    shopId?: string;
    merchantId?: string;
    notifyRole?: string;
  }) {
    const id = jwtUser.userId || jwtUser.sub;
    if (!id) throw new UnauthorizedException('Invalid token');

    if (jwtUser.role === 'CUSTOMER') {
      const [row] = (await sql`
        SELECT id, email, name, "isActive" AS ia FROM "Customer" WHERE id::text = ${id}::text
      `) as unknown as {
        id: string;
        email: string;
        name: string;
        ia: boolean;
      }[];
      if (!row?.ia) throw new UnauthorizedException('Invalid token');
      const payload = {
        sub: row.id,
        email: row.email,
        name: row.name,
        role: 'CUSTOMER' as const,
      };
      const token = this.jwtService.sign(payload);
      return {
        token,
        access_token: token,
        user: {
          id: row.id,
          email: row.email,
          name: row.name,
          role: 'CUSTOMER',
        },
      };
    }

    if (jwtUser.role === 'EMPLOYEE') {
      const [row] = (await sql`
        SELECT e.id, e."shopId" AS sid, COALESCE(e."notifyRole", 'all') AS nr, u.email, u.name
        FROM "Employee" e
        JOIN "User" u ON u.id = e."userId"
        WHERE e.id::text = ${id}::text AND e."isActive" = true
      `) as unknown as {
        id: string;
        sid: string;
        nr: string;
        email: string;
        name: string;
      }[];
      if (!row) throw new UnauthorizedException('Invalid token');
      const notifyRole = normalizeStaffNotifyRole(row.nr);
      const payload = {
        sub: row.id,
        email: row.email,
        name: row.name,
        role: 'EMPLOYEE' as const,
        shopId: row.sid,
        merchantId: row.sid,
        employeeId: row.id,
        notifyRole,
      };
      const token = this.jwtService.sign(payload);
      return {
        token,
        access_token: token,
        user: {
          id: row.id,
          email: row.email,
          name: row.name,
          role: 'EMPLOYEE',
          shopId: row.sid,
          merchantId: row.sid,
          notifyRole,
        },
      };
    }

    const [st] = (await sql`
      SELECT COALESCE(account_status, 'approved') AS s FROM merchants WHERE id = ${id}
    `) as unknown as { s: string }[];
    const accountStatus = st?.s ?? 'approved';
    const payload = {
      sub: id,
      email: jwtUser.email,
      name: jwtUser.name,
      role: jwtUser.role || 'merchant',
      shopId: jwtUser.shopId || jwtUser.merchantId,
      merchantId: jwtUser.merchantId || jwtUser.shopId,
      accountStatus,
    };
    const token = this.jwtService.sign(payload);
    return {
      token,
      access_token: token,
      user: {
        id: id,
        email: jwtUser.email,
        name: jwtUser.name,
        role: payload.role,
        shopId: payload.shopId,
        merchantId: payload.merchantId,
        accountStatus,
      },
    };
  }

  /** Return current authenticated user from JWT payload */
  getMeFromJwt(jwtUser: {
    userId?: string;
    sub?: string;
    email?: string;
    name?: string;
    role?: string;
    shopId?: string;
    merchantId?: string;
  }) {
    return {
      user: {
        id: jwtUser.userId || jwtUser.sub,
        email: jwtUser.email,
        name: jwtUser.name,
        role: jwtUser.role || 'merchant',
        shopId: jwtUser.shopId || jwtUser.merchantId,
        merchantId: jwtUser.merchantId || jwtUser.shopId,
      },
    };
  }

  async getMeForUser(
    userId: string,
    jwtUser: {
      email?: string;
      name?: string;
      role?: string;
      shopId?: string | null;
      notifyRole?: string;
    },
  ) {
    if (jwtUser.role === 'CUSTOMER') {
      return {
        user: {
          id: userId,
          email: jwtUser.email,
          name: jwtUser.name,
          role: 'CUSTOMER',
        },
      };
    }

    if (jwtUser.role === 'EMPLOYEE') {
      return {
        user: {
          id: userId,
          email: jwtUser.email,
          name: jwtUser.name,
          role: jwtUser.role,
          shopId: jwtUser.shopId,
          merchantId: jwtUser.shopId ?? userId,
          notifyRole: jwtUser.notifyRole,
        },
      };
    }

    let accountStatus = 'approved';
    if (jwtUser.role === 'merchant') {
      const [row] = (await sql`
        SELECT COALESCE(account_status, 'approved') AS s FROM merchants WHERE id = ${userId}
      `) as unknown as { s: string }[];
      accountStatus = row?.s ?? 'approved';
    }
    return {
      user: {
        id: userId,
        email: jwtUser.email,
        name: jwtUser.name,
        role: jwtUser.role,
        shopId: jwtUser.shopId,
        merchantId: userId,
        accountStatus,
      },
    };
  }
}
