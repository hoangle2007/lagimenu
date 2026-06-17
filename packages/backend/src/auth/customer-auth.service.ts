import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { sql } from '../db/index';
import type {
  CustomerLoginDto,
  CustomerRegisterDto,
} from './customer-auth.dto';

@Injectable()
export class CustomerAuthService {
  constructor(private jwtService: JwtService) {}

  async register(data: CustomerRegisterDto) {
    const [merch] =
      await sql`SELECT id FROM merchants WHERE email = ${data.email}`;
    if (merch) {
      throw new ConflictException('Email đã được dùng cho tài khoản cửa hàng.');
    }
    const [exists] =
      await sql`SELECT id FROM "Customer" WHERE email = ${data.email}`;
    if (exists) {
      throw new ConflictException('Email đã được đăng ký.');
    }

    const hashed = await bcrypt.hash(data.password, 10);
    const id = crypto.randomUUID();
    await sql`
      INSERT INTO "Customer" (id, email, password, name, phone, "isActive", "createdAt")
      VALUES (${id}, ${data.email}, ${hashed}, ${data.name}, ${data.phone?.trim() || null}, true, NOW())
    `;

    return this.issueTokens(id, data.email, data.name);
  }

  async login(data: CustomerLoginDto) {
    const [row] = await sql<
      {
        id: string;
        email: string;
        name: string;
        password: string;
        is_active: boolean;
      }[]
    >`
      SELECT id, email, name, password, "isActive" AS is_active
      FROM "Customer" WHERE email = ${data.email}
    `;
    if (!row || !row.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(data.password, row.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(row.id, row.email, row.name);
  }

  private issueTokens(id: string, email: string, name: string) {
    const payload = {
      sub: id,
      email,
      name,
      role: 'CUSTOMER',
    };
    const token = this.jwtService.sign(payload);
    return {
      token,
      access_token: token,
      user: {
        id,
        email,
        name,
        role: 'CUSTOMER',
      },
    };
  }

  async findByIdForRefresh(id: string) {
    const [row] = await sql<
      { id: string; email: string; name: string; is_active: boolean }[]
    >`
      SELECT id, email, name, "isActive" AS is_active FROM "Customer" WHERE id::text = ${id}::text
    `;
    if (!row?.is_active) return null;
    return row;
  }
}
