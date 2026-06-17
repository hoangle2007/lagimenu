import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { Loader2 } from 'lucide-react'

type Shop = {
  id: string
  name: string
  slug: string
  is_active: boolean
  account_status: string
  order_count: number
  total_revenue: number
  employee_count: number
  owner_email: string
}

export default function AdminShopsPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [pwModal, setPwModal] = useState<{ id: string; name: string } | null>(null)
  const [newPw, setNewPw] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('admin/shops')
      setShops((data.shops ?? []) as Shop[])
    } catch {
      setShops([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const patchShop = async (id: string, body: { is_open?: boolean; account_status?: string }) => {
    setBusy(true)
    try {
      await api.patch(`admin/merchants/${id}/shop`, body)
      void load()
    } finally {
      setBusy(false)
    }
  }

  const submitResetPw = async () => {
    if (!pwModal || newPw.length < 6) return
    setBusy(true)
    try {
      await api.patch(`admin/merchant-accounts/${pwModal.id}/password`, { newPassword: newPw })
      setPwModal(null)
      setNewPw('')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <h1 className="text-2xl font-bold text-white">Cửa hàng &amp; doanh thu</h1>
      <p className="text-slate-400 text-sm">
        Theo dõi tên quán, trạng thái duyệt, mở/đóng cửa, đơn và doanh thu (ước lượng từ đơn, trừ đơn hủy).
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm text-left text-slate-200">
          <thead className="bg-slate-900 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Tên cửa hàng</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">TK</th>
              <th className="px-3 py-2">Mở cửa</th>
              <th className="px-3 py-2">Đơn</th>
              <th className="px-3 py-2">Doanh thu</th>
              <th className="px-3 py-2">NV</th>
              <th className="px-3 py-2">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((s) => (
              <tr key={s.id} className="border-t border-slate-800 bg-slate-900/40">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-slate-400">{s.owner_email}</td>
                <td className="px-3 py-2 text-xs">{s.account_status}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void patchShop(s.id, { is_open: !s.is_active })}
                    className={s.is_active ? 'text-emerald-400' : 'text-slate-500'}
                  >
                    {s.is_active ? 'Đang mở' : 'Đóng'}
                  </button>
                </td>
                <td className="px-3 py-2">{Number(s.order_count)}</td>
                <td className="px-3 py-2">{Number(s.total_revenue).toLocaleString('vi-VN')}₫</td>
                <td className="px-3 py-2">{s.employee_count}</td>
                <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                  <button
                    type="button"
                    className="text-amber-400 hover:underline"
                    onClick={() => setPwModal({ id: s.id, name: s.name })}
                  >
                    Đặt lại MK
                  </button>
                  {s.account_status !== 'approved' && (
                    <button
                      type="button"
                      className="text-emerald-400 hover:underline"
                      onClick={() => void patchShop(s.id, { account_status: 'approved' })}
                    >
                      Duyệt
                    </button>
                  )}
                  {s.account_status !== 'suspended' && (
                    <button
                      type="button"
                      className="text-red-400 hover:underline"
                      onClick={() => void patchShop(s.id, { account_status: 'suspended' })}
                    >
                      Khóa TK
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pwModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold text-white mb-2">Đặt lại mật khẩu chủ quán</h2>
            <p className="text-sm text-slate-400 mb-4">{pwModal.name}</p>
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
                  setPwModal(null)
                  setNewPw('')
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={busy || newPw.length < 6}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
                onClick={() => void submitResetPw()}
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
