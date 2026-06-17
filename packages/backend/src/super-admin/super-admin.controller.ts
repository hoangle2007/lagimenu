import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { sql } from '../db/index';
import { SuperAdminService } from './super-admin.service';
import { SocketGateway } from '../socket/socket.gateway';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class SuperAdminController {
  constructor(
    private readonly svc: SuperAdminService,
    private readonly socketGateway: SocketGateway,
  ) {}

  // ─── Dashboard ────────────────────────────────────────────────────────────────

  /** GET /api/admin/overview — Cross-shop aggregate stats */
  @Get('overview')
  async overview() {
    return this.svc.getOverview();
  }

  /** GET /api/admin/stats — Quick stats (merchants, orders, revenue) */
  @Get('stats')
  async getStats() {
    const [stats] = (await sql`
      SELECT 
        (SELECT COUNT(*) FROM merchants WHERE role = 'merchant') as shop_count,
        (SELECT COUNT(*) FROM orders WHERE status IS DISTINCT FROM 'cancelled') as order_count,
        (SELECT COALESCE(SUM(total_price::numeric), 0) FROM orders WHERE status IS DISTINCT FROM 'cancelled') as total_revenue
    `) as unknown as {
      shop_count: string;
      order_count: string;
      total_revenue: string;
    }[];

    return {
      totalMerchants: parseInt(stats?.shop_count ?? '0'),
      totalOrders: parseInt(stats?.order_count ?? '0'),
      totalRevenue: parseInt(stats?.total_revenue ?? '0'),
    };
  }

  /** GET /api/admin/revenue-summary — tổng doanh thu + theo cửa hàng */
  @Get('revenue-summary')
  async revenueSummary() {
    return this.svc.getRevenueSummary();
  }

  /** GET /api/admin/customers */
  @Get('customers')
  async customers(@Query('limit') limit?: string) {
    const lim = limit ? Math.min(500, Math.max(1, parseInt(limit, 10))) : 200;
    return { customers: await this.svc.listCustomers(lim) };
  }

  @Patch('customers/:id/active')
  async setCustomerActive(
    @Param('id') id: string,
    @Body() body: { active: boolean },
  ) {
    return this.svc.setCustomerActive(id, !!body?.active);
  }

  /** GET /api/admin/admin-accounts — tài khoản admin nền tảng */
  @Get('admin-accounts')
  async adminAccounts() {
    return { admins: await this.svc.listAdminAccounts() };
  }

  @Patch('merchant-accounts/:id/password')
  async resetMerchantPassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    return this.svc.resetMerchantPassword(id, body?.newPassword ?? '');
  }

  @Patch('merchants/:id/shop')
  async patchMerchantShop(
    @Param('id') id: string,
    @Body() body: { is_open?: boolean; account_status?: string },
  ) {
    return this.svc.patchMerchantShop(id, body ?? {});
  }

  @Patch('platform-users/:id')
  async patchPlatformUser(
    @Param('id') id: string,
    @Body() body: { name?: string; role?: string },
  ) {
    return this.svc.updatePlatformUser(id, body ?? {});
  }

  @Patch('platform-users/:id/password')
  async resetPlatformUserPassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    return this.svc.resetPlatformUserPassword(id, body?.newPassword ?? '');
  }

  // ─── Merchants ────────────────────────────────────────────────────────────────

  /** GET /api/admin/merchants — All merchants (legacy endpoint) */
  @Get('merchants')
  async getMerchants() {
    return (await sql`
      SELECT m.id, m.name, m.phone, m.slug, m.created_at::text as created_at
      FROM merchants m
      ORDER BY m.created_at DESC
    `) as unknown as unknown[];
  }

  // ─── Shops ────────────────────────────────────────────────────────────────────

  /** GET /api/admin/shops — All shops with stats */
  @Get('shops')
  async getShops() {
    const shops = await this.svc.getAllShops();
    return { shops };
  }

  /** GET /api/admin/shops/:shopId/orders — All orders for a shop */
  @Get('shops/:shopId/orders')
  async getShopOrders(@Param('shopId') shopId: string) {
    return this.svc.getShopOrders(shopId);
  }

  /** GET /api/admin/shops/:shopId/products — All products for a shop */
  @Get('shops/:shopId/products')
  async getShopProducts(@Param('shopId') shopId: string) {
    return this.svc.getShopProducts(shopId);
  }

  /** GET /api/admin/shops/:shopId/topping-groups — All topping groups for a shop */
  @Get('shops/:shopId/topping-groups')
  async getShopToppingGroups(@Param('shopId') shopId: string) {
    return this.svc.getShopToppingGroups(shopId);
  }

  /** GET /api/admin/shops/:shopId/employees — All employees for a shop */
  @Get('shops/:shopId/employees')
  async getShopEmployees(@Param('shopId') shopId: string) {
    return this.svc.getShopEmployees(shopId);
  }

  /** GET /api/admin/orders/:orderId/items — Details of a specific order */
  @Get('orders/:orderId/items')
  async getOrderItems(@Param('orderId') orderId: string) {
    return this.svc.getOrderItems(orderId);
  }

  /** GET /api/admin/merchant-accounts?status=pending|approved|rejected|suspended|all */
  @Get('merchant-accounts')
  async merchantAccounts(@Query('status') status?: string) {
    return { merchants: await this.svc.listMerchantAccounts(status) };
  }

  @Patch('merchant-accounts/:id/approve')
  async approveMerchant(@Param('id') id: string) {
    return this.svc.setMerchantAccountStatus(id, 'approved');
  }

  @Patch('merchant-accounts/:id/reject')
  async rejectMerchant(
    @Param('id') id: string,
    @Body() _body: { reason?: string },
  ) {
    return this.svc.setMerchantAccountStatus(id, 'rejected');
  }

  @Patch('merchant-accounts/:id/suspend')
  async suspendMerchant(@Param('id') id: string) {
    return this.svc.setMerchantAccountStatus(id, 'suspended');
  }

  @Delete('merchant-accounts/:id')
  async deleteMerchant(@Param('id') id: string) {
    return this.svc.deleteMerchantAccount(id);
  }

  /** GET /api/admin/platform-orders — recent orders across shops */
  @Get('platform-orders')
  async platformOrders(
    @Query('merchantId') merchantId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Math.min(500, Math.max(1, parseInt(limit, 10))) : 100;
    return {
      orders: await this.svc.listPlatformOrders(merchantId, status, lim),
    };
  }

  /** GET /api/admin/platform-users — User + merchant email */
  @Get('platform-users')
  async platformUsers(@Query('limit') limit?: string) {
    const lim = limit ? Math.min(500, Math.max(1, parseInt(limit, 10))) : 200;
    return { users: await this.svc.listPlatformUsers(lim) };
  }

  /** GET /api/admin/analytics/daily-orders — last 14 days */
  @Get('analytics/daily-orders')
  async dailyOrders() {
    return { series: await this.svc.getDailyOrderSeries() };
  }

  /** GET /api/admin/system-settings */
  @Get('system-settings')
  async getSystemSettings() {
    return { settings: await this.svc.getAllSystemSettings() };
  }

  /** PATCH /api/admin/system-settings — body { key, value } */
  @Patch('system-settings')
  async patchSystemSetting(
    @Body() body: { key: string; value: string | null },
  ) {
    await this.svc.upsertSystemSetting(body.key, body.value ?? null);
    return { ok: true };
  }

  /** GET /api/admin/socket-stats */
  @Get('socket-stats')
  async socketStats() {
    return {
      approxConnectedClients: this.socketGateway.getApproxConnectedClients(),
    };
  }

  /** GET /api/admin/notifications — feed for the logged-in admin user (merchants.id) */
  @Get('notifications')
  async adminNotifications(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 30;
    const uid = req.user?.userId;
    if (!uid) return { notifications: [] };
    return {
      notifications: await this.svc.listNotificationsForMerchant(uid, lim),
    };
  }
}
