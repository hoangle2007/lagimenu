
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import NotificationBell from '@/components/NotificationBell'

const ownerNav = [
  { label: 'Dashboard', to: '/owner/dashboard' },
  { label: 'Nhân viên', to: '/owner/employees' },
  { label: 'Đơn hàng', to: '/owner/orders' },
  { label: 'Hỗ trợ', to: '/owner/support' },
]

export default function OwnerLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-surface shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/owner/dashboard" className="text-xl font-bold text-primary hover:text-indigo-700">
              Lagi Menu
            </Link>
            <div className="hidden items-center gap-1 sm:flex">
              {ownerNav.map(({ label, to }) => (
                <Link
                  key={to}
                  to={to}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    location.pathname === to
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            {user && (
              <>
                <span className="hidden text-sm text-gray-600 sm:block">
                  {user.name ?? user.email}
                </span>
                <button
                  onClick={logout}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Đăng xuất
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
