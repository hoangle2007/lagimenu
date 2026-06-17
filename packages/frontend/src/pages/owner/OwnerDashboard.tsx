/**
 * OwnerDashboard — overview stats + recent notifications feed.
 *
 * Stats fetched on mount:
 *  - Today's order count
 *  - Pending support requests count
 *  - Active employees count
 *
 * Recent notifications: last 10 via useNotifications.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ordersApi } from '@/api/orders'
import { supportApi } from '@/api/support'
import { employeesApi } from '@/api/employees'
import { useAuth } from '@/hooks/useAuth'
import { useMerchantSocket } from '@/hooks/useMerchantSocket'
import { Bell } from 'lucide-react'
import type { SupportRequestStatus } from '@/api/types'

interface Stats {
  ordersToday: number
  pendingSupport: number
  activeEmployees: number
}

function StatCard({
  label,
  value,
  icon,
  onClick,
  color,
}: {
  label: string
  value: number | string
  icon: string
  onClick?: () => void
  color: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full rounded-xl bg-surface p-5 text-left shadow-sm ring-1 ring-gray-200 transition-shadow hover:shadow-md ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
        </div>
        <span className="text-3xl" aria-hidden="true">{icon}</span>
      </div>
      {onClick && (
        <p className="mt-2 text-xs text-indigo-600">Xem chi tiết →</p>
      )}
    </button>
  )
}

export default function OwnerDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const shopId = user?.shop?.id || (user as any)?.shopId
  
  const { 
    activeCallStaff, 
    activeCallPayment,
    activeLoyaltyRedeems,
    newOrderNotify,
    refreshTrigger
  } = useMerchantSocket(shopId || '')

  const [stats, setStats] = useState<Stats>({
    ordersToday: 0,
    pendingSupport: 0,
    activeEmployees: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setIsLoading(true)
      try {
        const today = new Date().toISOString().split('T')[0]

        const [ordersRes, supportRes, employeesRes] = await Promise.allSettled([
          ordersApi.list({ limit: 100 }),
          supportApi.list({ status: 'OPEN' as SupportRequestStatus }),
          employeesApi.list({ active: true }),
        ])

        const orders = ordersRes.status === 'fulfilled' ? ordersRes.value.data.orders : []
        const todayOrders = orders.filter((o: { createdAt: string }) =>
          o.createdAt.startsWith(today)
        )

        const pending = supportRes.status === 'fulfilled'
          ? supportRes.value.data.requests.length
          : 0
        const activeEmp = employeesRes.status === 'fulfilled'
          ? employeesRes.value.data.employees.length
          : 0

        setStats({
          ordersToday: todayOrders.length,
          pendingSupport: pending,
          activeEmployees: activeEmp,
        })
      } catch {
        // non-critical — show 0 on error
      } finally {
        setIsLoading(false)
      }
    })()
  }, [refreshTrigger])

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
        <p className="mt-1 text-sm text-gray-500">Chào mừng bạn quay lại quản lý cửa hàng.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Đơn hàng hôm nay"
          value={isLoading ? '…' : stats.ordersToday}
          icon="🍽️"
          color="text-indigo-600"
          onClick={() => navigate('/owner/orders')}
        />
        <StatCard
          label="Yêu cầu hỗ trợ chờ xử lý"
          value={isLoading ? '…' : stats.pendingSupport}
          icon="🆘"
          color="text-orange-500"
          onClick={() => navigate('/owner/support')}
        />
        <StatCard
          label="Nhân viên đang hoạt động"
          value={isLoading ? '…' : stats.activeEmployees}
          icon="👥"
          color="text-green-600"
          onClick={() => navigate('/owner/employees')}
        />
      </div>

      {/* Recent socket events (New Order, Calls) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Bell size={20} className="text-indigo-500" />
            Sự kiện thời gian thực
          </h2>
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-lg">Live</span>
        </div>

        {activeCallStaff.length === 0 && activeCallPayment.length === 0 && activeLoyaltyRedeems.length === 0 && !newOrderNotify ? (
          <div className="rounded-2xl bg-surface py-14 text-center shadow-sm border border-slate-100 flex flex-col items-center">
             <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center text-slate-200 mb-4 font-black text-3xl">✨</div>
             <p className="text-sm font-bold text-slate-500 mb-1">Cửa hàng đang vận hành ổn định</p>
             <p className="text-xs text-slate-400 font-medium tracking-tight">Các yêu cầu từ bàn sẽ hiện tại đây</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {activeCallStaff.map((c, i) => (
               <EventCard key={`s-${i}`} title={`Bàn ${c.tableNumber} gọi nhân viên`} type="staff" time={c.createdAt} />
             ))}
             {activeCallPayment.map((c, i) => (
               <EventCard
                 key={`p-${i}`}
                 title={
                   c.loyaltyPaymentMethod
                     ? `Bàn ${c.tableNumber} — thanh toán tích điểm (${c.loyaltyPaymentMethod === 'bank_qr' ? 'QR' : 'tại bàn'})`
                     : c.paymentPreference
                       ? `Bàn ${c.tableNumber} — gọi thanh toán (${c.paymentPreference === 'bank_qr' ? 'QR' : 'tại bàn'})`
                       : `Bàn ${c.tableNumber} yêu cầu thanh toán`
                 }
                 type="payment"
                 time={c.createdAt}
               />
             ))}
             {activeLoyaltyRedeems.map((r) => (
               <EventCard
                 key={`lr-${r.transactionId}`}
                 title={
                   (r.tableNumber !== '—' ? `Bàn ${r.tableNumber} — ` : '') +
                   `Đổi quà: ${r.rewardTitle} (−${r.pointsCost} điểm) · *${r.customerPhoneLast4}`
                 }
                 type="loyalty"
                 time={r.createdAt}
               />
             ))}
             {newOrderNotify && (
               <EventCard title={`Bàn ${newOrderNotify.tableNumber}: Đơn mới ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(+newOrderNotify.totalPrice)}`} type="order" time={newOrderNotify.createdAt} />
             )}
          </div>
        )}
      </section>
    </div>
  )
}

function EventCard({ title, type, time }: { title: string, type: 'staff' | 'payment' | 'order' | 'loyalty', time?: string }) {
  const meta: Record<string, { icon: string, color: string, bg: string, label: string }> = {
    staff: { icon: '🆘', color: 'text-red-700', bg: 'bg-red-50', label: 'Hỗ trợ' },
    payment: { icon: '💰', color: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Thanh toán' },
    order: { icon: '🍽️', color: 'text-indigo-700', bg: 'bg-indigo-50', label: 'Đơn hàng' },
    loyalty: { icon: '🎁', color: 'text-amber-900', bg: 'bg-amber-50', label: 'Đổi quà' },
  }
  const config = meta[type]
  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border ${config.bg.replace('bg-', 'border-')} shadow-sm animate-in slide-in-from-bottom-2`}>
       <div className={`w-12 h-12 ${config.bg} rounded-xl flex items-center justify-center text-2xl shadow-sm`}>{config.icon}</div>
       <div className="flex-1 min-w-0">
         <p className={`text-sm font-black truncate ${config.color}`}>{title}</p>
         <div className="flex items-center gap-2 mt-1">
           <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${config.bg} ${config.color}`}>{config.label}</span>
           <span className="text-[10px] text-gray-400 font-bold">{time ? timeAgo(time) : 'Vừa xong'}</span>
         </div>
       </div>
    </div>
  )
}

// ─── Helpers (mirrored for OwnerDashboard) ───────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff} giây trước`
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  return `${Math.floor(diff / 86400)} ngày trước`
}
