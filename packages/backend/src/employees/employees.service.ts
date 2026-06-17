import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { sql } from '../db/index';
import * as bcrypt from 'bcryptjs';
import type {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  ListEmployeesDto,
} from './employees.dto';
import { normalizeStaffNotifyRole } from '../socket/shop-notification.constants';

export interface EmployeeRow {
  id: string;
  shop_id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  pin_hash: string;
  notify_role: string;
  is_active: boolean;
  created_at: Date;
}

/** JSON shape for API consumers (camelCase) */
export interface EmployeePublic {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  notifyRole: string;
  createdAt?: string;
}

export function toEmployeePublic(row: EmployeeRow): EmployeePublic {
  const created = row.created_at;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    isActive: row.is_active,
    notifyRole: normalizeStaffNotifyRole(row.notify_role),
    createdAt:
      created instanceof Date ? created.toISOString() : String(created),
  };
}

@Injectable()
export class EmployeesService {
  async list(filter: ListEmployeesDto) {
    const { shopId, isActive, page = 1, limit = 20 } = filter;
    if (!shopId) {
      throw new BadRequestException('shopId is required');
    }

    const [merch] = await sql<
      { id: string }[]
    >`SELECT id FROM merchants WHERE id::text = ${shopId}::text`;
    if (!merch) throw new NotFoundException('Merchant not found');
    const actualMerchantId = merch.id;

    const offset = (page - 1) * limit;

    const activeClause =
      isActive === true
        ? sql` AND e."isActive" = true`
        : isActive === false
          ? sql` AND e."isActive" = false`
          : sql``;

    const [countResult] = await sql<{ total: string }[]>`
      SELECT COUNT(*) as total FROM "Employee" e
      WHERE e."shopId"::text = ${actualMerchantId}::text
      ${activeClause}
    `;

    const employees = await sql<EmployeeRow[]>`
      SELECT
        e.id, e."shopId" as shop_id, e."userId" as user_id,
        u.name, u.email, u.role, e.pin as pin_hash,
        COALESCE(e."notifyRole", 'all') as notify_role,
        e."isActive" as is_active, e."createdAt" as created_at,
        NULL::text as phone
      FROM "Employee" e
      JOIN "User" u ON u.id = e."userId"
      WHERE e."shopId"::text = ${actualMerchantId}::text
      ${activeClause}
      ORDER BY u.name ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const total = Number(countResult?.total ?? '0');

    return {
      employees: employees.map(toEmployeePublic),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<EmployeeRow> {
    const [employee] = await sql<EmployeeRow[]>`
      SELECT e.id, e."shopId" as shop_id, e."userId" as user_id,
             u.name, u.email, u.role, e.pin as pin_hash,
             COALESCE(e."notifyRole", 'all') as notify_role,
             e."isActive" as is_active, e."createdAt" as created_at,
             NULL::text as phone
      FROM "Employee" e
      JOIN "User" u ON u.id = e."userId"
      WHERE e.id::text = ${id}::text
    `;

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  async create(data: CreateEmployeeDto) {
    const [merch] = await sql<
      { id: string }[]
    >`SELECT id FROM merchants WHERE id::text = ${data.shopId}::text`;
    if (!merch) {
      throw new NotFoundException('Merchant not found');
    }

    const [existing] =
      await sql`SELECT id FROM "User" WHERE email = ${data.email}`;
    if (existing) {
      throw new ConflictException(
        'Email đã được sử dụng bởi nhân viên khác hoặc tài khoản khác.',
      );
    }

    const actualShopId = merch.id;
    const notifyRole = normalizeStaffNotifyRole(data.notifyRole ?? 'all');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const hashedPin = await bcrypt.hash(data.pin, 10);

    const [newUser] = await sql`
      INSERT INTO "User" (id, merchant_id, email, password_hash, name, role, created_at)
      VALUES (gen_random_uuid(), ${merch.id}, ${data.email}, ${hashedPassword}, ${data.name}, 'EMPLOYEE', now())
      RETURNING id, name
    `;

    const [newEmployee] = (await sql`
      INSERT INTO "Employee" (id, "userId", "shopId", pin, "notifyRole", "isActive", "createdAt")
      VALUES (gen_random_uuid(), ${newUser.id}, ${actualShopId}, ${hashedPin}, ${notifyRole}, true, now())
      RETURNING id, "shopId", "userId", pin, "notifyRole", "isActive", "createdAt"
    `) as unknown as {
      id: string;
      shopId: string;
      userId: string;
      pin: string;
      notifyRole: string;
      isActive: boolean;
      createdAt: Date;
    }[];

    const row: EmployeeRow = {
      id: newEmployee.id,
      shop_id: newEmployee.shopId,
      user_id: newEmployee.userId,
      name: newUser.name,
      email: data.email,
      phone: data.phone ?? null,
      pin_hash: newEmployee.pin,
      notify_role: newEmployee.notifyRole ?? notifyRole,
      is_active: newEmployee.isActive,
      created_at: newEmployee.createdAt,
    };
    return row;
  }

  async update(id: string, data: UpdateEmployeeDto) {
    const existing = await this.findById(id);

    if (data.name !== undefined) {
      await sql`UPDATE "User" SET name = ${data.name} WHERE id = ${existing.user_id}`;
    }

    const hashedPin = data.pin ? await bcrypt.hash(data.pin, 10) : undefined;
    const nextNotify =
      data.notifyRole !== undefined
        ? normalizeStaffNotifyRole(data.notifyRole)
        : existing.notify_role;

    const [updated] = (await sql`
      UPDATE "Employee" SET
        pin = ${hashedPin ?? existing.pin_hash},
        "isActive" = ${data.isActive ?? existing.is_active},
        "notifyRole" = ${nextNotify}
      WHERE id = ${id}
      RETURNING id, "shopId", "userId", pin, "notifyRole", "isActive", "createdAt"
    `) as unknown as {
      id: string;
      shopId: string;
      userId: string;
      pin: string;
      notifyRole: string;
      isActive: boolean;
      createdAt: Date;
    }[];

    const row: EmployeeRow = {
      id: updated.id,
      shop_id: updated.shopId,
      user_id: updated.userId,
      name: data.name ?? existing.name,
      email: existing.email,
      phone: data.phone ?? existing.phone,
      pin_hash: updated.pin,
      notify_role: updated.notifyRole ?? nextNotify,
      is_active: updated.isActive,
      created_at: updated.createdAt,
    };
    return row;
  }

  async deactivate(id: string) {
    await this.findById(id);
    await sql`UPDATE "Employee" SET "isActive" = false WHERE id = ${id}`;
    return { success: true, id };
  }

  async findByEmail(email: string) {
    const [employee] = await sql<EmployeeRow[]>`
      SELECT e.id, e."shopId" as shop_id, e."userId" as user_id,
             e.pin as pin_hash,
             COALESCE(e."notifyRole", 'all') as notify_role,
             e."isActive" as is_active, e."createdAt" as created_at,
             u.name, u.email, NULL::text as phone
      FROM "Employee" e
      JOIN "User" u ON u.id = e."userId"
      WHERE u.email = ${email} AND e."isActive" = true
    `;
    return employee ?? null;
  }
}
