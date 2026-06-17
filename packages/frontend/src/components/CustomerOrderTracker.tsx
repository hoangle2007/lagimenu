import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, RefreshCw } from 'lucide-react';
import { formatTimeShort } from '@shared/utils';

export type TrackerOrder = {
  id: number;
  status?: string;
  type?: string;
  totalPrice?: number | string;
  total_price?: number | string;
  createdAt?: string;
  created_at?: string;
  items?: Array<{
    quantity?: number;
    price?: number | string;
    note?: string | null;
    notes?: string | null;
    product?: { name?: string };
  }>;
};

const SERVICE_TYPES = new Set(['call_staff', 'call_payment', 'loyalty_pay_request']);

export function filterKitchenOrders(orders: TrackerOrder[]): TrackerOrder[] {
  return orders.filter((o) => !SERVICE_TYPES.has(String(o?.type ?? 'order')));
}

function statusMeta(statusRaw: string): { label: string; className: string; step: number } {
  const s = String(statusRaw || 'pending').toLowerCase();
  if (s === 'pending' || s === 'confirmed') {
    return {
      label: s === 'confirmed' ? 'Đã xác nhận' : 'Chờ bếp nhận',
      className: 'bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]',
      step: 1,
    };
  }
  if (s === 'preparing' || s === 'in_progress') {
    return {
      label: 'Đang chế biến',
      className: 'bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]',
      step: 2,
    };
  }
  if (s === 'ready') {
    return {
      label: 'Sẵn sàng — chờ mang ra',
      className: 'bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]',
      step: 3,
    };
  }
  if (s === 'completed') {
    return {
      label: 'Đã ra món',
      className: 'bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]',
      step: 4,
    };
  }
  return {
    label: s,
    className: 'bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]',
    step: 0,
  };
}

type Props = {
  orders: TrackerOrder[];
  loading?: boolean;
  onManualRefresh?: () => void;
};

export const CustomerOrderTracker: React.FC<Props> = ({
  orders,
  loading,
  onManualRefresh,
}) => {
  const [open, setOpen] = useState(true);

  const sorted = useMemo(() => {
    return [...orders].sort((a, b) => Number(b.id) - Number(a.id));
  }, [orders]);

  if (sorted.length === 0) return null;

  return (
    <section className="mx-4 mt-3 rounded-2xl border border-[#fed7aa] bg-[#ffedd5]/40 backdrop-blur-sm shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-[#ffedd5]/20 hover:bg-[#ffedd5]/35 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ClipboardList size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black text-stone-900 uppercase tracking-wide">
              Theo dõi đơn đặt món
            </p>
            <p className="text-[10px] font-semibold text-stone-500 truncate">
              {sorted.length} đơn · cập nhật theo thời gian thực
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onManualRefresh && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onManualRefresh();
              }}
              disabled={loading}
              className="p-2 rounded-xl bg-[#fff7ed] border border-[#fed7aa] text-stone-700 hover:bg-[#ffedd5]/60 disabled:opacity-50"
              aria-label="Làm mới trạng thái"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
          {open ? <ChevronUp size={18} className="text-stone-400" /> : <ChevronDown size={18} className="text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 max-h-[min(60vh,420px)] overflow-y-auto">
          {sorted.map((order) => {
            const st = statusMeta(String(order.status ?? 'pending'));
            const items = order.items ?? [];
            const itemCount = items.reduce((n, i) => n + (Number(i.quantity) || 0), 0);
            const total = Number(order.totalPrice ?? order.total_price ?? 0);
            const created = order.createdAt ?? order.created_at;

            return (
              <div
                key={order.id}
                className="rounded-xl border border-[#fed7aa]/60 bg-[#fff7ed]/70 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-wider">
                      Đơn #{order.id}
                    </p>
                    <p className="text-[10px] font-semibold text-stone-500 mt-0.5">
                      {created ? formatTimeShort(created) : ''}
                      {itemCount > 0 ? ` · ${itemCount} món` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[9px] font-black uppercase tracking-tight px-2 py-1 rounded-lg border ${st.className}`}
                  >
                    {st.label}
                  </span>
                </div>

                <div className="flex gap-1 justify-between px-0.5 pt-1">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-1 flex-1 rounded-full ${
                        st.step >= step ? 'bg-primary' : 'bg-[#fed7aa]/45'
                      }`}
                    />
                  ))}
                </div>

                <ul className="space-y-1 pt-1 border-t border-[#fed7aa]/60">
                  {items.slice(0, 4).map((it, idx) => (
                    <li
                      key={`${order.id}-it-${idx}`}
                      className="flex justify-between gap-2 text-[11px]"
                    >
                      <span className="text-stone-700 truncate">
                        <span className="font-black text-stone-900">{it.quantity}×</span>{' '}
                        {it.product?.name ?? 'Món'}
                      </span>
                      <span className="font-bold text-stone-600 shrink-0">
                        {Intl.NumberFormat('vi-VN').format(
                          (Number(it.price) || 0) * (Number(it.quantity) || 0),
                        )}
                        đ
                      </span>
                    </li>
                  ))}
                  {items.length > 4 && (
                    <li className="text-[10px] font-semibold text-stone-400">
                      + {items.length - 4} món khác…
                    </li>
                  )}
                </ul>

                <div className="flex justify-between items-center pt-1 border-t border-dashed border-[#fed7aa]/60">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                    Tạm tính đơn
                  </span>
                  <span className="text-sm font-black text-stone-900">
                    {Intl.NumberFormat('vi-VN').format(total)}đ
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
