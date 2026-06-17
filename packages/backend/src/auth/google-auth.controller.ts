import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { GoogleAuthService } from './google-auth.service';
import { googleLoginSchema, linkGoogleSchema } from './google-auth.dto';

@Controller('auth')
export class GoogleAuthController {
  constructor(
    private readonly googleAuthService: GoogleAuthService,
    private readonly jwtService: JwtService,
  ) {}

  // ─── Google Login ─────────────────────────────────────────────────────────

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() body: unknown) {
    const { credential } = googleLoginSchema.parse(body);

    // 1. Verify Google token
    const profile = await this.googleAuthService.verifyGoogleToken(credential);

    // 2. Upsert merchant
    const { merchant, isNewAccount } =
      await this.googleAuthService.upsertFromGoogle(profile);

    // 3. Sign JWT
    const result = this.googleAuthService.signToken(merchant);

    console.log(
      `[GoogleAuth] action=login userId=${merchant.id} isNewAccount=${isNewAccount}`,
    );

    return { ...result, isNewAccount };
  }

  // ─── Link Google to existing account ─────────────────────────────────────

  @Post('google/link')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async linkGoogle(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    if (!req.user) throw new UnauthorizedException();
    const { googleId, password } = linkGoogleSchema.parse(body);

    const merchant = await this.googleAuthService.linkGoogleToAccount(
      req.user.userId,
      googleId,
      password ?? '',
    );

    const result = this.googleAuthService.signToken(merchant);
    console.log(
      `[GoogleAuth] action=link accountId=${merchant.id} googleId=${googleId}`,
    );

    return result;
  }
}
