import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

type Row = { key: string; value: string | null; updated_at: string };

export default function AdminSettingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState('announcement');
  const [val, setVal] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('admin/system-settings');
      setRows(data.settings ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    await api.patch('admin/system-settings', { key, value: val });
    setVal('');
    void load();
  };

  if (loading) return <Loader2 className="animate-spin text-blue-500" size={28} />;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">Cấu hình hệ thống</h1>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <label className="block text-xs text-slate-500 uppercase">Key</label>
        <input
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <label className="block text-xs text-slate-500 uppercase">Value</label>
        <textarea
          className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white min-h-[100px]"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <button type="button" onClick={() => void save()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
          Lưu
        </button>
      </div>
      <ul className="space-y-2 text-sm text-slate-300">
        {rows.map((r) => (
          <li key={r.key} className="rounded-lg border border-slate-800 p-3">
            <span className="font-mono text-blue-400">{r.key}</span>
            <pre className="mt-1 whitespace-pre-wrap text-slate-400">{r.value ?? '(null)'}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
