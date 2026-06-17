import { api } from './client'
import type { Order, OrderItem, OrderStatus } from './types'

export interface CreateOrderBody {
  shopId: string
  tableNumber?: string
  items: Omit<OrderItem, 'id'>[]
  totalAmount: number
}

export const ordersApi = {
  create: (data: CreateOrderBody) =>
    api.post<{ order: Order }>('/api/orders', data),

  list: (params?: { status?: OrderStatus; limit?: number }) =>
    api.get<{ orders: Order[] }>('/api/orders', { params }),

  getById: (id: string) =>
    api.get<{ order: Order }>(`/api/orders/${id}`),

  updateStatus: (id: string, status: OrderStatus) =>
    api.put<{ order: Order }>(`/api/orders/${id}/status`, { status }),

  // Gửi thông báo cho nhân viên mang đơn ra bàn
  notifyReady: (merchantId: string, orderId: number, tableNumber: string) =>
    api.post(`/orders/merchant/${merchantId}/${orderId}/notify-ready`, { tableNumber }),
}
