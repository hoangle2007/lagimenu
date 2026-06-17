/**
 * Phục vụ — nhận đơn mới, duyệt chuyển bếp, chờ bưng (không xử lý thanh toán).
 */
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { ordersApi } from '@/api/orders'
import { useAuth } from '@/hooks/useAuth'
import { useMerchantSocket } from '@/hooks/useMerchantSocket'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui'
import { BellRing, ChefHat, Volume2, Check, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import { warmUpVietnameseSpeech, speakVietnamese } from '@/lib/speechVi'
import { VietnameseSpeechBanner } from '@/components/VietnameseSpeechBanner'
import { vi } from '@/locales/vi'
import { Navigate } from 'react-router-dom'
import { canAccessService, getEmployeeHomePath } from '@/lib/employeeRoles'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready: 'Sẵn sàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

const NEXT_STATUS: Record<string, string> = {
  pending: 'preparing',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'completed',
}

function timeAgo(dateStr: string): string {
  let normalized = dateStr.replace(' ', 'T')
  if (!normalized.includes('Z') && !normalized.includes('+')) normalized += 'Z'
  let diff = Math.floor((Date.now() - new Date(normalized).getTime()) / 1000)
  if (Math.abs(diff - 25200) < 600) diff -= 25200
  diff = Math.max(0, diff)
  if (diff < 60) return `${diff} giây trước`
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  return new Date(normalized).toLocaleDateString('vi-VN')
}

function AudioUnlockModal({ onUnlock }: { onUnlock: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md text-center p-8 bg-slate-900 border-slate-800 text-white shadow-2xl rounded-3xl overflow-hidden border-none">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Volume2 size={40} className="text-primary animate-pulse" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-white">Kích hoạt thông báo</DialogTitle>
        </DialogHeader>
        <p className="text-slate-400 font-medium my-6">
          Bật âm thanh báo đơn mới và giọng đọc cho trình duyệt.
        </p>
        <Button
          className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-xl shadow-primary/20 text-lg"
          onClick={() => {
            setOpen(false)
            onUnlock()
          }}
        >
          Sẵn sàng phục vụ!
        </Button>
      </DialogContent>
    </Dialog>
  )
}

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed']

export default function EmployeeServiceBoard() {
  const { user } = useAuth()
  const shopId = user?.shop?.id || (user as { shopId?: string }).shopId

  const isWaiterOnly = user?.notifyRole === 'waiter'

  const {
    socketStatus,
    activeCallStaff,
    activeLoyaltyRedeems,
    activeReadyOrders,
    newOrderNotify,
    refreshTrigger,
    updatedOrder,
    clearCallStaff,
    clearOrderNotify,
    clearLoyaltyRedeem,
    clearReadyOrder,
  } = useMerchantSocket(shopId || '', { hideOrderAmounts: isWaiterOnly })

  const [orders, setOrders] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'ready'>('pending')

  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await ordersApi.list({ limit: 50 })
      const rawList: any[] = data?.orders ?? (Array.isArray(data) ? data : [])
      const mapped = rawList.map((o: any) => ({
        ...o,
        tableNumber: o.table_number ?? o.tableNumber ?? '??',
        customerName: o.customer_name ?? o.customerName ?? null,
        totalPrice: String(o.total_price ?? o.totalPrice ?? 0),
        totalAmount: Number(o.total_price ?? o.totalPrice ?? 0),
        createdAt: o.created_at ?? o.createdAt ?? new Date().toISOString(),
        items: o.items ?? [],
      }))
      const active = mapped.filter((o: any) => ACTIVE_STATUSES.includes(o.status))
      setOrders(active)
    } catch {
      /* non-critical */
    }
  }, [])

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders, refreshTrigger])

  useEffect(() => {
    if (isWaiterOnly && activeTab === 'preparing') setActiveTab('pending')
  }, [isWaiterOnly, activeTab])

  useEffect(() => {
    if (!updatedOrder?.id) return
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === updatedOrder.id)
      if (!exists) return prev
      return prev
        .map((o) => (o.id === updatedOrder.id ? { ...o, status: updatedOrder.status } : o))
        .filter((o) => ACTIVE_STATUSES.includes(o.status))
    })
  }, [updatedOrder])

  const handleStatusUpdate = async (order: any) => {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    try {
      await api.put(`/orders/${order.id}/status`, { status: next })
      setOrders((prev) =>
        prev
          .map((o) => (o.id === order.id ? { ...o, status: next } : o))
          .filter((o) => ACTIVE_STATUSES.includes(o.status)),
      )
      toast.success(`Đơn hàng đã chuyển sang "${STATUS_LABELS[next]}"`)
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      toast.error(msg || 'Không thể cập nhật trạng thái.')
    }
  }

  if (!canAccessService(user)) {
    return <Navigate to={getEmployeeHomePath(user)} replace />
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <AudioUnlockModal
        onUnlock={() => {
          warmUpVietnameseSpeech()
          speakVietnamese(vi.tts.dashboardWarmup, {
            onMissingVietnameseVoice: () =>
              window.dispatchEvent(new CustomEvent('speech-vi-missing')),
          })
        }}
      />

      <div className="px-4 lg:px-0 max-w-4xl mx-auto">
        <VietnameseSpeechBanner />
      </div>

      {(activeCallStaff.length > 0 || activeReadyOrders.length > 0 || activeLoyaltyRedeems.length > 0) && (
        <section className="space-y-3 px-4 lg:px-0">
          <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <BellRing size={14} className="text-red-500" />
            Thông báo nhanh
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeReadyOrders.map((order, idx) => (
              <div
                key={`ready-${idx}`}
                className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm"
              >
                <div>
                  <p className="font-black text-amber-900 text-sm">Mang đơn ra</p>
                  <p className="text-[10px] font-bold text-amber-800">Bàn {order.tableNumber}</p>
                </div>
                <Button
                  size="sm"
                  className="bg-amber-600 text-white font-bold uppercase text-[9px]"
                  onClick={() => clearReadyOrder(order.tableNumber)}
                >
                  Đã bưng
                </Button>
              </div>
            ))}
            {activeCallStaff.map((call, idx) => (
              <div
                key={`staff-${idx}`}
                className="bg-surface border-l-4 border-red-500 border-y border-r border-gray-200 p-4 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 text-gray-900 flex items-center justify-center font-bold text-lg border border-gray-200">
                    {call.tableNumber}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">GỌI NHÂN VIÊN</p>
                    <p className="text-[10px] text-gray-500 italic">Bàn {call.tableNumber}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-gray-900 hover:bg-black text-white font-bold uppercase text-[9px] px-4"
                  onClick={() => clearCallStaff(call.tableNumber)}
                >
                  Đã xong
                </Button>
              </div>
            ))}
            {activeLoyaltyRedeems.map((r) => (
              <div
                key={`loyre-${r.transactionId}`}
                className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-100 text-amber-900 flex items-center justify-center rounded-lg border border-amber-200">
                    <Gift size={20} />
                  </div>
                  <div>
                    <p className="font-black text-amber-950 text-sm">ĐỔI QUÀ</p>
                    <p className="text-[10px] font-bold text-amber-900/90">
                      {r.tableNumber !== '—' ? `Bàn ${r.tableNumber} · ` : ''}
                      {r.rewardTitle} (−{r.pointsCost} điểm)
                    </p>
                    <p className="text-[9px] text-amber-800 font-medium">SĐT *{r.customerPhoneLast4}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-amber-600 text-white font-bold uppercase text-[9px]"
                  onClick={() => clearLoyaltyRedeem(r.transactionId)}
                >
                  Đã giao
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col h-full min-h-[500px]">
        <div className="mb-4 rounded-2xl border border-amber-100/70 bg-gradient-to-r from-amber-50/90 via-white to-emerald-50/70 px-4 py-3 shadow-sm mx-4 lg:mx-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
              <ChefHat size={14} className="text-amber-600" />
              Phục vụ — đơn &amp; bưng bê
            </h2>
            <span
              className={cn(
                'text-[9px] font-bold uppercase px-2 py-0.5 border rounded-md shrink-0',
                socketStatus === 'connected'
                  ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
                  : 'text-amber-600 border-amber-200 bg-amber-50',
              )}
            >
              {socketStatus === 'connected' ? 'Máy chủ: Tốt' : 'Mất kết nối'}
            </span>
          </div>
        </div>

        <div className="lg:hidden flex border-b border-gray-200 mb-4 bg-surface sticky top-0 z-40">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={cn(
              'flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all',
              activeTab === 'pending'
                ? 'border-amber-500 text-amber-600 bg-amber-50/50'
                : 'border-transparent text-gray-400',
            )}
          >
            Mới ({orders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length})
          </button>
          {!isWaiterOnly && (
            <button
              type="button"
              onClick={() => setActiveTab('preparing')}
              className={cn(
                'flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all',
                activeTab === 'preparing'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-400',
              )}
            >
              Bếp ({orders.filter((o) => o.status === 'preparing').length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('ready')}
            className={cn(
              'flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all',
              activeTab === 'ready'
                ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50'
                : 'border-transparent text-gray-400',
            )}
          >
            Bưng ({orders.filter((o) => o.status === 'ready').length})
          </button>
        </div>

        <div className="flex-1 lg:-mx-4 lg:px-4 overflow-x-hidden no-scrollbar px-4 lg:px-0">
          <div className="flex flex-col lg:flex-row gap-4 h-full pb-6">
            <div className={cn('flex-1 lg:flex', activeTab === 'pending' ? 'flex' : 'hidden lg:flex')}>
              <KanbanColumn
                title="Đơn mới — duyệt cho bếp"
                count={orders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length}
                borderColor="border-amber-500"
              >
                {orders
                  .filter((o) => o.status === 'pending' || o.status === 'confirmed')
                  .map((order) => (
                    <OrderCard key={order.id} order={order} nextAction={handleStatusUpdate} color="bg-amber-500" />
                  ))}
              </KanbanColumn>
            </div>
            {!isWaiterOnly && (
              <div className={cn('flex-1 lg:flex', activeTab === 'preparing' ? 'flex' : 'hidden lg:flex')}>
                <KanbanColumn
                  title="Đang nấu (theo dõi)"
                  count={orders.filter((o) => o.status === 'preparing').length}
                  borderColor="border-blue-500"
                >
                  {orders
                    .filter((o) => o.status === 'preparing')
                    .map((order) => (
                      <OrderCard key={order.id} order={order} nextAction={handleStatusUpdate} color="bg-blue-500" readOnlyAdvance />
                    ))}
                </KanbanColumn>
              </div>
            )}
            <div className={cn('flex-1 lg:flex', activeTab === 'ready' ? 'flex' : 'hidden lg:flex')}>
              <KanbanColumn
                title="Chờ bưng"
                count={orders.filter((o) => o.status === 'ready').length}
                borderColor="border-emerald-500"
              >
                {orders
                  .filter((o) => o.status === 'ready')
                  .map((order) => (
                    <OrderCard key={order.id} order={order} nextAction={handleStatusUpdate} color="bg-emerald-500" />
                  ))}
              </KanbanColumn>
            </div>
          </div>
        </div>
      </section>

      {newOrderNotify && (
        <div className="fixed bottom-24 right-4 z-50">
          <div className="bg-surface border border-amber-200/80 shadow-2xl rounded-2xl p-4 w-[260px] flex flex-col gap-3 ring-1 ring-amber-100/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-900 uppercase">Có đơn hàng mới</span>
              <button type="button" onClick={clearOrderNotify}>
                ×
              </button>
            </div>
            <p className="font-bold text-lg">Bàn {newOrderNotify.tableNumber}</p>
            <Button
              size="sm"
              className="bg-gray-900 text-white font-bold uppercase text-[9px]"
              onClick={clearOrderNotify}
            >
              Đã xem
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function KanbanColumn({
  title,
  count,
  borderColor,
  children,
}: {
  title: string
  count: number
  borderColor: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`flex-1 min-w-[300px] flex flex-col bg-[#F8F9FA] border-t-4 ${borderColor} border-x border-b border-x-gray-200 border-b-gray-200 p-4 rounded-2xl shadow-sm`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-700 text-[11px] uppercase tracking-wider">{title}</h3>
        <span className="bg-gray-200 text-gray-600 px-2 py-0.5 text-[9px] font-bold rounded-sm">{count}</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
        {count === 0 ? (
          <div className="h-20 border border-dashed border-gray-300 flex items-center justify-center">
            <p className="text-[9px] font-bold text-gray-400 uppercase">Trống</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function OrderCard({
  order,
  nextAction,
  color,
  readOnlyAdvance,
}: {
  order: any
  nextAction: (order: any) => void
  color: string
  readOnlyAdvance?: boolean
}) {
  const next = NEXT_STATUS[order.status]
  const showButton = next && !(readOnlyAdvance && order.status === 'preparing')

  return (
    <div className="bg-surface border border-gray-200/80 p-4 shadow-md rounded-xl hover:border-gray-300 transition-all flex flex-col gap-3 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-2 h-2 ${color} rounded-bl-lg`} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-gray-100 text-gray-900 w-8 h-8 flex items-center justify-center font-bold border border-gray-200">
            {order.tableNumber}
          </span>
          <span className="text-[10px] font-bold text-gray-500 uppercase">#{order.id}</span>
        </div>
        <span className="text-[9px] text-gray-400 font-bold">{timeAgo(order.createdAt)}</span>
      </div>

      <div className="space-y-1.5 py-1 border-y border-gray-50">
        {order.items.map((item: any, idx: number) => (
          <div key={idx} className="flex gap-2">
            <span className="text-gray-400 text-[10px] font-bold">{item.quantity}x</span>
            <p className="text-[11px] font-bold text-gray-700 leading-tight">
              {item.product?.name || item.name}
            </p>
          </div>
        ))}
      </div>

      {readOnlyAdvance && order.status === 'preparing' && (
        <p className="text-[9px] font-bold text-slate-400 uppercase text-center">Bếp xử lý — chỉ theo dõi</p>
      )}

      {showButton && (
        <button
          type="button"
          onClick={() => nextAction(order)}
          className={cn(
            'w-full h-9 text-white font-bold uppercase text-[9px] tracking-widest transition-colors',
            color,
            color.replace('bg-', 'hover:bg-').replace('500', '600'),
          )}
        >
          {order.status === 'pending' || order.status === 'confirmed'
            ? 'Duyệt cho bếp'
            : order.status === 'preparing'
              ? 'Báo đã xong'
              : 'Hoàn thành'}
        </button>
      )}

      {order.status === 'completed' && (
        <div className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50 text-emerald-600 font-black text-[10px] uppercase tracking-widest rounded-lg border border-emerald-100">
          <Check size={14} /> Xong
        </div>
      )}
    </div>
  )
}
