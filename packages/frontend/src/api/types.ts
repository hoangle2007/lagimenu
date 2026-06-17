// ─── Enums & Union Types ────────────────────────────────────────────────────

export type UserRole = 'OWNER' | 'EMPLOYEE' | 'CUSTOMER' | 'staff' | 'merchant' | 'admin' | 'owner' | 'ADMIN' | 'super_admin' | 'SUPER_ADMIN';

export type NotifType =
  | 'NEW_ORDER'
  | 'SUPPORT_REQUEST'
  | 'CHAT_MESSAGE'
  | 'SHIFT_ASSIGNED'

export type OrderStatus =
  | 'PENDING'    // Chờ xác nhận
  | 'CONFIRMED'  // Đã xác nhận
  | 'PREPARING'  // Đang chuẩn bị
  | 'READY'      // Sẵn sàng
  | 'COMPLETED'  // Hoàn thành
  | 'CANCELLED'  // Đã hủy
  | 'PAID';      // Đã thanh toán

export type SupportRequestStatus = 'OPEN' | 'RESOLVED' | 'CLOSED'

export type ShiftStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

// ─── Domain Models ─────────────────────────────────────────────────────────

export interface Shop {
  id: string
  name: string
  address?: string
  ownerId: string
  createdAt?: string
}

export interface Employee {
  id: string
  userId: string
  shopId: string
  isActive: boolean
  createdAt?: string
}

export interface User {
  id: string
  email: string
  name?: string
  phone?: string
  role: UserRole
  shop?: Shop
  createdAt?: string
  merchantId?: string
  shopId?: string
  /** Merchant onboarding: pending | approved | rejected | suspended */
  accountStatus?: string
  /** Nhân viên: phạm vi thông báo realtime / POS */
  notifyRole?: 'all' | 'waiter' | 'cashier' | 'kitchen'
}

export interface Notification {
  id: string
  type: NotifType
  title: string
  message: string
  metadata?: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

export interface OrderItem {
  id?: string
  menuItemId: string
  name: string
  price: number
  quantity: number
  note?: string
}

export interface Order {
  id: string
  shopId: string
  customerId: string
  tableNumber?: number
  items: OrderItem[]
  totalAmount: number
  status: OrderStatus
  createdAt: string
}

export interface SupportRequest {
  id: string
  shopId: string
  customerId: string
  type: string
  message: string
  tableNumber?: number
  status: SupportRequestStatus
  createdAt: string
}

export interface ChatMessage {
  id: string
  shopId: string
  senderId: string
  recipientId?: string
  message: string
  isRead: boolean
  createdAt: string
}

export interface Shift {
  id: string
  employeeId: string
  startTime: string
  endTime: string
  status: ShiftStatus
  createdAt?: string
}
