import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login, googleLogin } from '@/api/auth'
import { useAuth } from '@/hooks/useAuth'
import { getDefaultEmployeePath } from '@/lib/employeeRoles'
import type { User } from '@/api/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (
            element: HTMLElement,
            config: { theme?: string; size?: string; text?: string; shape?: string; width?: number }
          ) => void
          prompt: () => void
        }
      }
    }
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

export default function LoginPage() {
  const navigate = useNavigate()
  const { login: setAuth } = useAuth()
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const [rememberMe, setRememberMe] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState(false)

  // ─── Social auth handler ──────────────────────────────────────────────────────
  const handleSocialSuccess = async (
    token: string,
    user: {
      id?: string
      sub?: string
      email?: string
      name?: string
      role?: string
      shopId?: string
      merchantId?: string
      accountStatus?: string
    },
    isNewAccount: boolean,
  ) => {
    const role = user.role ?? 'OWNER'
    const mappedUser: any = {
      id: user.id ?? user.sub ?? '',
      email: user.email ?? '',
      name: user.name,
      role,
      merchantId: user.merchantId ?? user.shopId ?? user.id ?? user.sub,
      shopId: user.shopId ?? user.merchantId ?? user.id ?? user.sub,
      accountStatus: user.accountStatus,
    }
    setAuth(token, mappedUser)

    const acc = user.accountStatus
    if (role === 'merchant' && acc && acc !== 'approved') {
      navigate('/merchant/pending', { replace: true })
      return
    }

    if (isNewAccount) {
      navigate('/merchant', { replace: true })
    } else if (role === 'OWNER') {
      navigate('/merchant', { replace: true })
    } else if (role === 'EMPLOYEE') {
      navigate(getDefaultEmployeePath((user as User).notifyRole))
    } else if (role === 'merchant') {
      navigate('/merchant', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }

  // ─── Google Identity SDK init ─────────────────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return

    const initGoogle = () => {
      if (!window.google) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setSocialLoading(true)
          setError('')
          try {
            const { data } = await googleLogin({ credential })
            await handleSocialSuccess(data.token, data.user, data.isNewAccount)
          } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string; error?: string } } }
            setError(
              axiosErr?.response?.data?.message ??
                axiosErr?.response?.data?.error ??
                'Đăng nhập Google thất bại. Vui lòng thử lại.',
            )
          } finally {
            setSocialLoading(false)
          }
        },
      })
      window.google.accounts.id.renderButton(googleBtnRef.current!, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: Number(googleBtnRef.current!.offsetWidth) || 320,
      })
    }

    if (window.google) {
      initGoogle()
    } else {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = initGoogle
      document.head.appendChild(script)
    }
  }, [GOOGLE_CLIENT_ID])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const { data } = await login({ email, password })
      setAuth(data.token, data.user)

      const acc = (data.user as { accountStatus?: string }).accountStatus
      if (data.user.role === 'merchant' && acc && acc !== 'approved') {
        navigate('/merchant/pending', { replace: true })
        return
      }

      if (data.user.role === 'OWNER') {
        navigate('/merchant', { replace: true })
      } else if (data.user.role === 'EMPLOYEE') {
        navigate(getDefaultEmployeePath((data.user as User).notifyRole))
      } else if (data.user.role === 'merchant') {
        navigate('/merchant', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(
        axiosErr?.response?.data?.error ??
          'Đăng nhập thất bại. Vui lòng thử lại.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-primary">Lagi Menu</h1>
          <p className="mt-1 text-sm text-gray-500">Đăng nhập — Dành cho chủ quán &amp; nhân viên</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-surface p-6 shadow-sm space-y-4"
        >
          {/* ─── Social login buttons ─── */}
          <div className="space-y-3">
            {/* Google */}
            <div ref={googleBtnRef} className="w-full" />

          </div>

          {socialLoading && (
            <p className="text-center text-xs text-gray-400">Đang xác thực...</p>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface px-2 text-gray-400">hoặc</span>
            </div>
          </div>

          {/* ─── Email/password form ─── */}
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Mật khẩu"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full">
            Đăng nhập
          </Button>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer text-gray-500 hover:text-gray-700">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              Ghi nhớ đăng nhập
            </label>
            <Link to="/register" className="text-primary hover:underline">
              Tạo tài khoản
            </Link>
          </div>

          <div className="text-center text-xs text-gray-400 space-y-1">
            <div>
              <Link to="/customer/login" className="hover:text-primary">
                Khách hàng — đăng nhập
              </Link>
            </div>
            <div>
              <Link to="/employee-login" className="hover:text-primary">
                Đăng nhập nhân viên
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
