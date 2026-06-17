import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Loader2 } from 'lucide-react'

type Row = {
  id: string
  email: string
  name: string
  role: string
  merchant_name: string
}

export default function AdminUsersPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [pwUser, setPwUser] = useState<Row | null>(null)
  const [newPw, setNewPw] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('admin/platform-users?limit=200')
      setRows((data.users ?? []) as Row[])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const setRole = async (id: string, role: string) => {
    setBusy(true)
    try {
      await api.patch(`admin/platform-users/${id}`, { role })
      void load()
    } finally {
      setBusy(false)
    }
  }

  const submitPw = async () => {
    if (!pwUser || newPw.length < 6) return
    setBusy(true)
    try {
      await api.patch(`admin/platform-users/${pwUser.id}/password`, { newPassword: newPw })
      setPwUser(null)
      setNewPw('')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loader2 className="animate-spin text-blue-500" size={28} />

  return (
    <div className="space-y-4 max-w-6xl">
      <h1 className="text-2xl font-bold text-white">Nhân viên (User)</h1>
      <p className="text-slate-400 text-sm">
        Chỉnh chức năng (role) nhân viên nền tảng và đặt lại mật khẩu đăng nhập email (nếu quán dùng mật khẩu User).
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-800 text-sm">
        <table className="w-full text-left text-slate-200">
          <thead className="bg-slate-900 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Cửa hàng</th>
              <th className="px-3 py-2">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-800">
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">
                  <select
                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs"
                    value={r.role}
                    disabled={busy}
                    onChange={(e) => void setRole(r.id, e.target.value)}
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    {r.role !== 'EMPLOYEE' && <option value={r.role}>{r.role}</option>}
                  </select>
                </td>
                <td className="px-3 py-2">{r.merchant_name}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-amber-400 hover:underline"
                    onClick={() => setPwUser(r)}
                  >
                    Đặt lại MK
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pwUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-white mb-2">Đặt lại mật khẩu nhân viên</h2>
            <p className="text-sm text-slate-400 mb-4">
              {pwUser.name} — {pwUser.email}
            </p>
            <input
              type="password"
              className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white mb-4"
              placeholder="Mật khẩu mới (≥6 ký tự)"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-3 py-2 text-slate-300"
                onClick={() => {
                  setPwUser(null)
                  setNewPw('')
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy || newPw.length < 6}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                onClick={() => void submitPw()}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
