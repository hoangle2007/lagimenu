import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function AdminOrdersPage() {
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('admin/platform-orders?limit=80');
        setRows(data.orders ?? []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loader2 className="animate-spin text-blue-500" size={28} />;

  return (
    <div className="space-y-4 max-w-6xl">
      <h1 className="text-2xl font-bold text-white">Đơn hàng (toàn hệ thống)</h1>
      <div className="overflow-x-auto rounded-xl border border-slate-800 text-sm">
        <table className="w-full text-left text-slate-200">
          <thead className="bg-slate-900 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Merchant</th>
              <th className="px-3 py-2">Bàn</th>
              <th className="px-3 py-2">TT</th>
              <th className="px-3 py-2">Giá</th>
              <th className="px-3 py-2">Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {(rows as Record<string, string>[]).map((r) => (
              <tr key={String(r.id)} className="border-t border-slate-800">
                <td className="px-3 py-2">{r.id}</td>
                <td className="px-3 py-2">{r.merchant_name ?? r.merchant_id}</td>
                <td className="px-3 py-2">{r.table_number}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.total_price}</td>
                <td className="px-3 py-2 text-slate-400">{r.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
