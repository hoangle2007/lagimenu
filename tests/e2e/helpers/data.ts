/**
 * Data helpers — seed and teardown test fixtures via the API.
 * All functions require a valid owner token unless noted.
 */

import { api, type LoginResponse } from './auth'

// ─── Employee helpers ─────────────────────────────────────────────────────────────────

export async function createEmployee(
  ownerToken: string,
  opts: {
    name: string
    email: string
    password: string
    pin: string
    phone?: string
    notifyRole?: 'all' | 'waiter' | 'cashier' | 'kitchen'
  }
) {
  return api.post<{
    employee: { id: string; name: string; email: string; isActive: boolean; notifyRole: string }
  }>('/api/employees', opts, ownerToken)
}

export async function deactivateEmployee(ownerToken: string, employeeId: string) {
  return api.del(`/api/employees/${employeeId}`, ownerToken)
}

export async function addShift(
  ownerToken: string,
  employeeId: string,
  opts: { date: string; startTime: string; endTime: string }
) {
  const startTime = `${opts.date}T${opts.startTime}:00.000Z`
  const endTime = `${opts.date}T${opts.endTime}:00.000Z`
  return api.post<{ shift: { id: string; startTime: string; endTime: string; status: string } }>(
    `/api/employees/${employeeId}/shifts`,
    { startTime, endTime },
    ownerToken
  )
}

// ─── Order helpers ─────────────────────────────────────────────────────────────────

export async function createOrder(
  token: string,
  opts: {
    shopId: string
    items: Array<{ name: string; qty: number; price: number }>
    tableNumber?: string
  }
) {
  const totalAmount = opts.items.reduce((sum, i) => sum + i.qty * i.price, 0)
  return api.post<{ order: { id: string; status: string; totalAmount: number } }>(
    '/api/orders',
    { shopId: opts.shopId, items: opts.items, tableNumber: opts.tableNumber, totalAmount },
    token
  )
}

export async function updateOrderStatus(
  token: string,
  orderId: string,
  status: string
) {
  return api.put<{ order: { id: string; status: string } }>(
    `/api/orders/${orderId}/status`,
    { status },
    token
  )
}

export async function listOrders(token: string) {
  return api.get<{ orders: Array<{ id: string; status: string }> }>('/api/orders', token)
}

// ─── Support request helpers ─────────────────────────────────────────────────────────

export async function createSupportRequest(
  token: string,
  opts: {
    shopId: string
    type: string
    message: string
    tableNumber?: string
  }
) {
  return api.post<{ request: { id: string; status: string; type: string } }>(
    '/api/support',
    opts,
    token
  )
}

export async function updateSupportStatus(
  token: string,
  ticketId: string,
  status: string
) {
  return api.put<{ request: { id: string; status: string } }>(
    `/api/support/${ticketId}/status`,
    { status },
    token
  )
}

// ─── Notification helpers ─────────────────────────────────────────────────────────

/**
 * Get all notifications for a user (newest first).
 * Note: there is no POST /api/notifications endpoint — notifications are only
 * created via business flows (orders, support, chat).
 */
export async function getNotifications(token: string) {
  return api.get<{ notifications: Array<{ id: string; isRead: boolean; type: string; title: string }> }>(
    '/api/notifications',
    token
  )
}

/**
 * Mark all notifications as read for the authenticated user.
 */
export async function markAllNotificationsRead(token: string) {
  return api.put<{ count: number }>('/api/notifications/read-all', {}, token)
}

// ─── Unique test ID helpers ─────────────────────────────────────────────────────────

const PREFIX = `e2e_${Date.now()}_`

export function uniqueEmail(role = 'test') {
  return `${PREFIX}${role}_${Math.random().toString(36).slice(2)}@lagi.test`
}

export function uniqueName(role = 'Test') {
  return `${role} ${PREFIX.slice(0, 8)}`
}

export function uniquePin() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

export function uniqueShopName() {
  return `Shop ${PREFIX.slice(0, 8)}`
}
