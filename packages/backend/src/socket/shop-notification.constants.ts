/** Sub-rooms under merchant:{shopId}:staff:{role} — must match Employee.notifyRole */
export const STAFF_NOTIFY_ROLES = [
  'all',
  'waiter',
  'cashier',
  'kitchen',
] as const;
export type StaffNotifyRole = (typeof STAFF_NOTIFY_ROLES)[number];

const SET = new Set<string>(STAFF_NOTIFY_ROLES);

export function normalizeStaffNotifyRole(value: unknown): StaffNotifyRole {
  if (typeof value === 'string' && SET.has(value))
    return value as StaffNotifyRole;
  return 'all';
}

/** Extra staff rooms (always includes implicit broadcast to staff:all in gateway). */
export function staffRoomSuffixesForSocketEvent(
  event: string,
): StaffNotifyRole[] {
  switch (event) {
    case 'newOrder':
      return ['waiter'];
    case 'callStaff':
      return ['waiter'];
    case 'callPayment':
      return ['cashier'];
    case 'loyaltyPayRequest':
      return ['waiter', 'cashier'];
    case 'loyaltyRedeem':
      return ['waiter', 'cashier'];
    case 'paymentPendingVerification':
      return ['cashier'];
    case 'orderStatusUpdated':
    case 'readyToServe':
      return ['waiter', 'cashier', 'kitchen'];
    default:
      return ['waiter', 'cashier', 'kitchen'];
  }
}
