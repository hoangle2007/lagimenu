import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { sql } from '../db/index';

export interface GoogleProfile {
  sub: string; // Google user ID
  email: string;
  name?: string;
  picture?: string;
}

export interface UpsertResult {
  merchant: MerchantInfo;
  isNewAccount: boolean;
}

export interface MerchantInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  shopId: string;
  merchantId: string;
}

@Injectable()
export class GoogleAuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Verify a Google ID token by calling Google's tokeninfo endpoint.
   * Also validates that the token's audience matches our client ID.
   */
  async verifyGoogleToken(token: string): Promise<GoogleProfile> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${token}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('Google tokeninfo error:', response.status, text);
      throw new UnauthorizedException(
        'Đăng nhập Google thất bại. Vui lòng thử lại.',
      );
    }

    const info = (await response.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
      aud?: string;
      error?: string;
    };

    if (info.error || !info.sub || !info.email) {
      throw new UnauthorizedException('Token Google không hợp lệ.');
    }

    // Validate audience (optional — only if GOOGLE_CLIENT_ID is set)
    if (clientId && info.aud !== clientId) {
      throw new UnauthorizedException('Token Google không đúng ứng dụng.');
    }

    return {
      sub: info.sub,
      email: info.email,
      name: info.name ?? info.email.split('@')[0],
      picture: info.picture,
    };
  }

  /**
   * Create or return an existing merchant from Google profile.
   * If google_id exists, return the merchant.
   * If email exists without google_id, throw ConflictException (must link account).
   * Otherwise, create a new merchant.
   */
  async upsertFromGoogle(profile: GoogleProfile): Promise<UpsertResult> {
    // 1. Check if this Google ID already has an account
    const existingByGoogleId = (await sql`
      SELECT id, email, name, role, google_id
      FROM merchants
      WHERE google_id = ${profile.sub}
    `) as any[];

    if (existingByGoogleId.length > 0) {
      const merchant = existingByGoogleId[0]!;
      return {
        merchant: this.buildMerchantInfo(merchant),
        isNewAccount: false,
      };
    }

    const [custEmail] =
      await sql`SELECT id FROM "Customer" WHERE email = ${profile.email}`;
    if (custEmail) {
      throw new ConflictException(
        'Email đã dùng cho tài khoản khách hàng. Vui lòng đăng nhập kênh khách hoặc dùng email khác.',
      );
    }

    // 2. Check if email is already used by another account
    const existingByEmail = (await sql`
      SELECT id, email, name, role, google_id, password
      FROM merchants
      WHERE email = ${profile.email}
    `) as any[];

    if (existingByEmail.length > 0) {
      const merchant = existingByEmail[0]!;
      // If email exists and has no google_id and no password → can link
      // If email exists and has google_id → this is a different Google account using same email (edge case)
      // If email exists and has password → must use link endpoint
      if (merchant.password || merchant.google_id) {
        throw new ConflictException(
          'Tài khoản đã tồn tại. Vui lòng đăng nhập bằng email/password trước, sau đó kết nối Google trong cài đặt.',
        );
      }
      // No password, no social id → link Google to this account
      const [updated] = (await sql`
        UPDATE merchants
        SET google_id = ${profile.sub}, name = COALESCE(name, ${profile.name ?? null})
        WHERE id = ${merchant.id}
        RETURNING id, email, name, role
      `) as any[];
      return {
        merchant: this.buildMerchantInfo(updated),
        isNewAccount: false,
      };
    }

    // 3. Create new merchant
    const id = crypto.randomUUID();
    const nameStr = profile.name ?? profile.email.split('@')[0] ?? 'user';
    const slug = nameStr
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const [merch] = (await sql`
      INSERT INTO merchants (id, email, name, slug, google_id, password, role)
      VALUES (${id}, ${profile.email}, ${nameStr}, ${slug}, ${profile.sub}, 'GOOGLE_OAUTH', 'merchant')
      RETURNING id, email, name, role
    `) as any[];

    return {
      merchant: this.buildMerchantInfo(merch),
      isNewAccount: true,
    };
  }

  /**
   * Link Google account to an existing merchant (requires password verification).
   */
  async linkGoogleToAccount(
    merchantId: string,
    googleId: string,
    password: string,
  ): Promise<MerchantInfo> {
    // 1. Find merchant and verify password
    const [merchant] = (await sql`
      SELECT id, email, name, role, password, google_id
      FROM merchants
      WHERE id = ${merchantId}
    `) as any[];

    if (!merchant) {
      throw new UnauthorizedException('Không tìm thấy tài khoản.');
    }

    if (merchant.google_id) {
      throw new ConflictException('Tài khoản đã được kết nối Google trước đó.');
    }

    // No password set → can link without password check
    if (!merchant.password) {
      const [updated] = (await sql`
        UPDATE merchants SET google_id = ${googleId} WHERE id = ${merchant.id}
        RETURNING id, email, name, role
      `) as any[];
      return this.buildMerchantInfo(updated);
    }

    // Password required to link
    const validPassword = await bcrypt.compare(password, merchant.password);
    if (!validPassword) {
      throw new UnauthorizedException('Mật khẩu không đúng.');
    }

    const [updated] = (await sql`
      UPDATE merchants SET google_id = ${googleId} WHERE id = ${merchant.id}
      RETURNING id, email, name, role
    `) as any[];
    return this.buildMerchantInfo(updated);
  }

  /**
   * Sign and return JWT for a merchant.
   * Same payload shape as email/password login for guards compatibility.
   */
  signToken(info: MerchantInfo): {
    token: string;
    access_token: string;
    user: MerchantInfo;
  } {
    const payload = {
      sub: info.id,
      email: info.email,
      name: info.name,
      role:
        info.role === 'super_admin' || info.role === 'admin'
          ? info.role
          : 'merchant',
      shopId: info.id,
      merchantId: info.id,
    };
    const token = this.jwtService.sign(payload);
    return { token, access_token: token, user: info };
  }

  private buildMerchantInfo(row: any): MerchantInfo {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role ?? 'merchant',
      shopId: row.id,
      merchantId: row.id,
    };
  }
}
