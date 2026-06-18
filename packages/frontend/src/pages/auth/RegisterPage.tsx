import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register, googleLogin } from '@/api/auth'
import type { User } from '@/api/types'
import { useAuth } from '@/hooks/useAuth'
import { MerchantPendingPage } from '@/pages/MerchantPendingPage'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login: setAuth } = useAuth()
  const googleBtnRef = useRef<HTMLDivElement>(null)
  const [socialLoading, setSocialLoading] = useState(false)

  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qShopName = params.get('shopName');
    const qPhone = params.get('phone');
    const qAddress = params.get('address');
    const qLat = params.get('lat');
    const qLng = params.get('lng');
    const qMapsUrl = params.get('googleMapsUrl');

    if (qShopName) setShopName(decodeURIComponent(qShopName));
    if (qPhone) setPhone(decodeURIComponent(qPhone));
    if (qAddress) sessionStorage.setItem('prefilled_address', decodeURIComponent(qAddress));
    if (qLat) sessionStorage.setItem('prefilled_lat', qLat);
    if (qLng) sessionStorage.setItem('prefilled_lng', qLng);
    if (qMapsUrl) sessionStorage.setItem('prefilled_maps_url', decodeURIComponent(qMapsUrl));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== passwordConfirm) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    setIsLoading(true)

    try {
      const { data } = await register({
        shopName,
        ownerName,
        email,
        password,
        phone: phone || undefined,
      })
      if (data && 'pending' in data && data.pending) {
        setRegisteredEmail(email)
        return
      }
      navigate('/login')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; message?: string } } }
      setError(
        axiosErr?.response?.data?.message ??
          axiosErr?.response?.data?.error ??
          'Đăng ký thất bại. Vui lòng thử lại.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialSuccess = async (
    token: string,
    user: { id?: string; sub?: string; email?: string; name?: string; role?: string; shopId?: string; merchantId?: string },
    _isNewAccount: boolean,
  ) => {
    const mappedUser: User = {
      id: user.id ?? user.sub ?? '',
      email: user.email ?? '',
      name: user.name,
      role: (user.role ?? 'OWNER') as User['role'],
      merchantId: user.merchantId ?? user.shopId ?? user.id ?? user.sub,
      shopId: user.shopId ?? user.merchantId ?? user.id ?? user.sub,
    }
    setAuth(token, mappedUser)
    navigate('/merchant', { replace: true })
  }

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
        text: 'signup_with',
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

  if (registeredEmail) {
    return <MerchantPendingPage variant="post_register" emailHint={registeredEmail} />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-primary">Kivo Menu</h1>
          <p className="mt-1 text-sm text-gray-500">Đăng ký mở quán</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-surface p-6 shadow-sm space-y-4"
        >
          <div className="space-y-3">
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

          <Input
            label="Tên quán"
            type="text"
            placeholder="Quán Cà phê ABC"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            required
            autoComplete="organization"
          />

          <Input
            label="Họ tên chủ quán"
            type="text"
            placeholder="Nguyễn Văn A"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            required
            autoComplete="name"
          />

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
            label="Số điện thoại"
            type="tel"
            placeholder="0901234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />

          <Input
            label="Mật khẩu"
            type="password"
            placeholder="Tối thiểu 6 ký tự"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />

          <Input
            label="Xác nhận mật khẩu"
            type="password"
            placeholder="Nhập lại mật khẩu"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full">
            Đăng ký
          </Button>

          <div className="text-center text-sm space-y-2">
            <div>
              <Link to="/login" className="text-primary hover:underline">
                Đã có tài khoản? Đăng nhập
              </Link>
            </div>
            <div>
              <Link to="/customer/register" className="text-amber-700 hover:underline text-xs">
                Chỉ là khách hàng? Đăng ký tài khoản khách
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
