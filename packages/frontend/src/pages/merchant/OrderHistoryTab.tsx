import React, { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Loader2, Search, X, UtensilsCrossed, User, Phone, Hash, Calendar, Tag } from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { formatDateTime } from '@shared/utils';

type HistoryItem = {
  productId?: number;
  quantity?: number;
  price?: string | number;
  notes?: string | null;
  note?: string | null;
  product?: { id?: number; name?: string } | null;
};

type HistoryOrder = {
  id: number;
  merchant_id?: string;
  status: string;
  table_number: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  total_price: string | number;
  type?: string;
  created_at: string | Date;
  items?: HistoryItem[] | string;
};

function orderStatusVi(s: string): string {
  const k = (s || '').toLowerCase();
  const m: Record<string, string> = {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    preparing: 'Đang chuẩn bị',
    ready: 'Sẵn sàng',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
    paid: 'Đã thanh toán',
  };
  return m[k] || s || '—';
}

function orderTypeVi(t: string | undefined): string {
  const k = (t || '').toLowerCase();
  const m: Record<string, string> = {
    order: 'Đặt món',
    call_staff: 'Gọi nhân viên',
    call_payment: 'Gọi thanh toán',
  };
  return m[k] || (t ? String(t) : '—');
}

function formatMoney(v: string | number | undefined): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0đ';
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

function normalizeItems(raw: HistoryOrder['items']): HistoryItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? (p as HistoryItem[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function itemNote(it: HistoryItem): string {
  return (it.note ?? it.notes ?? '').trim();
}

export const OrderHistoryTab: React.FC<{ merchantId: string }> = ({ merchantId: _merchantId }) => {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<{ orders: HistoryOrder[]; total: number; totalPages: number } | null>(null);
  const [detail, setDetail] = useState<HistoryOrder | null>(null);

  const load = useCallback(
    async (opts?: { page?: number }) => {
      const p = opts?.page ?? page;
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        params.set('page', String(p));
        params.set('limit', '15');
        const res = await api.get(`orders/history?${params.toString()}`);
        setData(res.data as { orders: HistoryOrder[]; total: number; totalPages: number });
      } catch {
        setErr('Không tải được lịch sử đơn.');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [q, from, to, page],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const orders = data?.orders ?? [];

  return (
    <div className="p-4 lg:p-8 space-y-4 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900">Lịch sử đơn hàng</h1>
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-end">
            <div className="flex-1">
              <label className="text-xs text-slate-500">Tìm kiếm</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 text-slate-400" size={16} />
                <Input
                  className="pl-8"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Mã đơn, bàn, tên khách…"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Từ ngày</label>
              <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Đến ngày</label>
              <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button
              type="button"
              onClick={() => {
                setPage(1);
                void load({ page: 1 });
              }}
            >
              Lọc
            </Button>
          </div>
        </CardContent>
      </Card>

      {err && <p className="text-red-600 text-sm">{err}</p>}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <button
              key={String(o.id)}
              type="button"
              onClick={() => setDetail(o)}
              className="w-full text-left rounded-xl border border-slate-200 bg-surface p-4 hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="font-semibold text-slate-900">Đơn #{o.id}</span>
                <span className="text-xs text-slate-500">{formatDateTime(o.created_at)}</span>
              </div>
              <div className="text-sm text-slate-600 mt-1 flex flex-wrap gap-x-2 gap-y-1">
                <span>
                  Bàn <strong className="text-slate-800">{o.table_number}</strong>
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-primary font-medium">{orderStatusVi(o.status)}</span>
                <span className="text-slate-300">·</span>
                <span>{formatMoney(o.total_price)}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{orderTypeVi(o.type)}</div>
            </button>
          ))}
          {orders.length === 0 && <p className="text-slate-500 text-sm">Chưa có đơn trong khoảng lọc.</p>}
          {data && data.totalPages > 1 && (
            <div className="flex gap-2 justify-center pt-4">
              <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Trước
              </Button>
              <span className="text-sm self-center">
                Trang {page}/{data.totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
          )}
        </div>
      )}

      {detail && (
        <div
          className="fixed inset-0 z-[400] bg-slate-900/50 backdrop-blur-[2px] flex justify-end"
          onClick={() => setDetail(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md bg-surface h-full shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="history-detail-title"
          >
            <div className="sticky top-0 bg-gradient-to-br from-primary/95 to-amber-600 text-white px-5 py-4 flex items-start justify-between gap-3 z-10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">Chi tiết đơn hàng</p>
                <h2 id="history-detail-title" className="text-xl font-black mt-0.5">
                  Đơn #{detail.id}
                </h2>
                <p className="text-xs text-white/90 mt-1 flex items-center gap-1.5">
                  <Calendar size={14} className="opacity-80 shrink-0" />
                  {formatDateTime(detail.created_at)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                className="rounded-full p-2 bg-surface/15 hover:bg-surface/25 transition-colors"
                onClick={() => setDetail(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-surface-container-low border border-slate-100 p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Hash size={12} /> Trạng thái
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{orderStatusVi(detail.status)}</p>
                </div>
                <div className="rounded-2xl bg-surface-container-low border border-slate-100 p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <UtensilsCrossed size={12} /> Loại
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{orderTypeVi(detail.type)}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-surface-container-low border border-slate-100 p-4 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bàn & khách</p>
                <p className="text-sm font-semibold text-slate-800">Bàn {detail.table_number}</p>
                <p className="text-sm text-slate-600 flex items-center gap-2">
                  <User size={14} className="text-slate-400" />
                  {detail.customer_name?.trim() || 'Khách'}
                </p>
                {detail.customer_phone ? (
                  <p className="text-sm text-slate-600 flex items-center gap-2">
                    <Phone size={14} className="text-slate-400" />
                    {detail.customer_phone}
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/50 p-4 flex justify-between items-center">
                <span className="text-sm font-bold text-emerald-900">Tổng cộng</span>
                <span className="text-lg font-black text-emerald-700">{formatMoney(detail.total_price)}</span>
              </div>

              {(() => {
                const items = normalizeItems(detail.items);
                if (items.length === 0) {
                  return (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                      Không có món trong đơn (ví dụ: yêu cầu gọi nhân viên).
                    </div>
                  );
                }
                return (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                      <Tag size={12} /> Món đã đặt
                    </p>
                    <ul className="space-y-2">
                      {items.map((it, idx) => (
                        <li
                          key={`${detail.id}-${idx}`}
                          className="flex justify-between gap-2 rounded-xl bg-surface border border-slate-100 px-3 py-2.5 text-sm"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">
                              {it.product?.name || 'Món'}
                            </span>
                            {itemNote(it) ? (
                              <p className="text-[11px] text-slate-500 mt-0.5">{itemNote(it)}</p>
                            ) : null}
                            <p className="text-[11px] text-slate-400 mt-0.5">×{it.quantity ?? 1}</p>
                          </div>
                          <span className="font-bold text-slate-700 shrink-0">
                            {formatMoney(
                              (Number(it.price) || 0) * (Number(it.quantity) || 1),
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>

            <div className="sticky bottom-0 p-4 border-t border-slate-100 bg-surface">
              <Button className="w-full h-11 font-bold" variant="secondary" onClick={() => setDetail(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
