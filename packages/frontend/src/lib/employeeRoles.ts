import type { User } from '@/api/types'

export type StaffNotifyRole = NonNullable<User['notifyRole']>

export function canAccessKitchen(user: User | null | undefined): boolean {
  const r = user?.notifyRole
  return r === 'kitchen' || r === 'all'
}

export function canAccessService(user: User | null | undefined): boolean {
  const r = user?.notifyRole
  return r === 'waiter' || r === 'all'
}

export function canAccessCashier(user: User | null | undefined): boolean {
  const r = user?.notifyRole
  return r === 'cashier' || r === 'all'
}

/** Trang tổng hợp đầy đủ — chỉ role `all` (hoặc chưa gán notifyRole). */
export function canAccessFullDashboard(user: User | null | undefined): boolean {
  const r = user?.notifyRole
  return r === 'all' || r === undefined
}

/** Sau đăng nhập /employee */
export function getDefaultEmployeePath(notifyRole: StaffNotifyRole | undefined): string {
  switch (notifyRole) {
    case 'waiter':
      return '/employee/service'
    case 'kitchen':
      return '/employee/kitchen'
    case 'cashier':
      return '/employee/cashier'
    case 'all':
    default:
      return '/employee/dashboard'
  }
}

export function getEmployeeHomePath(user: User | null | undefined): string {
  return getDefaultEmployeePath(user?.notifyRole)
}
