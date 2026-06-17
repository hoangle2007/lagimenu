import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState<{
    totalShops: number;
    totalOrders: number;
    totalRevenue: number;
    activeShops: number;
  } | null>(null);
  const [stats, setStats] = useState<{ totalMerchants: number; totalOrders: number; totalRevenue: number } | null>(
    null,
  );
  const [socket, setSocket] = useState<{ approxConnectedClients: number } | null>(null);
  const [notifs, setNotifs] = useState<unknown[]>([]);
  const [rev, setRev] = useState<{
    totalRevenue: number;
    orderCount: number;
    byShop: { merchantId: string; name: string; orders: number; revenue: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [o, s, sk, n, rv] = await Promise.all([
          api.get('admin/overview'),
          api.get('admin/stats'),
          api.get('admin/socket-stats'),
          api.get('admin/notifications?limit=8'),
          api.get('admin/revenue-summary'),
        ]);
        if (!cancelled) {
          setOverview(o.data);
          setStats(s.data);
          setSocket(sk.data);
          setNotifs(n.data.notifications ?? []);
          setRev(rv.data);
        }
      } catch {
        if (!cancelled) setOverview(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Cửa hàng', v: overview?.totalShops ?? stats?.totalMerchants ?? 0 },
          { label: 'Đơn hàng', v: overview?.totalOrders ?? stats?.totalOrders ?? 0 },
          { label: 'Doanh thu (ước)', v: overview?.totalRevenue ?? stats?.totalRevenue ?? 0 },
          { label: 'Cửa hàng mở', v: overview?.activeShops ?? 0 },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{c.v.toLocaleString('vi-VN')}</p>
          </div>
        ))}
      </div>
      {rev && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <p className="text-sm font-semibold text-white mb-3">Doanh thu tổng (trừ đơn hủy)</p>
          <p className="text-2xl font-bold text-amber-400">{rev.totalRevenue.toLocaleString('vi-VN')}₫</p>
          <p className="text-xs text-slate-500 mt-1">{rev.orderCount.toLocaleString('vi-VN')} đơn hợp lệ</p>
          <div className="mt-4 max-h-56 overflow-y-auto">
            <p className="text-xs uppercase text-slate-500 mb-2">Theo cửa hàng</p>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="py-1 pr-2">Tên</th>
                  <th className="py-1 pr-2">Đơn</th>
                  <th className="py-1">Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {rev.byShop.slice(0, 15).map((x) => (
                  <tr key={x.merchantId} className="border-b border-slate-800/80">
                    <td className="py-1.5 pr-2 text-slate-300 truncate max-w-[140px]">{x.name}</td>
                    <td className="py-1.5 pr-2">{x.orders}</td>
                    <td className="py-1.5 text-amber-200/90">{x.revenue.toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Socket (ước lượng)</p>
        <p className="text-xl font-semibold text-emerald-400">{socket?.approxConnectedClients ?? 0} client</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <p className="text-sm font-semibold text-white mb-3">Thông báo gần đây</p>
        <ul className="space-y-2 text-sm text-slate-300">
          {(notifs as { title?: string; body?: string; created_at?: string }[]).map((n, i) => (
            <li key={i} className="border-b border-slate-800 pb-2 last:border-0">
              <span className="font-medium text-white">{n.title}</span>
              {n.body ? <span className="block text-slate-400">{n.body}</span> : null}
            </li>
          ))}
          {notifs.length === 0 && <li className="text-slate-500">Không có thông báo.</li>}
        </ul>
      </div>
    </div>
  );
}
