import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { registerFcmTokenSchema } from './fcm-token.dto';
import { ZodValidationPipe } from '../lib/zod-validation.pipe';
import { AuthenticatedRequest } from '../types/authenticated-request';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * POST /users/fcm-token
   * Đăng ký hoặc cập nhật FCM token cho thiết bị hiện tại.
   * User đang đăng nhập sẽ được gắn token này → nhận push notification.
   */
  @Post('fcm-token')
  async registerFcmToken(
    @Body(new ZodValidationPipe(registerFcmTokenSchema))
    body: { fcmToken: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user!.userId;
    await this.usersService.updateFcmToken(userId, body.fcmToken);
    return { message: 'FCM token registered successfully' };
  }
}
