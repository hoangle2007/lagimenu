import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminAnalyticsPage() {
  const [series, setSeries] = useState<{ d: string; cnt: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('admin/analytics/daily-orders');
        setSeries(data.series ?? []);
      } catch {
        setSeries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Loader2 className="animate-spin text-blue-500" size={28} />;

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-white">Phân tích</h1>
      <p className="text-slate-400 text-sm">Số đơn theo ngày (14 ngày gần nhất, UTC).</p>
      <div className="h-80 w-full rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series.map((s) => ({ date: s.d, orders: s.cnt }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
            <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
