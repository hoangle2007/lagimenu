import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

type Row = {
  id: string;
  name: string;
  email: string;
  account_status: string;
  created_at: string;
};

export default function AdminMerchantsPage() {
  const [status, setStatus] = useState<string>('pending');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`admin/merchant-accounts?status=${encodeURIComponent(status)}`);
      setRows((data.merchants ?? []) as Row[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: 'approve' | 'reject' | 'suspend') => {
    await api.patch(`admin/merchant-accounts/${id}/${action}`);
    void load();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-white">Merchant accounts</h1>
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'rejected', 'suspended'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              status === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {loading ? (
        <Loader2 className="animate-spin text-blue-500" size={28} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm text-left text-slate-200">
            <thead className="bg-slate-900 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Tên</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-800 bg-slate-900/50">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3">{r.account_status}</td>
                  <td className="px-4 py-3 space-x-2">
                    {r.account_status !== 'approved' && (
                      <button type="button" className="text-emerald-400 hover:underline" onClick={() => void act(r.id, 'approve')}>
                        Duyệt
                      </button>
                    )}
                    <button type="button" className="text-amber-400 hover:underline" onClick={() => void act(r.id, 'suspend')}>
                      Khóa
                    </button>
                    <button type="button" className="text-red-400 hover:underline" onClick={() => void act(r.id, 'reject')}>
                      Từ chối
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-4 text-slate-500">Không có bản ghi.</p>}
        </div>
      )}
    </div>
  );
}
