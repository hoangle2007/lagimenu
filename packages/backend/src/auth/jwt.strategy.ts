import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_SECRET environment variable is required — authentication is disabled without it',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const role = payload.role as string;
    if (role === 'CUSTOMER') {
      return {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        role: 'CUSTOMER',
        shopId: null as string | null,
        merchantId: undefined as string | undefined,
        accountStatus: undefined,
        notifyRole: undefined,
      };
    }
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      role,
      shopId: payload.shopId || payload.sub,
      merchantId: payload.merchantId || payload.shopId || payload.sub,
      accountStatus: payload.accountStatus as string | undefined,
      notifyRole: payload.notifyRole as string | undefined,
    };
  }
}
