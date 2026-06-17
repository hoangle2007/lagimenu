import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { sql } from '../db/index';

/**
 * Blocks merchant JWT access when account_status is not approved.
 * Skips non-merchant roles and unauthenticated requests.
 */
@Injectable()
export class ApprovedMerchantGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const url: string = req.originalUrl || req.url || '';
    if (
      url.includes('/auth/') ||
      url.includes('/public/') ||
      url.includes('/push-subscriptions/vapid-public-key')
    ) {
      return true;
    }

    if (req.method === 'GET' && /\/api\/menu\/[^/]+$/.test(url)) {
      return true;
    }

    const user = req.user;
    if (!user) return true;

    const role = user.role as string;
    if (role === 'super_admin' || role === 'admin' || role === 'EMPLOYEE') {
      return true;
    }

    if (role !== 'merchant') return true;

    const shopId = user.shopId || user.sub;
    if (!shopId) return true;

    const rows = (await sql`
      SELECT COALESCE(account_status, 'approved') AS s FROM merchants WHERE id = ${shopId}
    `) as unknown as { s: string }[];
    const status = rows[0]?.s ?? 'approved';
    if (status === 'approved') return true;

    throw new ForbiddenException({
      message:
        status === 'pending'
          ? 'Tài khoản đang chờ duyệt'
          : status === 'rejected'
            ? 'Tài khoản đã bị từ chối'
            : status === 'suspended'
              ? 'Tài khoản đã bị tạm ngưng'
              : 'Tài khoản không hoạt động',
      code: 'MERCHANT_NOT_APPROVED',
      status,
    });
  }
}
