import { Module, Global } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PushNotificationService } from './push-notification.service';
import { WebPushService } from './web-push.service';
import { PushSubscriptionsController } from './push-subscriptions.controller';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [PushSubscriptionsController],
  providers: [PushNotificationService, WebPushService],
  exports: [PushNotificationService, WebPushService],
})
export class PushNotificationModule {}
