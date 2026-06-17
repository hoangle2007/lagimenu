import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { WebPushService } from './web-push.service';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const deleteSchema = z.object({
  endpoint: z.string().min(1),
});

@Controller('push-subscriptions')
export class PushSubscriptionsController {
  constructor(private readonly webPush: WebPushService) {}

  /** Public: browser needs VAPID public key before subscribe */
  @Get('vapid-public-key')
  vapidPublicKey() {
    const publicKey = this.webPush.getPublicKey();
    return { publicKey: publicKey ?? null };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new BadRequestException('No shop');
    const sub = subscriptionSchema.parse(body);
    await this.webPush.saveSubscription(shopId, sub);
    return { success: true };
  }

  @Delete()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  async remove(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new BadRequestException('No shop');
    const { endpoint } = deleteSchema.parse(body);
    await this.webPush.removeSubscription(shopId, endpoint);
    return { success: true };
  }
}
