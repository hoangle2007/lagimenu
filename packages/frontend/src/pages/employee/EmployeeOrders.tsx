import { useState, useEffect } from 'react';
import { ordersApi } from '@/api/orders';
import { useAuth } from '@/hooks/useAuth';
import { useMerchantSocket } from '@/hooks/useMerchantSocket';
import toast from 'react-hot-toast';
import { RefreshCcw } from 'lucide-react';
import { normalizeOrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ORDER_STATUS_ACTIONS } from '@/lib/orderStatus';
import type { OrderStatus } from '@/api/types';
import api from '@/lib/api';

export default function EmployeeOrders() {
  const { user } = useAuth();
  const shopId = user?.shop?.id || (user as any)?.shopId || '';
  const hideAmounts = user?.notifyRole === 'waiter';

  const { refreshTrigger, socketStatus } = useMerchantSocket(shopId);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await ordersApi.list() as any;
      const orderList = (res.data?.orders || (Array.isArray(res.data) ? res.data : [])).map((o: any) => ({
        ...o,
        // Normalize status: DB lowercase → FE UPPER_SNAKE_CASE
        _rawStatus: o.status,
        status: normalizeOrderStatus(o.status),
        tableNumber: o.tableNumber || o.table_number || 'Quầy',
        totalPrice: o.totalPrice || o.total_price || 0,
        createdAt: o.createdAt || o.created_at || new Date().toISOString(),
      }));
      setOrders(orderList);
    } catch {
      toast.error('Không thể tải lịch sử đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      // Convert FE type → DB value, then send to compat endpoint
      const dbStatus = nextStatus.toLowerCase();
      await api.put(`/orders/merchant/${shopId}/${orderId}/status`, { status: dbStatus });
      toast.success(`Đã chuyển sang "${ORDER_STATUS_LABELS[nextStatus]}"`);
      await fetchOrders();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể cập nhật trạng thái');
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">Lịch sử đơn hàng</h1>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${socketStatus === 'connected' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600 animate-pulse'}`}>
             <div className={`w-1.5 h-1.5 rounded-full ${socketStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
             {socketStatus === 'connected' ? 'Trực tuyến' : 'Đang kết nối...'}
          </div>
        </div>
        <button 
          onClick={() => { setLoading(true); fetchOrders(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface shadow-sm border border-slate-100 text-sm font-bold text-slate-600 hover:text-primary hover:border-primary transition-all active:scale-95"
        >
          <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-12 bg-surface rounded-xl shadow-sm border border-slate-100">
            <p className="text-slate-500">Chưa có đơn hàng nào.</p>
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className="bg-surface rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col md:flex-row gap-4 justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-bold text-slate-800">Đơn #{order.id}</span>
                  <span className="text-sm font-medium text-slate-500">
                    {new Date(order.createdAt).toLocaleString('vi-VN')}
                  </span>
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${ORDER_STATUS_COLORS[order.status as OrderStatus]}`}>
                    {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-700">
                  Vị trí: Bàn {order.tableNumber}
                </p>
                <div className="mt-3 space-y-1">
                  {(order.items || []).map((item: any, idx: number) => (
                    <p key={idx} className="text-xs text-slate-600">
                      {item.quantity}x {item.product?.name || item.name}
                    </p>
                  ))}
                </div>
              </div>
              
              <div className="text-right flex flex-col justify-between">
                {!hideAmounts && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tổng cộng</p>
                    <p className="text-xl font-black text-primary">
                      {Intl.NumberFormat('vi-VN').format(order.totalPrice || order.totalAmount || 0)}đ
                    </p>
                  </div>
                )}
                {/* Status action button — only for non-terminal statuses */}
                {ORDER_STATUS_ACTIONS[order.status as OrderStatus] && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextLabel = ORDER_STATUS_ACTIONS[order.status as OrderStatus];
                      if (nextLabel) {
                        // Determine next status based on current status
                        const statusFlow: Record<OrderStatus, OrderStatus> = {
                          PENDING:    'CONFIRMED',
                          CONFIRMED:  'PREPARING',
                          PREPARING:  'READY',
                          READY:      'COMPLETED',
                          COMPLETED:  'PAID',
                          CANCELLED:  'CANCELLED',
                          PAID:       'PAID',
                        };
                        updateStatus(order.id, statusFlow[order.status as OrderStatus]);
                      }
                    }}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all active:scale-95"
                  >
                    {ORDER_STATUS_ACTIONS[order.status as OrderStatus]}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
