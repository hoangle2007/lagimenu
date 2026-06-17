import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useMerchantSocket } from '@/hooks/useMerchantSocket'
import { canAccessKitchen, getEmployeeHomePath } from '@/lib/employeeRoles'
import { speakVietnamese } from '@/lib/speechVi'
import { vi } from '@/locales/vi'
import { ChefHat, Loader2, RefreshCw, Volume2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type GroupBy = 'table' | 'dish'

interface KOrder {
  id: number
  status: string
  tableNumber: string
  createdAt: string
  items: Array<{
    quantity?: number
    product?: { name?: string }
    name?: string
  }>
}

function normalizeActivePayload(data: unknown): KOrder[] {
  const raw = Array.isArray((data as { orders?: unknown })?.orders)
    ? (data as { orders: unknown[] }).orders
    : Array.isArray(data)
      ? (data as unknown[])
      : []
  return raw.map((o): KOrder => {
    const r = o as Record<string, unknown>
    return {
      id: Number(r.id),
      status: String(r.status ?? '').toLowerCase(),
      tableNumber: String(r.table_number ?? r.tableNumber ?? vi.kitchen.takeaway),
      createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
      items: Array.isArray(r.items) ? (r.items as KOrder['items']) : [],
    }
  })
}

function nextKitchenStatus(status: string): string | null {
  const s = status.toLowerCase()
  if (s === 'preparing') return 'ready'
  if (s === 'ready') return 'completed'
  return null
}

function timeAgo(dateStr: string): string {
  let normalized = dateStr.replace(' ', 'T')
  if (!normalized.includes('Z') && !normalized.includes('+')) normalized += 'Z'
  let diff = Math.floor((Date.now() - new Date(normalized).getTime()) / 1000)
  if (Math.abs(diff - 25200) < 600) diff -= 25200
  diff = Math.max(0, diff)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}′`
  return `${Math.floor(diff / 3600)}h`
}

function itemLabel(it: KOrder['items'][0]): string {
  return it.product?.name || it.name || '—'
}

function speakOrderLine(order: KOrder): void {
  const table = order.tableNumber
  const parts = order.items.map((it) => {
    const q = it.quantity ?? 1
    const n = itemLabel(it)
    return vi.tts.kitchenLine(q, n, table)
  })
  speakVietnamese(parts.join('. '), {
    onMissingVietnameseVoice: () =>
      window.dispatchEvent(new CustomEvent('speech-vi-missing')),
  })
}

export default function EmployeeKitchenBoard() {
  const { user } = useAuth()
  const shopId = user?.shop?.id || (user as { shopId?: string })?.shopId || ''

  const { refreshTrigger, socketStatus } = useMerchantSocket(shopId || '')

  const [orders, setOrders] = useState<KOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [bumpingId, setBumpingId] = useState<number | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>('table')

  const fetchActive = useCallback(async () => {
    if (!shopId) return
    try {
      const res = await api.get('/orders/active')
      setOrders(normalizeActivePayload(res.data))
    } catch {
      toast.error(vi.kitchen.loadError)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    void fetchActive()
  }, [fetchActive, refreshTrigger])

  const { waiting, ready } = useMemo(() => {
    const w = orders.filter((o) => o.status === 'preparing')
    const r = orders.filter((o) => o.status === 'ready')
    const sortFn =
      groupBy === 'table'
        ? (a: KOrder, b: KOrder) =>
            a.tableNumber.localeCompare(b.tableNumber, 'vi') || b.id - a.id
        : (a: KOrder, b: KOrder) => {
            const da = a.items.map(itemLabel).sort().join('|')
            const db = b.items.map(itemLabel).sort().join('|')
            return da.localeCompare(db, 'vi') || b.id - a.id
          }
    return {
      waiting: [...w].sort(sortFn),
      ready: [...r].sort(sortFn),
    }
  }, [orders, groupBy])

  const bump = async (order: KOrder) => {
    const next = nextKitchenStatus(order.status)
    if (!next || !shopId) return
    setBumpingId(order.id)
    try {
      await api.put(`/orders/merchant/${shopId}/${order.id}/status`, {
        status: next,
      })
      toast.success('OK')
      await fetchActive()
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined
      toast.error(msg || vi.kitchen.statusError)
    } finally {
      setBumpingId(null)
    }
  }

  if (!canAccessKitchen(user)) {
    return <Navigate to={getEmployeeHomePath(user)} replace />
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-2 pb-24 sm:px-4 sm:pb-8">
      <div className="flex flex-col gap-3 rounded-2xl border border-orange-100/80 bg-gradient-to-r from-orange-50/80 via-white to-amber-50/50 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/35">
            <ChefHat size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">
              {vi.kitchen.title}
            </h1>
            <p
              className={cn(
                'text-[10px] font-black uppercase tracking-widest',
                socketStatus === 'connected'
                  ? 'text-emerald-600'
                  : 'text-amber-600',
              )}
            >
              {socketStatus === 'connected' ? 'Live' : 'Offline'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-surface p-1 shadow-sm">
            <button
              type="button"
              className={cn(
                'rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest',
                groupBy === 'table'
                  ? 'bg-primary text-white'
                  : 'text-slate-500 hover:bg-surface-container-low',
              )}
              onClick={() => setGroupBy('table')}
            >
              {vi.kitchen.filterByTable}
            </button>
            <button
              type="button"
              className={cn(
                'rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest',
                groupBy === 'dish'
                  ? 'bg-primary text-white'
                  : 'text-slate-500 hover:bg-surface-container-low',
              )}
              onClick={() => setGroupBy('dish')}
            >
              {vi.kitchen.filterByDish}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              void fetchActive()
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-surface px-4 py-2 text-xs font-bold text-slate-600 shadow-sm hover:border-primary hover:text-primary"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <KitchenColumn
          title={vi.kitchen.colWaiting}
          orders={waiting}
          empty={vi.kitchen.emptyWaiting}
          onBump={bump}
          onSpeak={speakOrderLine}
          bumpingId={bumpingId}
        />
        <KitchenColumn
          title={vi.kitchen.colReady}
          orders={ready}
          empty={vi.kitchen.emptyReady}
          onBump={bump}
          onSpeak={speakOrderLine}
          bumpingId={bumpingId}
        />
      </div>
    </div>
  )
}

function KitchenColumn({
  title,
  orders,
  empty,
  onBump,
  onSpeak,
  bumpingId,
}: {
  title: string
  orders: KOrder[]
  empty: string
  onBump: (o: KOrder) => void
  onSpeak: (o: KOrder) => void
  bumpingId: number | null
}) {
  return (
    <section className="flex min-h-[320px] flex-col rounded-3xl border border-slate-200/90 border-t-4 border-t-orange-500 bg-surface-container-low/80 shadow-md">
      <header className="flex items-center justify-between border-b border-slate-200 bg-surface/95 px-4 py-3 rounded-t-2xl">
        <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-700">
          {title}
        </h2>
        <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">
          {orders.length}
        </span>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:max-h-[70vh]">
        {orders.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-surface text-center text-xs font-bold text-slate-400">
            {empty}
          </div>
        ) : (
          orders.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-slate-200/80 bg-surface p-4 shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-black text-slate-900">
                    {order.tableNumber}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400">
                    #{order.id} · {timeAgo(order.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onSpeak(order)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-surface-container-low"
                    title={vi.kitchen.speak}
                  >
                    <Volume2 size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={bumpingId === order.id}
                    onClick={() => onBump(order)}
                    className="rounded-xl bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-black disabled:opacity-50"
                  >
                    {bumpingId === order.id ? '…' : vi.kitchen.bump}
                  </button>
                </div>
              </div>
              <ul className="space-y-1.5 border-t border-slate-100 pt-3">
                {order.items.map((it, idx) => (
                  <li
                    key={idx}
                    className="flex items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="font-black text-orange-600">
                      {it.quantity ?? 1}×
                    </span>
                    <span className="flex-1 font-bold text-slate-800">
                      {itemLabel(it)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
