import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { customerLogin } from '@/api/auth'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function CustomerLoginPage() {
  const navigate = useNavigate()
  const { user, login: setAuth } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  if (user?.role === 'CUSTOMER') {
    return <Navigate to="/customer" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const { data } = await customerLogin({ email, password })
      setAuth(data.token, data.user as any)
      navigate('/customer', { replace: true })
    } catch {
      setError('Email hoặc mật khẩu không đúng.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-amber-800">Khách hàng</h1>
          <p className="mt-1 text-sm text-gray-600">Đăng nhập để lưu thông tin &amp; đặt món nhanh hơn</p>
        </div>
        <form onSubmit={handleSubmit} className="rounded-xl bg-surface p-6 shadow-md space-y-4 border border-amber-100">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Mật khẩu"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}
          <Button type="submit" isLoading={isLoading} className="w-full">
            Đăng nhập
          </Button>
          <div className="text-center text-sm text-gray-600">
            Chưa có tài khoản?{' '}
            <Link to="/customer/register" className="text-amber-700 font-medium hover:underline">
              Đăng ký
            </Link>
          </div>
          <div className="text-center text-xs text-gray-400 space-y-1">
            <div>
              <Link to="/login" className="hover:text-amber-700">
                Đăng nhập chủ quán
              </Link>
            </div>
            <div>
              <Link to="/employee-login" className="hover:text-amber-700">
                Đăng nhập nhân viên
              </Link>
              <span className="text-gray-400"> — cần lời mời / link từ chủ quán</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
