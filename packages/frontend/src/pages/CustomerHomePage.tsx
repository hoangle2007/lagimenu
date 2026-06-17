import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'

export default function CustomerHomePage() {
  const { user, logout } = useAuth()

  if (!user || user.role !== 'CUSTOMER') {
    return <Navigate to="/customer/login" replace />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl bg-surface p-8 shadow-lg border border-amber-100">
        <h1 className="text-xl font-bold text-amber-900">Xin chào, {user.name || 'bạn'}!</h1>
        <p className="mt-2 text-sm text-gray-600">{user.email}</p>
        <p className="mt-4 text-sm text-gray-500">
          Bạn có thể quét QR tại bàn để đặt món hoặc xem menu công khai của quán (nếu quán bật).
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link to="/" className="block">
            <Button variant="secondary" className="w-full">
              Về trang chủ
            </Button>
          </Link>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              logout()
            }}
          >
            Đăng xuất
          </Button>
        </div>
      </div>
    </div>
  )
}
