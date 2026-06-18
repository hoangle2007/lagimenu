import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { NotificationBellView } from '@/components/NotificationBell'
import { useMerchantSocket } from '@/hooks/useMerchantSocket'
import { cn } from '@/lib/utils'
import {
  employeePresenceStorageKey,
  STAFF_PRESENCE_LABELS,
  type StaffPresence,
} from '@/lib/staffPresence'
import {
  canAccessKitchen,
  canAccessService,
  canAccessCashier,
  canAccessFullDashboard,
  getEmployeeHomePath,
} from '@/lib/employeeRoles'
import { t } from '@/locales/t'
import {
  LayoutDashboard,
  Table as TableIcon,
  History,
  ShoppingBag,
  LogOut,
  User,
  ChefHat,
  CreditCard,
  HandHelping,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type NavItem = { label: string; to: string; icon: typeof LayoutDashboard; mobileShort?: string }

/** @deprecated dùng StaffPresence */
export type EmployeePresence = StaffPresence

function readStoredPresence(userId: string | undefined): StaffPresence {
  if (!userId || typeof window === 'undefined') return 'online'
  const raw = localStorage.getItem(employeePresenceStorageKey(userId))
  if (raw === 'away' || raw === 'offline' || raw === 'online') return raw
  return 'online'
}

export default function EmployeeLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const homePath = getEmployeeHomePath(user)
  const dataEmployeeRole = user?.notifyRole ?? 'all'
  const shopId = String(user?.shop?.id || (user as { shopId?: string }).shopId || '')

  const {
    socketStatus,
    emitStaffPresence,
    activeCallStaff,
    activeCallPayment,
    activeLoyaltyRedeems,
    newOrderNotify,
  } = useMerchantSocket(shopId)

  const [presence, setPresence] = useState<StaffPresence>(() => readStoredPresence(user?.id))

  useEffect(() => {
    queueMicrotask(() => setPresence(readStoredPresence(user?.id)))
  }, [user?.id])

  const setPresencePersist = (p: StaffPresence) => {
    setPresence(p)
    if (user?.id) localStorage.setItem(employeePresenceStorageKey(user.id), p)
  }

  useEffect(() => {
    const staff = user?.role === 'EMPLOYEE' || user?.role === 'staff'
    if (!staff) return
    if (!shopId || socketStatus !== 'connected') return
    emitStaffPresence({ merchantId: shopId, presence })
  }, [user?.role, shopId, presence, socketStatus, emitStaffPresence])

  const employeeNav = useMemo((): NavItem[] => {
    const items: NavItem[] = []

    if (canAccessFullDashboard(user)) {
      items.push({
        label: t('employee.nav.dashboard'),
        to: '/employee/dashboard',
        icon: LayoutDashboard,
        mobileShort: 'Home',
      })
    }

    if (canAccessService(user)) {
      items.push({
        label: t('employee.nav.service'),
        to: '/employee/service',
        icon: HandHelping,
        mobileShort: 'PVụ',
      })
    }

    if (user?.notifyRole !== 'kitchen') {
      items.push({
        label: t('employee.nav.tables'),
        to: '/employee/tables',
        icon: TableIcon,
      })
    }

    items.push({
      label: t('employee.nav.orders'),
      to: '/employee/orders',
      icon: History,
    })

    if (canAccessKitchen(user)) {
      items.push({
        label: t('employee.nav.kitchen'),
        to: '/employee/kitchen',
        icon: ChefHat,
      })
    }

    if (canAccessCashier(user)) {
      items.push({
        label: t('employee.nav.cashier'),
        to: '/employee/cashier',
        icon: CreditCard,
        mobileShort: 'Thu',
      })
    }

    const showPos =
      canAccessFullDashboard(user) ||
      canAccessService(user) ||
      canAccessCashier(user) ||
      user?.notifyRole === 'kitchen'

    if (showPos) {
      items.push({
        label: t('employee.nav.pos'),
        to: '/employee/pos',
        icon: ShoppingBag,
      })
    }

    return items
  }, [user])

  const fullBleed =
    location.pathname === '/employee/pos' || location.pathname === '/employee/kitchen'

  return (
    <div className="flex min-h-screen flex-col bg-surface-container-low pb-20 sm:pb-0">
      <nav className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4 lg:gap-6">
            <Link to={homePath} className="flex items-center gap-2 group shrink-0">
              <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                <span className="font-black text-lg">L</span>
              </div>
              <span className="text-lg font-black tracking-tighter text-slate-800 hidden sm:inline">
                Kivo Menu
              </span>
            </Link>

            <div className="hidden items-center gap-1 lg:flex flex-wrap">
              {employeeNav.map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-bold transition-all ${
                    location.pathname === to
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'text-slate-500 hover:bg-surface-container-low hover:text-slate-900'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center rounded-xl border border-slate-200 bg-surface-container-low/80 p-0.5">
              {(['online', 'away', 'offline'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPresencePersist(p)}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide transition-all',
                    presence === p
                      ? p === 'online'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : p === 'away'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-slate-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  {STAFF_PRESENCE_LABELS[p]}
                </button>
              ))}
            </div>
            <select
              className="md:hidden rounded-xl border border-slate-200 bg-surface text-[10px] font-bold text-slate-700 px-2 py-1.5 max-w-[7rem]"
              value={presence}
              onChange={(e) => setPresencePersist(e.target.value as StaffPresence)}
              aria-label="Trạng thái làm việc"
            >
              <option value="online">{STAFF_PRESENCE_LABELS.online}</option>
              <option value="away">{STAFF_PRESENCE_LABELS.away}</option>
              <option value="offline">{STAFF_PRESENCE_LABELS.offline}</option>
            </select>
            <NotificationBellView
              socketStatus={socketStatus}
              activeCallStaff={activeCallStaff}
              activeCallPayment={activeCallPayment}
              activeLoyaltyRedeems={activeLoyaltyRedeems}
              newOrderNotify={newOrderNotify}
            />
            <div className="h-8 w-[1px] bg-surface-container-low mx-1 hidden sm:block" />
            {user && (
              <div className="flex items-center gap-3 pl-1">
                <div className="hidden flex-col items-end sm:flex">
                  <span className="text-xs font-black text-slate-800 leading-none">{user.name}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    {t('employee.nav.staffBadge')}
                  </span>
                </div>
                <div className="relative">
                  <div
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 z-10 h-3 w-3 rounded-full border-2 border-white',
                      presence === 'online' && 'bg-emerald-500',
                      presence === 'away' && 'bg-amber-400',
                      presence === 'offline' && 'bg-slate-400',
                    )}
                    title={STAFF_PRESENCE_LABELS[presence]}
                  />
                  <div className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-slate-500 border border-slate-200 overflow-hidden">
                    <User size={18} />
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="hidden sm:flex w-9 h-9 rounded-xl bg-red-50 text-red-500 items-center justify-center hover:bg-red-100 transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main
        className={cn('flex-1 py-6', fullBleed ? 'px-0' : 'px-4')}
        data-employee-role={dataEmployeeRole}
      >
        <div className={cn('mx-auto', fullBleed ? 'max-w-none' : 'max-w-6xl')}>
          <Outlet />
        </div>
      </main>

      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none">
        <nav className="bg-surface/90 backdrop-blur-xl border border-slate-200/50 rounded-3xl shadow-2xl flex items-center justify-around p-2 pointer-events-auto overflow-x-auto no-scrollbar gap-0">
          {employeeNav.map(({ label, to, icon: Icon, mobileShort }) => {
            const isActive = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex flex-col items-center gap-1 py-2 px-2 transition-all duration-300 shrink-0 ${
                  isActive ? 'text-primary scale-110' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 w-8 h-1 bg-primary rounded-full animate-in fade-in zoom-in duration-300" />
                )}
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span
                  className={`text-[8px] font-black uppercase tracking-tighter max-w-[3.5rem] truncate text-center ${
                    isActive ? 'opacity-100' : 'opacity-60'
                  }`}
                >
                  {mobileShort ?? label}
                </span>
              </Link>
            )
          })}
          <button
            onClick={logout}
            className="flex flex-col items-center gap-1 py-2 px-2 text-slate-400 hover:text-red-500 transition-all shrink-0"
          >
            <LogOut size={22} />
            <span className="text-[8px] font-black uppercase tracking-tighter opacity-60">Thoát</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
