import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { APP_GUARD } from '@nestjs/core';
import { ApprovedMerchantGuard } from './auth/approved-merchant.guard';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { PushNotificationModule } from './push/push-notification.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { MenuModule } from './menu/menu.module';
import { MerchantsModule } from './merchants/merchants.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SocketModule } from './socket/socket.module';
import { UploadModule } from './upload/upload.module';
import { SessionsModule } from './sessions/sessions.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { EmployeesModule } from './employees/employees.module';
import { ShiftsModule } from './shifts/shifts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '.env'),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '60', 10),
      },
    ]),
    DbModule,
    AuthModule,
    PushNotificationModule,
    UsersModule,
    OrdersModule,
    MenuModule,
    MerchantsModule,
    ReviewsModule,
    SocketModule,
    UploadModule,
    SessionsModule,
    SuperAdminModule,
    EmployeesModule,
    ShiftsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: ApprovedMerchantGuard },
  ],
})
export class AppModule {}
