/**
 * EmployeeDashboard — employee view with notification feed + active orders.
 *
 * Features:
 *  - Notification feed (from useNotifications) — full width, scrollable
 *  - Active orders panel — orders with status PENDING|CONFIRMED|PREPARING
 *  - Order status quick-update buttons
 */

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { ordersApi } from '@/api/orders'
import { useAuth } from '@/hooks/useAuth'
import { useMerchantSocket } from '@/hooks/useMerchantSocket'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui'
import { PaymentMethodModal } from '@/components/PaymentMethodModal'
import { BellRing, ChefHat, Loader2, Volume2, Check, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import { warmUpVietnameseSpeech, speakVietnamese } from '@/lib/speechVi'
import { VietnameseSpeechBanner } from '@/components/VietnameseSpeechBanner'
import { vi } from '@/locales/vi'
import { Navigate } from 'react-router-dom'
import { canAccessFullDashboard, getDefaultEmployeePath } from '@/lib/employeeRoles'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending:   'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready:     'Sẵn sàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}



const NEXT_STATUS: Record<string, string> = {
  pending:   'preparing',
  confirmed: 'preparing',
  preparing: 'ready',
  ready:     'completed',
}

function timeAgo(dateStr: string): string {
  let normalized = dateStr.replace(' ', 'T');
  if (!normalized.includes('Z') && !normalized.includes('+')) {
    normalized += 'Z';
  }
  let diff = Math.floor((Date.now() - new Date(normalized).getTime()) / 1000);
  
  // Fuzzy fix for 7h offset (Vietnam)
  if (Math.abs(diff - 25200) < 600) diff -= 25200;
  diff = Math.max(0, diff);

  if (diff < 60) return `${diff} giây trước`
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  return new Date(normalized).toLocaleDateString('vi-VN')
}

// ─── Audio Unlock Modal ───────────────────────────────────────────────────────

function AudioUnlockModal({ onUnlock }: { onUnlock: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md text-center p-8 bg-slate-900 border-slate-800 text-white shadow-2xl rounded-3xl overflow-hidden border-none">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Volume2 size={40} className="text-primary animate-pulse" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-white">Kích hoạt thông báo</DialogTitle>
        </DialogHeader>
        <p className="text-slate-400 font-medium my-6">Vui lòng nhấn nút bên dưới để bật âm thanh báo đơn mới và giọng nói cho trình duyệt.</p>
        <Button 
          className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-xl shadow-primary/20 text-lg"
          onClick={() => { setOpen(false); onUnlock(); }}
        >
          Sẵn sàng phục vụ!
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed']

export default function EmployeeDashboard() {
  const { user } = useAuth()
  const shopId = user?.shop?.id || (user as any)?.shopId

  const { 
    socketStatus, 
    activeCallStaff, 
    activeCallPayment,
    activeLoyaltyRedeems,
    activeReadyOrders,
    newOrderNotify, 
    refreshTrigger,
    updatedOrder,
    clearCallStaff,
    clearCallPayment,
    clearLoyaltyRedeem,
    clearOrderNotify,
    clearReadyOrder,
  } = useMerchantSocket(shopId || '')

  const [orders, setOrders] = useState<any[]>([])
  const [payingTable, setPayingTable] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<{
    id: number
    tableNumber: string
    totalPrice: string | number
  } | null>(null)
  const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'ready'>('pending')

  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await ordersApi.list({ limit: 50 })
      // Backend returns { orders: [...] } — extract array and map snake_case fields
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
      // Filter to only active orders (backend uses lowercase statuses)
      const active = mapped.filter((o: any) => ACTIVE_STATUSES.includes(o.status))
      setOrders(active)
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders, refreshTrigger])

  // Real-time in-place update: when socket emits orderStatusUpdated,
  // update the order status immediately without a full refetch
  useEffect(() => {
    if (!updatedOrder?.id) return;
    setOrders(prev => {
      const exists = prev.some(o => o.id === updatedOrder.id);
      if (!exists) return prev; // not in current list, ignore
      return prev
        .map(o => o.id === updatedOrder.id ? { ...o, status: updatedOrder.status } : o)
        .filter(o => ACTIVE_STATUSES.includes(o.status)); // remove if completed/paid/cancelled
    });
  }, [updatedOrder]);

  const handleStatusUpdate = async (order: any) => {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    try {
      // Use the standard endpoint which extracts shopId from JWT
      // and is now aligned with the 'staff' role in backend
      await api.put(`/orders/${order.id}/status`, { status: next })
      
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: next } : o))
          .filter((o) => ACTIVE_STATUSES.includes(o.status))
      )
      toast.success(`Đơn hàng đã chuyển sang "${STATUS_LABELS[next]}"`)
    } catch (err: any) {
      console.error('[EmployeeDashboard] Status update failed:', err);
      toast.error(err.response?.data?.message || 'Không thể cập nhật trạng thái.')
    }
  }

  const handlePayTable = async (tableNumber: string) => {
    if (!shopId) return;
    
    // Find active orders for this table to get total amount
    const tableOrders = orders.filter(o => o.tableNumber === tableNumber);
    const total = tableOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    
    if (total === 0) {
      // Just clear if no amount
      setPayingTable(tableNumber);
      try {
        await api.post(`/orders/merchant/${shopId}/table/${tableNumber}/pay`);
        clearCallStaff(tableNumber);
        clearCallPayment(tableNumber);
        toast.success(`Đã dọn bàn ${tableNumber}`);
      } finally {
        setPayingTable(null);
      }
      return;
    }

    const first = tableOrders[0]
    if (!first?.id) return
    setPaymentOrder({
      id: first.id,
      tableNumber,
      totalPrice: String(total),
    })
  };

  if (user && !canAccessFullDashboard(user)) {
    return <Navigate to={getDefaultEmployeePath(user.notifyRole)} replace />
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

      <div className="px-4 lg:px-0 max-w-4xl mx-auto space-y-3">
        <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-800 via-slate-700 to-primary/90 px-4 py-3 text-white shadow-md">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Nhân viên · toàn quyền</p>
          <h1 className="text-lg font-black tracking-tight">Tổng quan vận hành</h1>
        </div>
        <VietnameseSpeechBanner />
      </div>
      
      {shopId && (
        <PaymentMethodModal
          open={!!paymentOrder}
          onClose={() => {
            setPaymentOrder(null)
            void fetchOrders()
          }}
          merchantId={shopId}
          order={paymentOrder}
        />
      )}

      {/* ─── TOP SECTION: TABLE REQUESTS ─── */}
      {(activeCallStaff.length > 0 || activeCallPayment.length > 0 || activeLoyaltyRedeems.length > 0 || activeReadyOrders.length > 0) && (
        <section className="space-y-3 px-4 lg:px-0">
          <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <BellRing size={14} className="text-red-500" />
            Yêu cầu cần xử lý
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeReadyOrders.map((order, idx) => (
              <div key={`ready-${idx}`} className="bg-surface border-l-4 border-amber-500 border-y border-r border-gray-200 p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-50 text-amber-900 flex items-center justify-center font-bold text-lg border border-amber-200">
                    {order.tableNumber}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">CHỜ BƯNG</p>
                    <p className="text-[10px] text-gray-500 italic">Bàn {order.tableNumber}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase text-[9px] px-4"
                  onClick={() => clearReadyOrder(order.tableNumber)}
                >
                  Đã bưng
                </Button>
              </div>
            ))}
            {activeCallStaff.map((call, idx) => (
              <div key={`staff-${idx}`} className="bg-surface border-l-4 border-red-500 border-y border-r border-gray-200 p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-gray-100 text-gray-900 flex items-center justify-center font-bold text-lg border border-gray-200">
                     {call.tableNumber}
                   </div>
                   <div>
                     <p className="font-bold text-gray-900 text-sm">GỌI NHÂN VIÊN</p>
                     <p className="text-[10px] text-gray-500 italic">Bàn {call.tableNumber} cần hỗ trợ</p>
                   </div>
                </div>
                <Button 
                  size="sm"
                  className="bg-gray-900 hover:bg-black text-white font-bold uppercase text-[9px] px-4" 
                  onClick={() => clearCallStaff(call.tableNumber)}
                >Đã xong</Button>
              </div>
            ))}

            {activeCallPayment.map((call, idx) => {
              const tier = call.loyaltyPaymentMethod
                ? 'loyalty'
                : call.paymentPreference
                  ? 'pref'
                  : 'bill';
              const borderL =
                tier === 'loyalty'
                  ? 'border-l-violet-500'
                  : tier === 'pref'
                    ? 'border-l-sky-500'
                    : 'border-l-emerald-500';
              const headline =
                tier === 'loyalty'
                  ? 'TÍCH ĐIỂM / TT'
                  : tier === 'pref'
                    ? 'GỌI TT + HÌNH THỨC'
                    : 'YÊU CẦU BILL';
              const sub =
                call.loyaltyPaymentMethod === 'bank_qr'
                  ? `Bàn ${call.tableNumber} — QR ngân hàng`
                  : call.loyaltyPaymentMethod === 'at_table'
                    ? `Bàn ${call.tableNumber} — thu ngân tại bàn`
                    : call.paymentPreference === 'bank_qr'
                      ? `Bàn ${call.tableNumber} — QR ngân hàng`
                      : call.paymentPreference === 'at_table'
                        ? `Bàn ${call.tableNumber} — thu ngân tại bàn`
                        : `Bàn ${call.tableNumber} muốn thanh toán`;
              return (
              <div
                key={`pay-${idx}`}
                className={`bg-surface border-y border-r border-gray-200 p-4 flex items-center justify-between shadow-sm border-l-4 ${borderL}`}
              >
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-gray-100 text-gray-900 flex items-center justify-center font-bold text-lg border border-gray-200">
                     {call.tableNumber}
                   </div>
                   <div>
                     <p className="font-bold text-gray-900 text-sm">
                       {headline}
                     </p>
                     <p className="text-[10px] text-gray-500 italic">
                       {sub}
                     </p>
                   </div>
                </div>
                <Button 
                  size="sm"
                  variant="outline" 
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 font-bold uppercase text-[9px]" 
                  onClick={() => handlePayTable(call.tableNumber)}
                  disabled={payingTable === call.tableNumber}
                >
                  {payingTable === call.tableNumber ? <Loader2 size={12} className="animate-spin" /> : 'Xong'}
                </Button>
              </div>
            );
            })}

            {activeLoyaltyRedeems.map((r) => (
              <div
                key={`loyre-${r.transactionId}`}
                className="bg-surface border-l-4 border-amber-500 border-y border-r border-gray-200 p-4 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-50 text-amber-900 flex items-center justify-center border border-amber-200 rounded-lg">
                    <Gift size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">ĐỔI QUÀ TÍCH ĐIỂM</p>
                    <p className="text-[10px] text-gray-600">
                      {r.tableNumber !== '—' ? `Bàn ${r.tableNumber} · ` : ''}
                      {r.rewardTitle} (−{r.pointsCost} điểm) · SĐT *{r.customerPhoneLast4}
                    </p>
                    <p className="text-[9px] text-amber-800 font-bold mt-0.5">Điểm còn khách: {r.newBalance}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase text-[9px] px-4"
                  onClick={() => clearLoyaltyRedeem(r.transactionId)}
                >
                  Đã giao quà
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── KANBAN BOARD SECTION ─── */}
      <section className="flex flex-col h-full min-h-[500px]">
        <div className="mb-4 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-primary/5 px-4 py-3 shadow-sm mx-4 lg:mx-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
              <ChefHat size={14} className="text-primary" />
              Theo dõi đơn hàng
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

        {/* Tab Switcher (Mobile Only) */}
        <div className="lg:hidden flex border-b border-gray-200 mb-4 bg-surface sticky top-0 z-40">
           <button 
             onClick={() => setActiveTab('pending')}
             className={cn(
               "flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
               activeTab === 'pending' ? "border-amber-500 text-amber-600 bg-amber-50/50" : "border-transparent text-gray-400"
             )}
           >
             Mới ({orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length})
           </button>
           <button 
             onClick={() => setActiveTab('preparing')}
             className={cn(
               "flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
               activeTab === 'preparing' ? "border-blue-500 text-blue-600 bg-blue-50/50" : "border-transparent text-gray-400"
             )}
           >
             Nấu ({orders.filter(o => o.status === 'preparing').length})
           </button>
           <button 
             onClick={() => setActiveTab('ready')}
             className={cn(
               "flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all",
               activeTab === 'ready' ? "border-emerald-500 text-emerald-600 bg-emerald-50/50" : "border-transparent text-gray-400"
             )}
           >
             Bưng ({orders.filter(o => o.status === 'ready').length})
           </button>
        </div>

        {/* Kanban Columns Wrapper */}
        <div className="flex-1 lg:-mx-4 lg:px-4 overflow-x-hidden no-scrollbar px-4 lg:px-0">
          <div className="flex flex-col lg:flex-row gap-4 h-full pb-6">
            
            {/* COLUMN: INCOMING / PENDING */}
            <div className={cn("flex-1 lg:flex", activeTab === 'pending' ? 'flex' : 'hidden lg:flex')}>
              <KanbanColumn 
                title="Đơn mới" 
                count={orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length}
                borderColor="border-amber-500"
              >
                {orders.filter(o => o.status === 'pending' || o.status === 'confirmed').map(order => (
                  <OrderCard key={order.id} order={order} nextAction={handleStatusUpdate} color="bg-amber-500" />
                ))}
              </KanbanColumn>
            </div>

            {/* COLUMN: PREPARING */}
            <div className={cn("flex-1 lg:flex", activeTab === 'preparing' ? 'flex' : 'hidden lg:flex')}>
              <KanbanColumn 
                title="Đang nấu" 
                count={orders.filter(o => o.status === 'preparing').length}
                borderColor="border-blue-500"
              >
                {orders.filter(o => o.status === 'preparing').map(order => (
                  <OrderCard key={order.id} order={order} nextAction={handleStatusUpdate} color="bg-blue-500" />
                ))}
              </KanbanColumn>
            </div>

            {/* COLUMN: READY */}
            <div className={cn("flex-1 lg:flex", activeTab === 'ready' ? 'flex' : 'hidden lg:flex')}>
              <KanbanColumn 
                title="Chờ bưng" 
                count={orders.filter(o => o.status === 'ready').length}
                borderColor="border-emerald-500"
              >
                {orders.filter(o => o.status === 'ready').map(order => (
                  <OrderCard key={order.id} order={order} nextAction={handleStatusUpdate} color="bg-emerald-500" />
                ))}
              </KanbanColumn>
            </div>

          </div>
        </div>
      </section>

      {/* Floating New Order Alert */}
      {newOrderNotify && (
         <div className="fixed bottom-24 right-4 z-50">
           <div className="bg-surface border border-slate-200/80 shadow-2xl rounded-2xl p-4 w-[260px] flex flex-col gap-3 ring-1 ring-primary/10">
             <div className="flex items-center justify-between">
               <span className="text-[10px] font-bold text-gray-900 uppercase">Có đơn hàng mới</span>
               <button onClick={clearOrderNotify}>×</button>
             </div>
             <p className="font-bold text-lg">Bàn {newOrderNotify.tableNumber}</p>
             <Button size="sm" className="bg-gray-900 text-white font-bold uppercase text-[9px]" onClick={clearOrderNotify}>Đã xem</Button>
           </div>
         </div>
      )}
    </div>
  )
}

// ─── KANBAN COMPONENTS ────────────────────────────────────────────────────────

function KanbanColumn({ title, count, borderColor, children }: { title: string, count: number, borderColor: string, children: React.ReactNode }) {
  return (
    <div className={`flex-1 min-w-[300px] flex flex-col bg-[#F8F9FA] border-t-4 ${borderColor} border-x border-b border-x-gray-200 border-b-gray-200 p-4 rounded-2xl shadow-sm`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-700 text-[11px] uppercase tracking-wider">{title}</h3>
        <span className="bg-gray-200 text-gray-600 px-2 py-0.5 text-[9px] font-bold rounded-sm">
          {count}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
        {count === 0 ? (
          <div className="h-20 border border-dashed border-gray-300 flex items-center justify-center">
             <p className="text-[9px] font-bold text-gray-400 uppercase">Trống</p>
          </div>
        ) : children}
      </div>
    </div>
  )
}

function OrderCard({ order, nextAction, color }: { order: any, nextAction: (order: any) => void, color: string }) {
  const next = NEXT_STATUS[order.status]
  
  return (
    <div className="bg-surface border border-gray-200/80 p-4 shadow-md rounded-xl hover:border-gray-300 transition-all flex flex-col gap-3 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-2 h-2 ${color} rounded-bl-lg`} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-gray-100 text-gray-900 w-8 h-8 flex items-center justify-center font-bold border border-gray-200">{order.tableNumber}</span>
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

      {next && (
        <button 
          onClick={() => nextAction(order)}
          className={cn(
            "w-full h-9 text-white font-bold uppercase text-[9px] tracking-widest transition-colors",
            color,
            color.replace('bg-', 'hover:bg-').replace('500', '600')
          )}
        >
          {order.status === 'pending' || order.status === 'confirmed' ? 'Duyệt cho bếp' : 
           order.status === 'preparing' ? 'Báo đã xong' : 
           'Hoàn thành'}
        </button>
      )}
      
      {order.status === 'completed' && (
        <div className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50 text-emerald-600 font-black text-[10px] uppercase tracking-widest rounded-lg border border-emerald-100">
          <Check size={14} /> Khách đang dùng
        </div>
      )}
    </div>
  )
}
