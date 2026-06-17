/**
 * Order Status Normalization Layer
 *
 * DB uses lowercase_underscore:  'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled', 'paid'
 * Frontend uses UPPER_SNAKE_CASE: 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'PAID'
 *
 * This module provides bidirectional conversion so the frontend type system and
 * UI components always work with UPPER_SNAKE_CASE while the API sends/receives
 * lowercase_underscore.
 */

import type { OrderStatus } from '@/api/types';

// ─── Conversion Maps ──────────────────────────────────────────────────────────

const DB_TO_FRONTEND: Record<string, OrderStatus> = {
  pending:    'PENDING',
  confirmed:  'CONFIRMED',
  preparing:  'PREPARING',
  ready:      'READY',
  completed:  'COMPLETED',
  cancelled:  'CANCELLED',
  paid:       'PAID',
};

const FE_TO_DB: Record<OrderStatus, string> = {
  PENDING:    'pending',
  CONFIRMED:  'confirmed',
  PREPARING:  'preparing',
  READY:     'ready',
  COMPLETED:  'completed',
  CANCELLED:  'cancelled',
  PAID:       'paid',
};

// ─── Public API ──────────────────────────────────────────────────────────────

/** Convert DB/API status (lowercase_underscore) → Frontend type (UPPER_SNAKE_CASE) */
export function normalizeOrderStatus(dbStatus: string | undefined | null): OrderStatus {
  if (!dbStatus) return 'PENDING';
  return DB_TO_FRONTEND[dbStatus.toLowerCase()] ?? 'PENDING';
}

/** Convert Frontend type (UPPER_SNAKE_CASE) → DB/API value (lowercase_underscore) */
export function toDbStatus(feStatus: OrderStatus): string {
  return FE_TO_DB[feStatus];
}

// ─── Derived helpers ─────────────────────────────────────────────────────────

/** Labels for each status (Vietnamese) */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING:    'Chờ xác nhận',
  CONFIRMED:  'Đã xác nhận',
  PREPARING:  'Đang chuẩn bị',
  READY:      'Sẵn sàng',
  COMPLETED:  'Hoàn thành',
  CANCELLED:  'Đã hủy',
  PAID:       'Đã thanh toán',
};

/** CSS classes for status badges */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING:    'bg-yellow-100 text-yellow-700',
  CONFIRMED:  'bg-blue-100 text-blue-700',
  PREPARING:  'bg-orange-100 text-orange-700',
  READY:      'bg-green-100 text-green-700',
  COMPLETED:  'bg-gray-100 text-gray-500',
  CANCELLED:  'bg-red-100 text-red-600',
  PAID:       'bg-emerald-100 text-emerald-700',
};

/** Valid status transitions (FE types) */
export const VALID_FE_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING:    ['CONFIRMED', 'PREPARING', 'CANCELLED'],
  CONFIRMED:  ['PREPARING', 'CANCELLED'],
  PREPARING:  ['READY',     'CANCELLED'],
  READY:      ['COMPLETED', 'CANCELLED'],
  COMPLETED:  ['PAID'],
  PAID:       [],
  CANCELLED:  [],
};

/** Human-readable next-action labels for employees */
export const ORDER_STATUS_ACTIONS: Partial<Record<OrderStatus, string>> = {
  PENDING:   'Nhận đơn',
  CONFIRMED: 'Bắt đầu làm',
  PREPARING: 'Báo xong',
  READY:     'Phục vụ',
};

/** Which statuses are "terminal" (no further transitions allowed) */
export const TERMINAL_STATUSES: OrderStatus[] = ['PAID', 'CANCELLED'];

/** Which statuses count as "active" (show in kitchen/active-order screens) */
export const ACTIVE_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'];
