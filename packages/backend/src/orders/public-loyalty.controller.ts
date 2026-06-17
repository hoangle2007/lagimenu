import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { redeemLoyaltySchema } from './orders.dto';

@Controller('public')
export class PublicLoyaltyController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('loyalty/:merchantId/account')
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  async account(
    @Param('merchantId') merchantId: string,
    @Query('phone') phone?: string,
  ) {
    if (!phone?.trim()) throw new BadRequestException('Thiếu tham số phone');
    return this.ordersService.getLoyaltyAccount(merchantId, phone);
  }

  @Get('loyalty/:merchantId/transactions')
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  async transactions(
    @Param('merchantId') merchantId: string,
    @Query('phone') phone?: string,
    @Query('limit') limitQuery?: string,
  ) {
    if (!phone?.trim()) throw new BadRequestException('Thiếu tham số phone');
    const limit = limitQuery ? parseInt(limitQuery, 10) : 40;
    return this.ordersService.getLoyaltyTransactionsPublic(
      merchantId,
      phone,
      Number.isFinite(limit) ? limit : 40,
    );
  }

  @Get('loyalty/:merchantId/rewards')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async rewards(@Param('merchantId') merchantId: string) {
    return this.ordersService.getLoyaltyRewardsPublic(merchantId);
  }

  @Get('loyalty/:merchantId/program')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async loyaltyProgram(@Param('merchantId') merchantId: string) {
    return this.ordersService.getLoyaltyProgramBriefPublic(merchantId);
  }

  @Post('loyalty/:merchantId/redeem')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async redeem(
    @Param('merchantId') merchantId: string,
    @Body() body: unknown,
  ) {
    const dto = redeemLoyaltySchema.parse(body);
    return this.ordersService.redeemLoyaltyPublic(merchantId, dto);
  }
}
