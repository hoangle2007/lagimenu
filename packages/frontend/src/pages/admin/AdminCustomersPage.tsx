import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Loader2 } from 'lucide-react'

type Row = {
  id: string
  email: string
  name: string
  phone: string | null
  is_active: boolean
  created_at: string
}

export default function AdminCustomersPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('admin/customers?limit=300')
      setRows((data.customers ?? []) as Row[])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const setActive = async (id: string, active: boolean) => {
    await api.patch(`admin/customers/${id}/active`, { active })
    void load()
  }

  if (loading) return <Loader2 className="animate-spin text-blue-500" size={28} />

  return (
    <div className="space-y-4 max-w-6xl">
      <h1 className="text-2xl font-bold text-white">Khách hàng</h1>
      <div className="overflow-x-auto rounded-xl border border-slate-800 text-sm">
        <table className="w-full text-left text-slate-200">
          <thead className="bg-slate-900 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">SĐT</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Tạo</th>
              <th className="px-3 py-2">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800">
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.phone ?? '—'}</td>
                <td className="px-3 py-2">{r.is_active ? 'Hoạt động' : 'Khóa'}</td>
                <td className="px-3 py-2 text-slate-400">{r.created_at?.slice(0, 10)}</td>
                <td className="px-3 py-2">
                  {r.is_active ? (
                    <button
                      type="button"
                      className="text-amber-400 hover:underline"
                      onClick={() => void setActive(r.id, false)}
                    >
                      Khóa
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-emerald-400 hover:underline"
                      onClick={() => void setActive(r.id, true)}
                    >
                      Mở lại
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
