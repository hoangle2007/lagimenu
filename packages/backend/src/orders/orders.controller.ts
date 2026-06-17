import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrdersService } from './orders.service';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  patchOrderSchema,
  mergeTablesSchema,
  splitTableSchema,
  mergeBillsSchema,
  splitBillItemsSchema,
  createLoyaltyRewardSchema,
  patchLoyaltyRewardSchema,
  patchLoyaltySettingsSchema,
  adjustLoyaltyPointsSchema,
} from './orders.dto';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { getClientIp } from '../lib/request-ip';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** POST /api/orders — Customer creates an order (public) */
  @Post()
  @Throttle({ default: { limit: 25, ttl: 60000 } })
  async createOrder(@Body() body: unknown, @Req() req: Request) {
    const data = createOrderSchema.parse(body);
    const clientIp = getClientIp(req);
    const order = await this.ordersService.createOrder(data, { clientIp });
    return { order };
  }

  /** GET /api/orders — Owner/staff lists orders (JWT required) */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async listOrders(@Req() req: AuthenticatedRequest) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    return this.ordersService.getMerchantOrders(shopId);
  }

  /** GET /api/orders/revenue?period=today|week|month&merchantId= — paid orders only, merchant TZ */
  @Get('revenue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async revenue(
    @Req() req: AuthenticatedRequest,
    @Query('period') period?: string,
    @Query('merchantId') merchantIdQuery?: string,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const p = period === 'week' || period === 'month' ? period : 'today';
    const target =
      merchantIdQuery &&
      (req.user?.role === 'super_admin' || req.user?.role === 'admin')
        ? merchantIdQuery
        : shopId;
    return this.ordersService.getRevenueReport(target, p);
  }

  /** GET /api/orders/active — Active (non-completed) orders */
  @Get('active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async listActiveOrders(@Req() req: AuthenticatedRequest) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    return this.ordersService.getActiveOrders(shopId);
  }

  /** GET /api/orders/active/:merchantId/:tableNumber — Active orders for a specific table */
  @Get('active/:merchantId/:tableNumber')
  async getActiveOrdersForTable(
    @Param('merchantId') merchantId: string,
    @Param('tableNumber') tableNumber: string,
  ) {
    const orders = await this.ordersService.getActiveOrdersForTable(
      merchantId,
      tableNumber,
    );
    return { orders };
  }

  /** GET /api/orders/merchant/:merchantId/tables — Active orders for tables screen (optimized) */
  @Get('merchant/:merchantId/tables')
  async getTableOrders(@Param('merchantId') merchantId: string) {
    const orders = await this.ordersService.getActiveOrders(merchantId);
    return { orders };
  }

  /** GET /api/orders/merchant/:merchantId — Frontend compatibility route with pagination */
  @Get('merchant/:merchantId')
  async getMerchantOrders(
    @Param('merchantId') merchantId: string,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
  ) {
    const page = pageQuery ? Math.max(1, parseInt(pageQuery)) : 1;
    const limit = limitQuery
      ? Math.min(50, Math.max(1, parseInt(limitQuery)))
      : 20;
    const result = await this.ordersService.getMerchantOrders(
      merchantId,
      page,
      limit,
    );
    return result;
  }

  /** GET /api/orders/history — Search + date range (must be before :id) */
  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async orderHistory(
    @Req() req: AuthenticatedRequest,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const page = pageQuery ? Math.max(1, parseInt(pageQuery, 10)) : 1;
    const limit = limitQuery
      ? Math.min(100, Math.max(1, parseInt(limitQuery, 10)))
      : 20;
    return this.ordersService.searchOrderHistory(shopId, {
      q,
      from,
      to,
      page,
      limit,
    });
  }

  /** GET /api/orders/insights/products — Top sellers + slow movers */
  @Get('insights/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async productInsights(
    @Req() req: AuthenticatedRequest,
    @Query('days') days?: string,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const d = days ? parseInt(days, 10) : 30;
    return this.ordersService.getTopProductsAndSlowMovers(
      shopId,
      Number.isFinite(d) ? d : 30,
    );
  }

  @Post('tables/merge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async mergeTables(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const data = mergeTablesSchema.parse(body);
    return this.ordersService.mergeTables(shopId, data);
  }

  @Post('tables/split')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async splitTable(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const data = splitTableSchema.parse(body);
    return this.ordersService.splitTable(shopId, data);
  }

  @Post('bills/merge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async mergeBills(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const data = mergeBillsSchema.parse(body);
    return this.ordersService.mergeBills(shopId, data);
  }

  @Post('bills/split-items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async splitBillItems(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const data = splitBillItemsSchema.parse(body);
    return this.ordersService.splitBillItems(shopId, data);
  }

  @Get('bills/table/:tableNumber')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async getTableBills(
    @Req() req: AuthenticatedRequest,
    @Param('tableNumber') tableNumber: string,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    return this.ordersService.getTableBillDetails(shopId, tableNumber);
  }

  @Get('loyalty/account/:phone')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async getLoyaltyAccount(
    @Req() req: AuthenticatedRequest,
    @Param('phone') phone: string,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    return this.ordersService.getLoyaltyAccount(shopId, phone);
  }

  @Get('loyalty/transactions/:phone')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async getLoyaltyTransactions(
    @Req() req: AuthenticatedRequest,
    @Param('phone') phone: string,
    @Query('limit') limitQuery?: string,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const limit = limitQuery ? parseInt(limitQuery, 10) : 50;
    return this.ordersService.getLoyaltyTransactions(shopId, phone, limit);
  }

  @Get('loyalty/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async getLoyaltyOverview(@Req() req: AuthenticatedRequest) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    return this.ordersService.getLoyaltyOverview(shopId);
  }

  @Get('loyalty/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async getLoyaltySettings(@Req() req: AuthenticatedRequest) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    return this.ordersService.getLoyaltySettings(shopId);
  }

  @Patch('loyalty/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  async patchLoyaltySettings(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const data = patchLoyaltySettingsSchema.parse(body);
    return this.ordersService.updateLoyaltySettings(shopId, data);
  }

  @Post('loyalty/adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  async adjustLoyaltyPoints(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const data = adjustLoyaltyPointsSchema.parse(body);
    return this.ordersService.adjustLoyaltyPointsManual(shopId, data);
  }

  @Get('loyalty/rewards')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async listLoyaltyRewards(@Req() req: AuthenticatedRequest) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    return this.ordersService.listLoyaltyRewardsMerchant(shopId);
  }

  @Post('loyalty/rewards')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async createLoyaltyReward(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const data = createLoyaltyRewardSchema.parse(body);
    return this.ordersService.createLoyaltyReward(shopId, data);
  }

  @Patch('loyalty/rewards/:rewardId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async patchLoyaltyReward(
    @Req() req: AuthenticatedRequest,
    @Param('rewardId') rewardId: string,
    @Body() body: unknown,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const id = parseInt(rewardId, 10);
    if (!Number.isFinite(id)) {
      throw new BadRequestException('Invalid reward id');
    }
    const data = patchLoyaltyRewardSchema.parse(body);
    return this.ordersService.updateLoyaltyReward(shopId, id, data);
  }

  @Delete('loyalty/rewards/:rewardId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async deleteLoyaltyReward(
    @Req() req: AuthenticatedRequest,
    @Param('rewardId') rewardId: string,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const id = parseInt(rewardId, 10);
    if (!Number.isFinite(id)) {
      throw new BadRequestException('Invalid reward id');
    }
    return this.ordersService.deleteLoyaltyReward(shopId, id);
  }

  /** GET /api/orders/:id — Single order detail */
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    if (isNaN(Number(id)) || id === 'undefined') {
      console.warn(
        `[OrdersController] getOrder: Muting request for invalid ID: "${id}"`,
      );
      return { success: false, message: 'Invalid ID placeholder' };
    }
    const order = await this.ordersService.getOrder(Number(id));
    return { order };
  }

  /** PUT /api/orders/:id/status — Owner/staff updates order status */
  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    if (isNaN(Number(id)) || id === 'undefined') {
      console.warn(
        `[OrdersController] updateStatus: Muting request for invalid ID: "${id}"`,
      );
      return { success: false, message: 'Invalid ID placeholder' };
    }
    const data = updateOrderStatusSchema.parse(body);
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const order = await this.ordersService.updateStatus(
      shopId,
      Number(id),
      data,
    );
    return { order };
  }

  /** PUT /api/orders/merchant/:merchantId/:id/status — Frontend compatibility route */
  @Put('merchant/:merchantId/:id/status')
  async updateStatusCompat(
    @Param('merchantId') merchantId: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    if (isNaN(Number(id)) || id === 'undefined') {
      console.warn(
        `[OrdersController] updateStatusCompat: Muting request for invalid ID: "${id}"`,
      );
      return { success: false, message: 'Invalid ID placeholder' };
    }
    const data = updateOrderStatusSchema.parse(body);
    const order = await this.ordersService.updateStatus(
      merchantId,
      Number(id),
      data,
    );
    return { order };
  }

  /** PUT /api/orders/pay-table — Pay all orders for a table */
  @Put('pay-table')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async payTable(
    @Body() body: { tableNumber: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const orders = await this.ordersService.payAllTableOrders(
      shopId,
      body.tableNumber,
    );
    return { orders };
  }

  /** POST /api/orders/merchant/:merchantId/table/:tableNumber/pay — Frontend compatibility */
  @Post('merchant/:merchantId/table/:tableNumber/pay')
  async payTableCompat(
    @Param('merchantId') merchantId: string,
    @Param('tableNumber') tableNumber: string,
  ) {
    const orders = await this.ordersService.payAllTableOrders(
      merchantId,
      tableNumber,
    );
    return { orders };
  }

  /** PATCH /api/orders/:id — Update status + optional paymentMethod (must be after static routes) */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant', 'EMPLOYEE')
  async patchOrder(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    if (isNaN(Number(id)) || id === 'undefined') {
      return { success: false, message: 'Invalid ID placeholder' };
    }
    const data = patchOrderSchema.parse(body);
    const shopId = req.user?.shopId;
    if (!shopId) throw new ForbiddenException('No shop associated with user');
    const order = await this.ordersService.patchOrder(shopId, Number(id), data);
    return { order };
  }
}
