import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { sql } from '../db/index';
import { normalizeStaffNotifyRole } from '../socket/shop-notification.constants';

interface EmployeeRow {
  id: string;
  shop_id: string;
  pin_hash: string;
  name: string;
  email: string;
  notify_role: string;
}

@Injectable()
export class EmployeeLoginService {
  constructor(private jwtService: JwtService) {}

  async login(data: {
    email: string;
    pin: string;
    shopId?: string;
    merchantId?: string;
    shopSlug?: string;
  }) {
    let shopId = data.shopId ?? data.merchantId;

    if (!shopId && data.shopSlug) {
      const [m] = await sql<{ id: string }[]>`
        SELECT id FROM merchants WHERE slug = ${data.shopSlug}
      `;
      if (!m) {
        throw new UnauthorizedException(
          'Cửa hàng không tồn tại hoặc chưa cấu mã định danh',
        );
      }
      shopId = m.id;
    }

    let employee: EmployeeRow | undefined;
    if (shopId) {
      [employee] = await sql<EmployeeRow[]>`
        SELECT e.id, e."shopId" as shop_id, e.pin as pin_hash, u.name, u.email,
               COALESCE(e."notifyRole", 'all') as notify_role
        FROM "Employee" e
        JOIN "User" u ON u.id = e."userId"
        WHERE u.email = ${data.email}
          AND e."shopId"::text = ${shopId}::text
          AND e."isActive" = true
      `;
    } else {
      [employee] = await sql<EmployeeRow[]>`
        SELECT e.id, e."shopId" as shop_id, e.pin as pin_hash, u.name, u.email,
               COALESCE(e."notifyRole", 'all') as notify_role
        FROM "Employee" e
        JOIN "User" u ON u.id = e."userId"
        WHERE u.email = ${data.email} AND e."isActive" = true
      `;
    }

    if (!employee) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const pinMatch = await bcrypt.compare(data.pin, employee.pin_hash);
    if (!pinMatch) {
      throw new UnauthorizedException('Invalid PIN');
    }

    const notifyRole = normalizeStaffNotifyRole(employee.notify_role);
    const payload = {
      sub: employee.id,
      email: employee.email,
      name: employee.name,
      role: 'EMPLOYEE',
      shopId: employee.shop_id,
      merchantId: employee.shop_id,
      employeeId: employee.id,
      notifyRole,
    };

    const token = this.jwtService.sign(payload);
    return {
      token,
      access_token: token,
      user: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        shopId: employee.shop_id,
        role: 'EMPLOYEE',
        notifyRole,
      },
    };
  }
}
