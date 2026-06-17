import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useMerchantNotifications } from './hooks/useMerchantNotifications';

import { OrderMenu } from './pages/OrderMenu';
import { TableHome } from './pages/TableHome';
import { PublicMenuBrowse } from './pages/PublicMenuBrowse';
import { LegacyMTableRedirect } from './routes/LegacyMTableRedirect';
import { MerchantDashboard } from './pages/MerchantDashboard';
import { PosTab } from './pages/merchant/PosTab';
import { LandingPage } from './pages/LandingPage';
import { MerchantPendingPage } from './pages/MerchantPendingPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminMerchantsPage from './pages/admin/AdminMerchantsPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import AdminShopsPage from './pages/admin/AdminShopsPage';
import AdminCustomersPage from './pages/admin/AdminCustomersPage';
import AdminAdminsPage from './pages/admin/AdminAdminsPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import CustomerLoginPage from './pages/auth/CustomerLoginPage';
import CustomerRegisterPage from './pages/auth/CustomerRegisterPage';
import CustomerHomePage from './pages/CustomerHomePage';
import { AdminLoginPage } from './pages/auth/AdminLoginPage';
import EmployeeLoginPage from './pages/auth/EmployeeLoginPage';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import EmployeeOrders from './pages/employee/EmployeeOrders';
import EmployeePosTab from './pages/employee/EmployeePosTab';
import EmployeeTables from './pages/employee/EmployeeTables';
import EmployeeKitchenBoard from './pages/employee/EmployeeKitchenBoard';
import EmployeeServiceBoard from './pages/employee/EmployeeServiceBoard';
import EmployeeCashierBoard from './pages/employee/EmployeeCashierBoard';
import EmployeeHomeRedirect from './pages/employee/EmployeeHomeRedirect';
import EmployeeLayout from './components/layout/EmployeeLayout';
import EmployeeGuard from './components/EmployeeGuard';
import { AdminAuthProvider, useAdminAuth } from './hooks/useAdminAuth';

function AppRoutes() {
  const { user, token, isLoading, logout } = useAuth();
  const { admin, isLoading: adminLoading, logout: adminLogout } = useAdminAuth();

  // Register push notifications automatically
  useMerchantNotifications(token);

  if (isLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isMerchant = user && (user.role === 'merchant' || (user as any).role === 'MERCHANT' || user.role === 'owner');
  const isCustomer = user?.role === 'CUSTOMER';
  const merchantAccountStatus = (user as { accountStatus?: string } | null)?.accountStatus;
  const merchantApproved =
    isMerchant && (!merchantAccountStatus || merchantAccountStatus === 'approved');

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/order/:shopId/:tableId" element={<TableHome />} />
      <Route path="/order/:shopId/:tableId/menu" element={<OrderMenu />} />
      <Route path="/m/:merchantId/t/:tableId" element={<LegacyMTableRedirect />} />
      <Route path="/m/:merchantId/t/:tableId/menu" element={<LegacyMTableRedirect menu />} />
      <Route path="/menu/:shopId" element={<PublicMenuBrowse />} />

      <Route
        path="/login"
        element={
          user
            ? isCustomer
              ? <Navigate to="/customer" replace />
              : isMerchant && merchantAccountStatus && merchantAccountStatus !== 'approved'
                ? <Navigate to="/merchant/pending" replace />
                : merchantApproved
                  ? <Navigate to="/merchant" replace />
                  : <Navigate to="/" replace />
            : <LoginPage />
        }
      />

      <Route
        path="/register"
        element={
          user
            ? isCustomer
              ? <Navigate to="/customer" replace />
              : isMerchant && merchantAccountStatus && merchantAccountStatus !== 'approved'
                ? <Navigate to="/merchant/pending" replace />
                : merchantApproved
                  ? <Navigate to="/merchant" replace />
                  : <Navigate to="/" replace />
            : <RegisterPage />
        }
      />

      <Route path="/customer/login" element={<CustomerLoginPage />} />
      <Route path="/customer/register" element={<CustomerRegisterPage />} />
      <Route path="/customer" element={<CustomerHomePage />} />

      <Route
        path="/merchant/pending"
        element={
          user && user.role === 'merchant' ? (
            merchantApproved ? (
              <Navigate to="/merchant" replace />
            ) : (
              <MerchantPendingPage />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="/admin/login"
        element={
          admin
            ? <Navigate to="/admin/dashboard" replace />
            : <AdminLoginPage />
        }
      />

      <Route
        path="/system-admin"
        element={<Navigate to="/admin/dashboard" replace />}
      />

      <Route
        path="/admin"
        element={
          admin ? (
            <AdminLayout adminName={admin?.name || ''} onLogout={adminLogout} />
          ) : (
            <Navigate to="/admin/login" replace />
          )
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="shops" element={<AdminShopsPage />} />
        <Route path="merchants" element={<AdminMerchantsPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="customers" element={<AdminCustomersPage />} />
        <Route path="admins" element={<AdminAdminsPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>

      <Route
        path="/merchant"
        element={
          user && user.role === 'merchant'
            ? merchantApproved ? (
              <MerchantDashboard
                merchantId={((user as any).id || (user as any).userId || '') as string}
                merchantName={user.name || ''}
                onLogout={logout}
              />
            ) : (
              <Navigate to="/merchant/pending" replace />
            )
            : <Navigate to="/login" replace />
        }
      />

      <Route
        path="/pos"
        element={
          merchantApproved
            ? <PosTab
              merchantId={((user as any).id || (user as any).userId || '') as string}
              merchantName={user.name || ''}
            />
            : <Navigate to="/login" replace />
        }
      />

      <Route path="/employee-login" element={<EmployeeLoginPage />} />
      <Route path="/shop/:shopSlug/login" element={<EmployeeLoginPage />} />

      <Route
        element={
          <EmployeeGuard>
            <EmployeeLayout />
          </EmployeeGuard>
        }
      >
        <Route path="/employee" element={<EmployeeHomeRedirect />} />
        <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
        <Route path="/employee/service" element={<EmployeeServiceBoard />} />
        <Route path="/employee/cashier" element={<EmployeeCashierBoard />} />
        <Route path="/employee/orders" element={<EmployeeOrders />} />
        <Route path="/employee/pos" element={<EmployeePosTab />} />
        <Route path="/employee/kitchen" element={<EmployeeKitchenBoard />} />
        <Route path="/employee/tables" element={<EmployeeTables />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AdminAuthProvider>
        <AuthProvider>
          <Toaster position="top-right" />
          <AppRoutes />
        </AuthProvider>
      </AdminAuthProvider>
    </Router>
  );
}

export default App;
