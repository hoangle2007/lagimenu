import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { TablesTab } from '../merchant/TablesTab';
import { useAuth } from '@/hooks/useAuth';
import { useMerchantSocket } from '@/hooks/useMerchantSocket';
import { getEmployeeHomePath } from '@/lib/employeeRoles';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function EmployeeTables() {
  const { user } = useAuth();
  const shopId = user?.shop?.id || (user as any)?.shopId || '';
  const { refreshTrigger } = useMerchantSocket(shopId);
  const [tableCount, setTableCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMerchantSettings = async () => {
      if (!shopId) return;
      try {
        const res = await api.get(`/merchants/${shopId}`);
        setTableCount(res.data?.table_count ?? 10);
      } catch (err) {
        console.error('Error fetching table count:', err);
        setTableCount(10); // fallback
      } finally {
        setLoading(false);
      }
    };
    fetchMerchantSettings();
  }, [shopId]);

  if (user?.notifyRole === 'kitchen') {
    return <Navigate to={getEmployeeHomePath(user)} replace />;
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Bàn</h1>
          <p className="mt-1 text-sm text-gray-500">Xem trạng thái bàn và thực hiện dọn bàn/thanh toán.</p>
        </div>
      </div>

      <div className=" rounded-3xl shadow-premium-sm border border-slate-100 overflow-hidden">
        <TablesTab
          merchantId={shopId}
          refreshKey={refreshTrigger}
          tableCount={tableCount}
        />
      </div>
    </div>
  );
}
