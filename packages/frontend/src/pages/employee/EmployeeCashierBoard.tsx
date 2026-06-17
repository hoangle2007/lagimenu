/**
 * Thu ngân — yêu cầu thanh toán / bill, mở modal thanh toán.
 */
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { ordersApi } from '@/api/orders'
import { useAuth } from '@/hooks/useAuth'
import { useMerchantSocket } from '@/hooks/useMerchantSocket'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui'
import { PaymentMethodModal } from '@/components/PaymentMethodModal'
import { CreditCard, Loader2, Volume2, Gift } from 'lucide-react'
import { cn } from '@/lib/utils'
import { warmUpVietnameseSpeech, speakVietnamese } from '@/lib/speechVi'
import { VietnameseSpeechBanner } from '@/components/VietnameseSpeechBanner'
import { vi } from '@/locales/vi'
import { Navigate, Link } from 'react-router-dom'
import { canAccessCashier, getEmployeeHomePath } from '@/lib/employeeRoles'

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
        <p className="text-slate-400 font-medium my-6">Bật âm thanh khi khách yêu cầu thanh toán.</p>
        <Button
          className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-xl shadow-primary/20 text-lg"
          onClick={() => {
            setOpen(false)
            onUnlock()
          }}
        >
          Sẵn sàng
        </Button>
      </DialogContent>
    </Dialog>
  )
}

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed']

export default function EmployeeCashierBoard() {
  const { user } = useAuth()
  const shopId = user?.shop?.id || (user as { shopId?: string }).shopId

  const { socketStatus, activeCallPayment, activeLoyaltyRedeems, refreshTrigger, clearCallPayment, clearLoyaltyRedeem } = useMerchantSocket(
    shopId || '',
  )

  const [orders, setOrders] = useState<any[]>([])
  const [payingTable, setPayingTable] = useState<string | null>(null)
  const [paymentOrder, setPaymentOrder] = useState<{
    id: number
    tableNumber: string
    totalPrice: string | number
    customerPhone?: string
  } | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await ordersApi.list({ limit: 80 })
      const rawList: any[] = data?.orders ?? (Array.isArray(data) ? data : [])
      const mapped = rawList.map((o: any) => ({
        ...o,
        tableNumber: o.table_number ?? o.tableNumber ?? '??',
        totalPrice: String(o.total_price ?? o.totalPrice ?? 0),
        totalAmount: Number(o.total_price ?? o.totalPrice ?? 0),
        createdAt: o.created_at ?? o.createdAt ?? new Date().toISOString(),
        items: o.items ?? [],
      }))
      const active = mapped.filter((o: any) => ACTIVE_STATUSES.includes(o.status))
      setOrders(active)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders, refreshTrigger])

  if (!canAccessCashier(user)) {
    return <Navigate to={getEmployeeHomePath(user)} replace />
  }

  const handlePayTable = async (tableNumber: string) => {
    if (!shopId) return
    const tableOrders = orders.filter((o) => o.tableNumber === tableNumber)
    const total = tableOrders.reduce((sum, o) => sum + o.totalAmount, 0)

    if (total === 0) {
      setPayingTable(tableNumber)
      try {
        await api.post(`/orders/merchant/${shopId}/table/${encodeURIComponent(tableNumber)}/pay`)
        clearCallPayment(tableNumber)
        toast.success(`Đã xử lý bàn ${tableNumber}`)
        await fetchOrders()
      } finally {
        setPayingTable(null)
      }
      return
    }

    const first = tableOrders[0]
    if (!first?.id) return
    setPaymentOrder({
      id: first.id,
      tableNumber,
      totalPrice: String(total),
      customerPhone: first.customer_phone ?? first.customerPhone,
    })
  }

  const tablesWithDue = Array.from(
    new Map(
      orders
        .filter((o) => ['ready', 'preparing', 'confirmed', 'pending'].includes(o.status))
        .map((o) => [o.tableNumber, o]),
    ).values(),
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pb-24">
      <AudioUnlockModal
        onUnlock={() => {
          warmUpVietnameseSpeech()
          speakVietnamese(vi.tts.dashboardWarmup, {
            onMissingVietnameseVoice: () =>
              window.dispatchEvent(new CustomEvent('speech-vi-missing')),
          })
        }}
      />

      <VietnameseSpeechBanner />

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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100/90 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/60 px-4 py-4 shadow-sm">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">Thu ngân</h1>
          <p
            className={cn(
              'text-[10px] font-black uppercase tracking-widest',
              socketStatus === 'connected' ? 'text-emerald-600' : 'text-amber-600',
            )}
          >
            {socketStatus === 'connected' ? 'Live' : 'Offline'}
          </p>
        </div>
        <Link
          to="/employee/pos"
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-500 hover:to-emerald-600 transition-all"
        >
          Mở POS
        </Link>
      </div>

      {activeLoyaltyRedeems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Gift size={14} className="text-amber-600" />
            Khách đổi quà tích điểm
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeLoyaltyRedeems.map((r) => (
              <div
                key={`loyre-${r.transactionId}`}
                className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-md ring-1 ring-amber-100/60"
              >
                <div>
                  <p className="font-black text-slate-900">
                    {r.tableNumber !== '—' ? `Bàn ${r.tableNumber}` : 'Khách (không rõ bàn)'}
                  </p>
                  <p className="text-[10px] font-bold text-amber-900/90">
                    {r.rewardTitle} · −{r.pointsCost} điểm · *{r.customerPhoneLast4}
                  </p>
                  <p className="text-[9px] font-bold text-slate-500 mt-0.5">Số dư sau đổi: {r.newBalance} điểm</p>
                </div>
                <Button
                  size="sm"
                  className="font-black uppercase text-[9px] bg-amber-600 hover:bg-amber-700 text-white border-0"
                  onClick={() => clearLoyaltyRedeem(r.transactionId)}
                >
                  Đã giao quà
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeCallPayment.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <CreditCard size={14} className="text-emerald-600" />
            Yêu cầu thanh toán / bill
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeCallPayment.map((call, idx) => {
              const tier = call.loyaltyPaymentMethod
                ? 'loyalty'
                : call.paymentPreference
                  ? 'pref'
                  : 'bill';
              const ring =
                tier === 'loyalty'
                  ? 'border-violet-200/90 ring-violet-100/50'
                  : tier === 'pref'
                    ? 'border-sky-200/90 ring-sky-100/50'
                    : 'border-emerald-200/90 ring-emerald-100/50';
              const sub =
                call.loyaltyPaymentMethod === 'bank_qr'
                  ? 'Thanh toán tích điểm — QR ngân hàng'
                  : call.loyaltyPaymentMethod === 'at_table'
                    ? 'Thanh toán tích điểm — thu ngân tại bàn'
                    : call.paymentPreference === 'bank_qr'
                      ? 'Gọi thanh toán — QR ngân hàng'
                      : call.paymentPreference === 'at_table'
                        ? 'Gọi thanh toán — thu ngân tại bàn'
                        : 'Khách yêu cầu thanh toán';
              return (
              <div
                key={`pay-${idx}`}
                className={`flex items-center justify-between rounded-2xl border bg-surface p-4 shadow-md ring-1 ${ring}`}
              >
                <div>
                  <p className="font-black text-slate-900">Bàn {call.tableNumber}</p>
                  <p className="text-[10px] font-bold text-slate-500">
                    {sub}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="font-black uppercase text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                    onClick={() => handlePayTable(call.tableNumber)}
                    disabled={payingTable === call.tableNumber}
                  >
                    {payingTable === call.tableNumber ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      'Thanh toán'
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[9px] font-bold"
                    onClick={() => clearCallPayment(call.tableNumber)}
                  >
                    Đã xử lý
                  </Button>
                </div>
              </div>
            );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200/90 bg-surface p-4 shadow-md">
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-600">
          Bàn đang có hoạt động
        </h2>
        {tablesWithDue.length === 0 ? (
          <p className="text-sm font-bold text-slate-400">Không có bàn cần thanh toán gấp.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tablesWithDue.map((o) => (
              <li key={`${o.tableNumber}-${o.id}`} className="flex items-center justify-between py-3">
                <div>
                  <span className="font-black text-slate-900">Bàn {o.tableNumber}</span>
                  <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">{o.status}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-primary">
                    {Intl.NumberFormat('vi-VN').format(o.totalAmount)}₫
                  </span>
                  <Button
                    size="sm"
                    className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-black"
                    variant="outline"
                    onClick={() => handlePayTable(o.tableNumber)}
                  >
                    Thu
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
