import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { employeeLogin } from '@/api/auth'
import { useAuth } from '@/hooks/useAuth'
import { getDefaultEmployeePath } from '@/lib/employeeRoles'

export default function EmployeeLoginPage() {
  const navigate = useNavigate()
  const { shopSlug } = useParams<{ shopSlug: string }>()
  const { login, user, isLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPin, setShowPin] = useState(false)
  
  // Persist the current shop slug for future redirections
  useEffect(() => {
    if (shopSlug) {
      localStorage.setItem('last_shop_slug', shopSlug)
    }
  }, [shopSlug])

  // Auto-redirect if already logged in as employee
  useEffect(() => {
    if (!isLoading && user) {
      navigate(getDefaultEmployeePath(user.notifyRole), { replace: true })
    }
  }, [user, isLoading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Vui lòng nhập email.')
      return
    }
    if (!pin || pin.length !== 4) {
      setError('Mã PIN phải gồm 4 chữ số.')
      return
    }

    setIsSubmitting(true)
    try {
      const { data } = await employeeLogin({ email, pin, shopSlug })
      login(data.token, data.user)
      navigate(getDefaultEmployeePath(data.user?.notifyRole))
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      const msg = axiosErr?.response?.data?.message
      if (msg === 'Invalid credentials' || msg === 'Invalid PIN') {
        setError('Email hoặc mã PIN không đúng.')
      } else {
        setError('Đăng nhập thất bại. Vui lòng thử lại.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8 text-indigo-600">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Đăng nhập nhân viên</h1>
          <p className="mt-1 text-sm text-gray-500">
            {shopSlug ? (
              <>
                Tại cửa hàng: <span className="font-semibold text-primary">{shopSlug}</span>
              </>
            ) : (
              'Nhập email và mã PIN được cấp bởi chủ quán'
            )}
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-gray-200">
          <div className="mb-4 rounded-lg bg-indigo-50 px-3 py-2.5 text-xs text-indigo-900 leading-relaxed border border-indigo-100">
            <strong className="font-semibold">Không có trang đăng ký công khai cho nhân viên.</strong>{' '}
            Bạn cần nhận lời mời (email / link có token) hoặc link đăng nhập theo quán từ chủ cửa hàng — xem mục «Nhân viên» trong Cài đặt quán.
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nv@cuahang.com"
                  className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
            </div>

            {/* PIN */}
            <div className="space-y-1">
              <label htmlFor="pin" className="text-sm font-medium text-gray-700">
                Mã PIN (4 chữ số)
              </label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full rounded-md border border-gray-300 py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 tracking-[0.3em] text-center font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400">
                Mã PIN được cấp bởi chủ quán của bạn
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Đăng nhập nhân viên
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Back to owner login */}
        <div className="mt-4 text-center">
          <Link
            to="/login"
            className="text-sm text-gray-500 hover:text-primary hover:underline"
          >
            ← Đăng nhập chủ quán
          </Link>
        </div>
      </div>
    </div>
  )
}
