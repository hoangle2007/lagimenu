/**
 * NotificationBell — real-time notification bell with unread badge.
 */

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useMerchantSocket,
  type ActiveCallPaymentEntry,
  type ActiveLoyaltyRedeemEntry,
  type Order,
} from '@/hooks/useMerchantSocket'
import { Bell } from 'lucide-react'

export type NotificationBellSocketSnapshot = {
  socketStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  activeCallStaff: { tableNumber: string; createdAt: string }[]
  activeCallPayment: ActiveCallPaymentEntry[]
  activeLoyaltyRedeems: ActiveLoyaltyRedeemEntry[]
  newOrderNotify: Order | null
}

export function NotificationBellView({
  socketStatus,
  activeCallStaff,
  activeCallPayment,
  activeLoyaltyRedeems,
  newOrderNotify,
}: NotificationBellSocketSnapshot) {
  const connected = socketStatus === 'connected'
  const unreadCount =
    activeCallStaff.length +
    activeCallPayment.length +
    activeLoyaltyRedeems.length +
    (newOrderNotify ? 1 : 0)

  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = () => setIsOpen((o) => !o)

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Thông báo${unreadCount > 0 ? ` — ${unreadCount} thông báo chưa đọc` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={toggle}
        className="relative rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <Bell
          className={`h-5 w-5 transition-colors ${unreadCount > 0 ? 'text-indigo-600 fill-indigo-50' : ''}`}
          aria-hidden="true"
        />

        <span
          className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white ${
            connected ? 'bg-green-500' : 'bg-amber-400 animate-pulse'
          }`}
          title={connected ? 'Đã kết nối' : 'Đang kết nối…'}
          aria-hidden="true"
        />

        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} thông báo chưa đọc`}
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl bg-surface p-2 shadow-2xl ring-1 ring-black/5 focus:outline-none z-50"
        >
          <div className="px-4 py-3 border-b border-gray-100 mb-2">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Thông báo mới</h3>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 p-1">
            {unreadCount === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-gray-400 font-medium italic">Không có thông báo mới</p>
              </div>
            ) : (
              <>
                {activeCallStaff.map((c, i) => (
                  <div key={`s-${i}`} className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                    <span className="text-lg">🆘</span>
                    <div>
                      <p className="text-xs font-bold text-red-700">Bàn {c.tableNumber}</p>
                      <p className="text-[10px] text-red-500 font-medium">Bàn đang gọi nhân viên</p>
                    </div>
                  </div>
                ))}
                {activeCallPayment.map((c, i) => {
                  const tier = c.loyaltyPaymentMethod
                    ? 'loyalty'
                    : c.paymentPreference
                      ? 'pref'
                      : 'bill';
                  const palette =
                    tier === 'loyalty'
                      ? { bg: 'bg-violet-50 border-violet-100', title: 'text-violet-800', sub: 'text-violet-600', icon: '⭐' }
                      : tier === 'pref'
                        ? { bg: 'bg-sky-50 border-sky-100', title: 'text-sky-900', sub: 'text-sky-600', icon: '💳' }
                        : { bg: 'bg-emerald-50 border-emerald-100', title: 'text-emerald-700', sub: 'text-emerald-500', icon: '💰' };
                  const sub =
                    c.loyaltyPaymentMethod === 'bank_qr'
                      ? 'Thanh toán tích điểm — QR ngân hàng'
                      : c.loyaltyPaymentMethod === 'at_table'
                        ? 'Thanh toán tích điểm — thu ngân tại bàn'
                        : c.paymentPreference === 'bank_qr'
                          ? 'Gọi thanh toán — QR ngân hàng'
                          : c.paymentPreference === 'at_table'
                            ? 'Gọi thanh toán — thu ngân tại bàn'
                            : 'Bàn yêu cầu thanh toán';
                  return (
                    <div
                      key={`p-${i}`}
                      className={`flex items-start gap-3 p-3 rounded-xl border ${palette.bg}`}
                    >
                      <span className="text-lg">{palette.icon}</span>
                      <div>
                        <p className={`text-xs font-bold ${palette.title}`}>Bàn {c.tableNumber}</p>
                        <p className={`text-[10px] font-medium ${palette.sub}`}>{sub}</p>
                      </div>
                    </div>
                  );
                })}
                {activeLoyaltyRedeems.map((r) => (
                  <div
                    key={`lr-${r.transactionId}`}
                    className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200"
                  >
                    <span className="text-lg">🎁</span>
                    <div>
                      <p className="text-xs font-bold text-amber-900">
                        Đổi quà{r.tableNumber !== '—' ? ` · Bàn ${r.tableNumber}` : ''}
                      </p>
                      <p className="text-[10px] font-medium text-amber-800/90">
                        {r.rewardTitle} · −{r.pointsCost} điểm · *{r.customerPhoneLast4}
                      </p>
                    </div>
                  </div>
                ))}
                {newOrderNotify && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                    <span className="text-lg">🍽️</span>
                    <div>
                      <p className="text-xs font-bold text-indigo-700">Đơn hàng mới</p>
                      <p className="text-[10px] text-indigo-500 font-medium">Bàn {newOrderNotify.tableNumber} vừa đặt món</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function NotificationBell() {
  const { user } = useAuth()
  const shopId = user?.shop?.id || (user as any)?.shopId

  const s = useMerchantSocket(shopId || '')
  return (
    <NotificationBellView
      socketStatus={s.socketStatus}
      activeCallStaff={s.activeCallStaff}
      activeCallPayment={s.activeCallPayment}
      activeLoyaltyRedeems={s.activeLoyaltyRedeems}
      newOrderNotify={s.newOrderNotify}
    />
  )
}
