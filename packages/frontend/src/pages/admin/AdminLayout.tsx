import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  ShoppingBag,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  UserCircle,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { to: '/admin/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/admin/shops', label: 'Cửa hàng & DT', icon: Building2 },
  { to: '/admin/merchants', label: 'Duyệt merchant', icon: Store },
  { to: '/admin/orders', label: 'Đơn hàng', icon: ShoppingBag },
  { to: '/admin/users', label: 'Nhân viên', icon: Users },
  { to: '/admin/customers', label: 'Khách hàng', icon: UserCircle },
  { to: '/admin/admins', label: 'Admin HT', icon: Shield },
  { to: '/admin/analytics', label: 'Phân tích', icon: BarChart3 },
  { to: '/admin/settings', label: 'Cấu hình', icon: Settings },
];

export default function AdminLayout({
  adminName,
  onLogout,
}: {
  adminName: string;
  onLogout: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      <aside className="w-56 shrink-0 border-r border-slate-800 flex flex-col py-6 px-3">
        <div className="px-2 mb-8">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Kivo Admin</p>
          <p className="text-sm font-semibold truncate">{adminName || 'Admin'}</p>
        </div>
        <nav className="flex-1 space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => {
            onLogout();
            navigate('/admin/login');
          }}
          className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-950/50"
        >
          <LogOut size={18} />
          Đăng xuất
        </button>
      </aside>
      <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <Outlet />
      </main>
    </div>
  );
}
