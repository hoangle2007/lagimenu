/**
 * OrderList — order management list for owner.
 *
 * Features:
 *  - Status filter tabs: Tất cả / Pending / Confirmed / Preparing / Ready / Completed
 *  - Order cards: table number, item count, total, status badge, time
 *  - Click to expand and show items list
 */

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { normalizeOrderStatus } from '@/lib/orderStatus'
import type { Order, OrderStatus } from '@/api/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang chuẩn bị',
  READY: 'Sẵn sàng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  PAID: 'Đã thanh toán',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-orange-100 text-orange-700',
  READY: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-red-100 text-red-600',
  PAID: 'bg-emerald-100 text-emerald-700',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff} giây trước`
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterTab = 'ALL' | OrderStatus

const TABS: FilterTab[] = ['ALL', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'PAID']

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderList() {
  const { user } = useAuth()
  const merchantId = user?.shop?.id || (user as any)?.shopId || ''
  const [filter, setFilter] = useState<FilterTab>('ALL')
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchOrders = useCallback(async (status?: FilterTab) => {
    setIsLoading(true)
    try {
      const params: { status?: string; limit?: number } = { limit: 200 }
      if (status && status !== 'ALL') params.status = status.toLowerCase()
      const { data } = await api.get('/api/orders', { params })
      const mappedOrders = (data.orders || []).map((o: any) => ({
        ...o,
        // Normalize: DB lowercase → FE UPPER_SNAKE_CASE
        _rawStatus: o.status,
        status: normalizeOrderStatus(o.status),
        tableNumber: o.tableNumber || o.table_number,
        totalAmount: Number(o.totalAmount || o.total_price || 0),
        createdAt: o.createdAt || o.created_at || new Date().toISOString(),
        items: (o.items || []).map((it: any) => ({
          ...it,
          name: it.name || it.product?.name || 'Sản phẩm',
        })),
      }))
      setOrders(mappedOrders)
    } catch {
      toast.error('Không thể tải danh sách đơn hàng.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateStatus = async (orderId: string, nextStatus: string) => {
    try {
      await api.put(`/orders/merchant/${merchantId}/${orderId}/status`, { status: nextStatus })
      toast.success('Cập nhật trạng thái thành công')
      await fetchOrders(filter)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể cập nhật trạng thái')
    }
  }

  useEffect(() => {
    void fetchOrders(filter === 'ALL' ? undefined : filter)
  }, [filter, fetchOrders])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Danh sách Đơn hàng</h1>
        <p className="mt-1 text-sm text-gray-500">
          {isLoading ? '…' : `${orders.length} đơn hàng`}
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab
                ? 'bg-surface text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'ALL' ? 'Tất cả' : STATUS_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Orders */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl bg-surface py-12 text-center shadow-sm ring-1 ring-gray-200">
          <span className="text-4xl">🍽️</span>
          <p className="mt-3 text-sm font-medium text-gray-500">Không có đơn hàng nào</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isExpanded={expandedId === order.id}
              onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
              onUpdateStatus={updateStatus}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Order Card ───────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: Order
  isExpanded: boolean
  onToggle: () => void
  onUpdateStatus: (orderId: string, nextStatus: string) => Promise<void>
}

function OrderCard({ order, isExpanded, onToggle, onUpdateStatus }: OrderCardProps) {
  const items = Array.isArray(order.items) ? order.items : []
  // Status flow: PENDING → CONFIRMED → PREPARING → READY → COMPLETED (+ CANCELLED from any)
  const nextStatusMap: Partial<Record<string, string>> = {
    PENDING:    'confirmed',
    CONFIRMED:  'preparing',
    PREPARING:  'ready',
    READY:      'completed',
  };
  const nextStatus = nextStatusMap[order.status];
  const isTerminal = ['COMPLETED', 'CANCELLED', 'PAID'].includes(order.status);

  return (
    <li className="overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-gray-200">
      {/* Summary row — always visible, clickable */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-4">
          {/* Table number */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
            {order.tableNumber ?? '—'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {items.length} món
              {order.tableNumber ? ` · Bàn ${order.tableNumber}` : ''}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">{timeAgo(order.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-900">{formatCurrency(order.totalAmount)}</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[order.status as keyof typeof STATUS_COLORS]}`}
          >
            {STATUS_LABELS[order.status as keyof typeof STATUS_LABELS]}
          </span>
          <span
            className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            ▼
          </span>
        </div>
      </button>

      {/* Expanded items list */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Chi tiết đơn hàng
          </p>
          <ul className="space-y-1.5">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {item.quantity}× {item.name}
                </span>
                <span className="text-gray-500">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-gray-200 pt-2 text-sm font-medium">
            <span>Tổng cộng</span>
            <span className="text-indigo-700">{formatCurrency(order.totalAmount)}</span>
          </div>
          {/* Action buttons for manager */}
          {!isTerminal && (
            <div className="mt-3 flex gap-2">
              {nextStatus && (
                <button
                  onClick={() => onUpdateStatus(order.id, nextStatus)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
                >
                  {nextStatus === 'confirmed' ? 'Xác nhận' :
                   nextStatus === 'preparing' ? 'Bắt đầu làm' :
                   nextStatus === 'ready' ? 'Báo xong' :
                   nextStatus === 'completed' ? 'Hoàn thành' : nextStatus}
                </button>
              )}
              <button
                onClick={() => onUpdateStatus(order.id, 'cancelled')}
                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors border border-red-200"
              >
                Hủy đơn
              </button>
              {order.status === 'COMPLETED' && (
                <button
                  onClick={() => onUpdateStatus(order.id, 'paid')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors"
                >
                  Thanh toán
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  )
}
