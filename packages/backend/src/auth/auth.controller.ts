import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const data = registerSchema.parse(body);
    return this.authService.register(data);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown) {
    const data = loginSchema.parse(body);
    return this.authService.login(data);
  }

  /** POST /api/auth/refresh — Re-sign a new token from an existing valid one */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async refresh(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new Error('Unauthorized');
    return this.authService.refreshToken({
      ...req.user,
      shopId: req.user.shopId ?? undefined,
    });
  }

  /** GET /api/auth/me — Return current user profile from token */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: AuthenticatedRequest) {
    if (!req.user) throw new Error('Unauthorized');
    return this.authService.getMeForUser(req.user.userId, {
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      shopId: req.user.shopId ?? undefined,
      notifyRole: req.user.notifyRole,
    });
  }
}
