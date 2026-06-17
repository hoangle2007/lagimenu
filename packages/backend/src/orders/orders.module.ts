import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { PublicLoyaltyController } from './public-loyalty.controller';
import { OrdersService } from './orders.service';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [SocketModule],
  controllers: [OrdersController, PublicLoyaltyController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
