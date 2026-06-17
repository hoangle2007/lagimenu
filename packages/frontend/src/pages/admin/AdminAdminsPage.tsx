import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Loader2 } from 'lucide-react'

type Row = { id: string; email: string; name: string; role: string; created_at: string }

export default function AdminAdminsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('admin/admin-accounts')
        setRows((data.admins ?? []) as Row[])
      } catch {
        setRows([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <Loader2 className="animate-spin text-blue-500" size={28} />

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold text-white">Tài khoản quản trị nền tảng</h1>
      <p className="text-slate-400 text-sm">
        Danh sách admin / super_admin trong hệ thống (đăng nhập qua /admin/login). Tạo tài khoản mới thực hiện qua
        script seed hoặc DB.
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-800 text-sm">
        <table className="w-full text-left text-slate-200">
          <thead className="bg-slate-900 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Chức vụ</th>
              <th className="px-3 py-2">Tạo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800">
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-violet-950 px-2 py-0.5 text-xs">{r.role}</span>
                </td>
                <td className="px-3 py-2 text-slate-400">{r.created_at?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
