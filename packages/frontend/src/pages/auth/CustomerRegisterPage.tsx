import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { customerRegister } from '@/api/auth'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function CustomerRegisterPage() {
  const navigate = useNavigate()
  const { user, login: setAuth } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  if (user?.role === 'CUSTOMER') {
    return <Navigate to="/customer" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    if (password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.')
      return
    }
    setIsLoading(true)
    try {
      const { data } = await customerRegister({
        name,
        email,
        password,
        phone: phone.trim() || undefined,
      })
      setAuth(data.token, data.user as any)
      navigate('/customer', { replace: true })
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } }
      setError(ax?.response?.data?.message ?? 'Đăng ký thất bại. Email có thể đã được dùng.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50 to-white px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-amber-800">Đăng ký khách hàng</h1>
          <p className="mt-1 text-sm text-gray-600">Miễn phí — dùng khi đặt món tại các quán</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-xl bg-surface p-6 shadow-md space-y-4 border border-amber-100">
          <Input label="Họ tên" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Số điện thoại (tuỳ chọn)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input
            label="Mật khẩu"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            label="Xác nhận mật khẩu"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
          <Button type="submit" isLoading={isLoading} className="w-full">
            Tạo tài khoản
          </Button>
          <div className="text-center text-sm text-gray-600">
            Đã có tài khoản?{' '}
            <Link to="/customer/login" className="text-amber-700 font-medium hover:underline">
              Đăng nhập
            </Link>
          </div>
          <div className="text-center text-xs text-gray-400 space-y-1">
            <div>
              <Link to="/register" className="hover:text-amber-700">
                Đăng ký mở quán (chủ cửa hàng)
              </Link>
            </div>
            <div>
              <Link to="/employee-login" className="hover:text-amber-700">
                Nhân viên đăng nhập
              </Link>
              <span> — không tự đăng ký; nhận link mời từ chủ quán</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
