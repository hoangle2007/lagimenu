import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  /** GET /api/merchants/:id/order-guard — public: whether customer must send GPS */
  @Get(':id/order-guard')
  async getOrderGuard(@Param('id') id: string) {
    return this.merchantsService.getOrderGuardConfig(id);
  }

  /** GET /api/merchants/:id/payment-info — VietQR / display (no secrets beyond public bank fields) */
  @Get(':id/payment-info')
  async getPaymentInfo(@Param('id') id: string) {
    return this.merchantsService.getPaymentInfo(id);
  }

  /** GET /api/merchants/:id/blocked-ips */
  @Get(':id/blocked-ips')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  async listBlockedIps(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId || shopId !== id)
      throw new ForbiddenException('Cannot view other shop');
    return { blockedIps: await this.merchantsService.listBlockedIps(id) };
  }

  /** POST /api/merchants/:id/blocked-ips { ip, note? } */
  @Post(':id/blocked-ips')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  async addBlockedIp(
    @Param('id') id: string,
    @Body() body: { ip?: string; note?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId || shopId !== id)
      throw new ForbiddenException('Cannot update other shop');
    return this.merchantsService.addBlockedIp(
      id,
      String(body?.ip ?? '').trim(),
      body?.note ?? null,
    );
  }

  /** DELETE /api/merchants/:id/blocked-ips/:blockId */
  @Delete(':id/blocked-ips/:blockId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  async removeBlockedIp(
    @Param('id') id: string,
    @Param('blockId') blockId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId || shopId !== id)
      throw new ForbiddenException('Cannot update other shop');
    return this.merchantsService.removeBlockedIp(id, blockId);
  }

  /** PATCH /api/merchants/:id/settings — WiFi, timezone (merchant JWT) */
  @Patch(':id/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  async patchSettings(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId || shopId !== id)
      throw new ForbiddenException('Cannot update other shop');
    return this.merchantsService.patchSettings(id, {
      wifi_ssid: body.wifi_ssid as string | undefined,
      wifi_password: body.wifi_password as string | undefined,
      timezone: body.timezone as string | undefined,
      opening_hours_json: body.opening_hours_json as string | null | undefined,
      feature_flags_json: body.feature_flags_json as string | null | undefined,
    });
  }

  /** GET /api/merchants/:id/staff-invites */
  @Get(':id/staff-invites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  async listStaffInvites(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId || shopId !== id)
      throw new ForbiddenException('Cannot view other shop');
    return { invites: await this.merchantsService.listStaffInvites(id) };
  }

  /** POST /api/merchants/:id/staff-invites { email, role } */
  @Post(':id/staff-invites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('merchant')
  async createStaffInvite(
    @Param('id') id: string,
    @Body() body: { email: string; role?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const shopId = req.user?.shopId;
    if (!shopId || shopId !== id)
      throw new ForbiddenException('Cannot update other shop');
    const role = ['cashier', 'waiter', 'kitchen'].includes(String(body?.role))
      ? String(body.role)
      : 'waiter';
    const invite = await this.merchantsService.createStaffInvite(
      id,
      String(body?.email ?? '').trim(),
      role,
    );
    return { invite };
  }

  /** GET /api/merchants/:id/customers */
  @Get(':id/customers')
  async getCustomers(@Param('id') id: string) {
    return this.merchantsService.getCustomers(id);
  }

  /** GET /api/merchants/:id */
  @Get(':id')
  async getMerchant(@Param('id') id: string) {
    return this.merchantsService.getMerchant(id);
  }

  /** PATCH /api/merchants/:id */
  @Patch(':id')
  async updateMerchant(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.merchantsService.updateMerchant(id, body);
  }
}
