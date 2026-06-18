import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardList, Table as TableIcon, BarChart2, Settings,
  ShoppingBag, Bell, LogOut, Check, X, CreditCard,
  Clock, Play, Loader2, RefreshCw, User, Search, Download, ChevronLeft, ChevronRight, Eye, XCircle, Users, Phone, Mail, ShoppingCart, TrendingUp, Calendar,
  QrCode, AlertTriangle, Archive, Printer, Scissors, Gift
} from 'lucide-react';
import api from '../lib/api';
import { ordersApi } from '../api/orders';
import { employeesApi, type EmployeeWithUser } from '../api/employees';
import { STAFF_PRESENCE_LABELS } from '../lib/staffPresence';
import toast from 'react-hot-toast';
import { ReportTab } from './merchant/ReportTab';
import { SettingsTab } from './merchant/SettingsTab';
import { TablesTab } from './merchant/TablesTab';
import { PosTab } from './merchant/PosTab';
import { OrderHistoryTab } from './merchant/OrderHistoryTab';
import { LoyaltyTab } from './merchant/LoyaltyTab';
import { OnboardingModal } from '../components/merchant/OnboardingModal';
import { useMerchantSocket } from '../hooks/useMerchantSocket';
import {
  Badge, Button, Card, CardContent, Separator,
  TooltipProvider, Tooltip, TooltipTrigger, TooltipContent
} from '../components/ui';
import { cn } from '../lib/utils';
import { registerMerchantWebPush } from '../lib/webPush';

interface OrderItem {
  id?: number;
  productId?: number;
  product: { id?: number; name: string };
  quantity: number;
  price: string;
  note?: string;
  notes?: string;
}
interface Order {
  id: number; tableNumber: string;
  customerName?: string;
  customerPhone?: string;
  clientIp?: string | null;
  clientLat?: number | null;
  clientLng?: number | null;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'paid' | 'cancelled';
  totalPrice: string; items: OrderItem[]; createdAt: string;
  type?: 'order' | 'call_staff' | 'payment';
}
type Tab = 'pos' | 'orders' | 'tables' | 'report' | 'settings' | 'customers' | 'history' | 'loyalty';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string;
  createdAt: string;
}

interface Activity {
  id: string;
  type: 'order' | 'call_staff' | 'call_payment' | 'ready' | 'status_change' | 'loyalty_redeem';
  title: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

interface MerchantDashboardProps {
  merchantId: string;
  merchantName: string;
  onLogout: () => void;
}

const statusLabel: Record<string, string> = {
  pending: 'Chờ nhận',
  confirmed: 'Đã nhận',
  preparing: 'Đang nấu',
  ready: 'Xong',
  completed: 'Đã bưng',
  paid: 'Đã thanh toán',
  cancelled: 'Đã hủy'
};

const getItemNote = (item: { note?: string; notes?: string }) => item.note ?? item.notes ?? '';

/** Hiển thị ghi chú/tùy chọn — chuẩn hóa %% → % (escape kép từ dữ liệu). */
const formatItemNoteDisplay = (item: { note?: string; notes?: string }) => {
  const raw = getItemNote(item).trim();
  if (!raw) return '';
  return raw.replace(/%%/g, '%');
};

interface MerchantInfo {
  id: string;
  name: string;
  bankName?: string;
  bankAccount?: string;
  bankOwner?: string;
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────
const OrderDetailModal: React.FC<{ 
  order: Order; 
  onClose: () => void; 
  onStatusChange: (order: Order, status: Order['status']) => Promise<void>; 
  updatingId: number | null,
  merchantInfo: MerchantInfo | null
}> = ({ order, onClose, onStatusChange, updatingId, merchantInfo }) => {
  const [paymentStep, setPaymentStep] = useState<'details' | 'method_select' | 'qr_code'>('details');
  const [method, setMethod] = useState<'cash' | 'vietqr'>('cash');
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const statusFlow: Order['status'][] = ['pending', 'preparing', 'ready', 'completed', 'paid'];
  const nextStatus = (current: Order['status']): Order['status'] | null => {
    const idx = statusFlow.indexOf(current);
    return idx >= 0 && idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null;
  };

  const nextLabel = (status: Order['status']) => {
    switch (status) {
      case 'pending': return { label: 'Tiếp nhận', icon: Play, color: 'bg-primary hover:bg-primary-hover' };
      case 'preparing': return { label: 'Nấu xong', icon: Check, color: 'bg-indigo-600 hover:bg-indigo-700' };
      case 'ready': return { label: 'Đã phục vụ', icon: ShoppingBag, color: 'bg-emerald-600 hover:bg-emerald-700' };
      case 'completed': return { label: 'Thanh toán', icon: CreditCard, color: 'bg-slate-900 hover:bg-black' };
      default: return null;
    }
  };

  const handleAction = async () => {
    if (order.status === 'completed') {
      setPaymentStep('method_select');
      return;
    }
    await onStatusChange(order, nextStatus(order.status)!);
  };

  const handlePayment = async () => {
    await onStatusChange(order, 'paid');
    onClose();
  };

  const vietQrUrl = useMemo(() => {
    if (!merchantInfo?.bankAccount || !merchantInfo?.bankName) return null;
    // Format info: OrderID - Bàn
    const info = `GUKIVO DH${order.id} BAN ${order.tableNumber}`;
    return `https://img.vietqr.io/image/${merchantInfo.bankName}-${merchantInfo.bankAccount}-compact.png?amount=${order.totalPrice}&addInfo=${encodeURIComponent(info)}&accountName=${encodeURIComponent(merchantInfo.bankOwner || '')}`;
  }, [merchantInfo, order]);

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface w-full sm:w-[420px] sm:max-w-[420px] sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag Handle (mobile) */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-1" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-primary">
              {paymentStep === 'details' ? <ClipboardList size={20} /> : <CreditCard size={20} />}
            </div>
            <div>
              <p className="font-black text-base leading-tight">
                {paymentStep === 'details' ? `Đơn #${order.id}` : 'Thanh toán'}
              </p>
              <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">Bàn {order.tableNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {paymentStep === 'details' && (
              <button
                type="button"
                onClick={() => handlePrint()}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                title="In hóa đơn"
              >
                <Printer size={16} />
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
          {paymentStep === 'details' ? (
            <div className="space-y-6" ref={printRef}>
              {/* Status Header */}
              <div className="flex items-center justify-between">
                <Badge 
                  variant={order.status === 'pending' ? 'secondary' : order.status === 'paid' ? 'success' : 'default'}
                  className="px-3 py-1 font-black text-[10px] uppercase tracking-widest"
                >
                  {statusLabel[order.status] || order.status}
                </Badge>
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <Clock size={12} />
                  <span>{new Date(order.createdAt).toLocaleTimeString('vi-VN')}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chi tiết món ăn</p>
                <div className="bg-surface-container-low/50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                  {order.items.map((item, i) => (
                    <div key={item.id ?? i} className="flex flex-col gap-2 p-4 bg-surface/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0">
                            {item.quantity}
                          </div>
                          <p className="text-sm font-black text-slate-800 leading-tight truncate">{item.product.name}</p>
                        </div>
                        <span className="text-sm font-black text-slate-500 shrink-0">
                          {Intl.NumberFormat('vi-VN').format(Number(item.price || 0))}đ
                        </span>
                      </div>
                      {formatItemNoteDisplay(item) ? (
                        <div className="ml-11 rounded-xl border border-primary/15 bg-surface-container-low px-3 py-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Tuỳ chọn &amp; ghi chú</p>
                          <p className="text-sm font-semibold text-slate-700 whitespace-pre-wrap leading-relaxed">{formatItemNoteDisplay(item)}</p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

               {/* Customer */}
               <div className="p-4 bg-surface-container-low rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Thông tin khách</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                    <User size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800">{order.customerName || 'Khách vãng lai'}</p>
                    {order.customerPhone && <p className="text-xs font-bold text-primary">{order.customerPhone}</p>}
                    {order.clientIp && (
                      <p className="text-[10px] font-mono text-slate-500 mt-2">IP khách: {order.clientIp}</p>
                    )}
                    {order.clientLat != null &&
                      order.clientLng != null &&
                      Number.isFinite(order.clientLat) &&
                      Number.isFinite(order.clientLng) && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          GPS: {order.clientLat.toFixed(5)}, {order.clientLng.toFixed(5)}
                        </p>
                      )}
                  </div>
                </div>
              </div>
            </div>
          ) : paymentStep === 'method_select' ? (
            <div className="space-y-6 py-4">
               <div className="text-center space-y-2 mb-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tổng thanh toán</p>
                  <p className="text-4xl font-black text-primary tracking-tight">{Intl.NumberFormat('vi-VN').format(+order.totalPrice)}đ</p>
               </div>

               <div className="space-y-3">
                  <button 
                    onClick={() => setMethod('cash')}
                    className={cn(
                      "w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all group active:scale-95",
                      method === 'cash' ? "border-primary bg-primary/5 shadow-premium" : "border-slate-100 hover:border-primary/20"
                    )}
                  >
                     <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", method === 'cash' ? "bg-primary text-white" : "bg-surface-container-low text-slate-400")}>
                           <ShoppingBag size={24} />
                        </div>
                        <div className="text-left">
                           <p className="font-black text-sm text-slate-800">Tiền mặt</p>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thanh toán tại quầy</p>
                        </div>
                     </div>
                     <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center", method === 'cash' ? "border-primary bg-primary text-white" : "border-slate-200")}>
                        {method === 'cash' && <Check size={14} strokeWidth={4} />}
                     </div>
                  </button>

                  <button 
                    onClick={() => setMethod('vietqr')}
                    className={cn(
                      "w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all group active:scale-95",
                      method === 'vietqr' ? "border-indigo-600 bg-indigo-50 shadow-premium" : "border-slate-100 hover:border-indigo-600/20"
                    )}
                  >
                     <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", method === 'vietqr' ? "bg-indigo-600 text-white" : "bg-surface-container-low text-slate-400")}>
                           <QrCode size={24} />
                        </div>
                        <div className="text-left">
                           <p className="font-black text-sm text-slate-800">Chuyển khoản (VietQR)</p>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quét mã nhanh qua App</p>
                        </div>
                     </div>
                     <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center", method === 'vietqr' ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200")}>
                        {method === 'vietqr' && <Check size={14} strokeWidth={4} />}
                     </div>
                  </button>
               </div>
               
               {method === 'vietqr' && (!merchantInfo?.bankAccount || !merchantInfo?.bankName) && (
                 <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-amber-800">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black">Chưa thiết lập tài khoản!</p>
                      <p className="text-[10px] font-medium leading-relaxed mt-1 opacity-80">Vui lòng vào phần Cài đặt để cập nhật thông tin Ngân hàng trước khi dùng VietQR.</p>
                    </div>
                 </div>
               )}
            </div>
          ) : (
            <div className="space-y-6 pt-2 pb-6 flex flex-col items-center">
               <div className="text-center">
                  <p className="text-sm font-black text-slate-800 mb-1">Quét mã để thanh toán</p>
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.15em]">{Intl.NumberFormat('vi-VN').format(+order.totalPrice)}đ</p>
               </div>

               <div className="relative p-6 bg-surface rounded-[2.5rem] shadow-premium border-4 border-slate-50 flex flex-col items-center text-center">
                  {vietQrUrl ? (
                    <>
                      <img src={vietQrUrl} alt="VietQR" className="w-56 h-56 object-contain" />
                      <div className="mt-4 space-y-1">
                        <p className="text-xs font-black text-slate-900">{merchantInfo?.bankName?.toUpperCase()} - {merchantInfo?.bankAccount}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{merchantInfo?.bankOwner}</p>
                      </div>
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-indigo-600 text-white rounded-full flex items-center gap-2 shadow-xl">
                        <CreditCard size={12} fill="white" />
                        <span className="text-[10px] font-black tracking-widest uppercase">VietQR</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-300 gap-3">
                      <QrCode size={48} strokeWidth={1} />
                      <p className="text-[10px] font-black uppercase text-center">Lỗi tạo mã QR</p>
                    </div>
                  )}
               </div>

               <p className="text-[10px] text-center font-bold text-slate-400 leading-relaxed px-8">
                  Nội dung: <span className="text-slate-900">DH{order.id} BAN {order.tableNumber}</span> <br/>
                  Khách hàng quét mã bằng App Ngân hàng bất kỳ.
               </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-5 bg-surface-container-low border-t border-slate-100">
           {paymentStep === 'details' ? (
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Tổng cộng</span>
                    <span className="text-2xl font-black text-primary tracking-tight">{Intl.NumberFormat('vi-VN').format(+order.totalPrice)}đ</span>
                 </div>
                 {nextLabel(order.status) ? (
                   <Button
                     className={cn("w-full h-14 rounded-2xl text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-primary/20", nextLabel(order.status)!.color)}
                     onClick={handleAction}
                     disabled={updatingId === order.id}
                   >
                     {updatingId === order.id ? <Loader2 size={16} className="animate-spin" /> : React.createElement(nextLabel(order.status)!.icon, { size: 18, strokeWidth: 3 })}
                     {nextLabel(order.status)!.label}
                   </Button>
                 ) : (
                   <Badge variant="success" className="w-full h-14 rounded-2xl flex items-center justify-center font-black uppercase tracking-widest text-[11px] pointer-events-none opacity-80">
                     <Check className="mr-2" size={16} strokeWidth={3} /> Đã hoàn tất
                   </Badge>
                 )}
              </div>
           ) : paymentStep === 'method_select' ? (
              <div className="flex gap-4">
                 <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[11px]" onClick={() => setPaymentStep('details')}>Quay lại</Button>
                 <Button 
                   className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] gap-2 shadow-lg shadow-primary/20"
                   disabled={method === 'vietqr' && (!merchantInfo?.bankAccount || !merchantInfo?.bankName)}
                   onClick={() => method === 'cash' ? handlePayment() : setPaymentStep('qr_code')}
                 >
                    Tiếp tục
                 </Button>
              </div>
           ) : (
              <div className="flex gap-4">
                 <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[11px]" onClick={() => setPaymentStep('method_select')}>Đổi phương thức</Button>
                 <Button 
                   className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-600/20" 
                   onClick={handlePayment}
                 >
                    Xác nhận đã chuyển
                 </Button>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};

// ─── Customers Tab ────────────────────────────────────────────────────────────
const CustomersTab: React.FC<{ merchantId: string }> = ({ merchantId }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const PAGE_SIZE = 10;

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      // Try to fetch from customers endpoint, fallback to extracting from orders
      let customersData: Customer[] = [];
      try {
        const res = await api.get(`/merchants/${merchantId}/customers`);
        customersData = (res.data?.customers || res.data || []).map((c: any) => ({
          id: c.id || c.phone,
          name: c.name || 'Khách',
          phone: c.phone || c.customer_phone || '',
          email: c.email,
          totalOrders: Number(c.totalOrders || c.total_orders || c.orderCount || 0),
          totalSpent: Number(c.totalSpent || c.total_spent || 0),
          lastOrderAt: c.lastOrderAt || c.last_order_at || new Date().toISOString(),
          createdAt: c.createdAt || c.created_at || new Date().toISOString(),
        }));
      } catch {
        // Fallback: extract unique customers from orders
        const ordersRes = await api.get(`/orders/merchant/${merchantId}`);
        const orders: any[] = ordersRes.data?.orders || [];
        const customerMap = new Map<string, Customer>();
        orders.forEach((o: any) => {
          const phone = o.customer_phone || o.customerPhone;
          if (!phone) return;
          const existing = customerMap.get(phone);
          const order = {
            id: o.id,
            total: Number(o.total_price || o.totalPrice || 0),
            createdAt: o.created_at || o.createdAt,
          };
          if (existing) {
            existing.totalOrders += 1;
            existing.totalSpent += order.total;
            if (new Date(order.createdAt) > new Date(existing.lastOrderAt)) {
              existing.lastOrderAt = order.createdAt;
            }
          } else {
            customerMap.set(phone, {
              id: phone,
              name: o.customer_name || o.customerName || 'Khách',
              phone,
              email: o.customer_email || o.customerEmail,
              totalOrders: 1,
              totalSpent: order.total,
              lastOrderAt: order.createdAt,
              createdAt: order.createdAt,
            });
          }
        });
        customersData = Array.from(customerMap.values());
      }
      setCustomers(customersData);
    } catch (e) {
      console.error('Failed to fetch customers:', e);
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  }, [customers, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const stats = useMemo(() => ({
    total: customers.length,
    totalRevenue: customers.reduce((s, c) => s + c.totalSpent, 0),
    avgOrder: customers.length > 0 ? Math.round(customers.reduce((s, c) => s + (c.totalSpent / Math.max(1, c.totalOrders)), 0) / customers.length) : 0,
  }), [customers]);

  return (
    <>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-none shadow-premium">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Users size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tổng khách hàng</p>
                  <p className="text-2xl font-black text-slate-800">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-premium">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <TrendingUp size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tổng chi tiêu</p>
                  <p className="text-lg font-black text-emerald-600">{Intl.NumberFormat('vi-VN').format(stats.totalRevenue)}đ</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-premium">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <ShoppingCart size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">TB/Đơn</p>
                  <p className="text-lg font-black text-amber-600">{Intl.NumberFormat('vi-VN').format(stats.avgOrder)}đ</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, số điện thoại..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <XCircle size={16} />
              </button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={fetchCustomers} className="rounded-xl gap-2 font-bold">
            <RefreshCw size={16} /> Làm mới
          </Button>
        </div>

        {/* Results info */}
        {!loading && (
          <div className="text-sm text-slate-500 font-medium">
            {filtered.length > 0
              ? `Hiển thị ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} trong ${filtered.length} khách hàng`
              : 'Không tìm thấy khách hàng nào'}
          </div>
        )}

        {/* Customer List */}
        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : paginatedCustomers.length === 0 ? (
          <Card className="border-none shadow-premium">
            <CardContent className="py-16 text-center">
              <Users size={48} className="mx-auto text-slate-200 mb-4" />
              <p className="font-bold text-slate-400">Chưa có thông tin khách hàng</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-premium overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Khách hàng</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Liên hệ</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Đơn hàng</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Tổng chi tiêu</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Mua gần nhất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-slate-100">
                  {paginatedCustomers.map(customer => (
                    <tr
                      key={customer.id}
                      className="hover:bg-surface-container-low/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                            {customer.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{customer.name}</p>
                            <p className="text-xs text-slate-400">#{customer.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-primary">
                            <Phone size={12} /> {customer.phone}
                          </a>
                          {customer.email && (
                            <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-primary">
                              <Mail size={12} /> {customer.email}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-sm font-bold text-slate-700">{customer.totalOrders}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-black text-primary">{Intl.NumberFormat('vi-VN').format(customer.totalSpent)}đ</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
                          <Calendar size={12} />
                          {new Date(customer.lastOrderAt).toLocaleDateString('vi-VN')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-xl">
              <ChevronLeft size={16} />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn("w-9 h-9 rounded-xl text-sm font-bold transition-all", page === currentPage ? "bg-primary text-white" : "text-slate-500 hover:bg-surface-container-low")}
                    >
                      {page}
                    </button>
                  );
                }
                if (page === 2 || page === totalPages - 1) return <span key={page} className="px-2 text-slate-400">...</span>;
                return null;
              })}
            </div>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-xl">
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedCustomer(null)}>
          <div
            className="bg-surface w-full sm:w-[420px] sm:max-w-[420px] sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-primary to-primary/90 text-white shrink-0">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-black">
                {selectedCustomer.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-lg leading-tight truncate">{selectedCustomer.name}</p>
                <p className="text-xs text-white/70">Khách hàng #{selectedCustomer.id}</p>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Contact Info */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Liên hệ</p>
                <div className="bg-surface-container-low rounded-xl p-3 space-y-2">
                  <a href={`tel:${selectedCustomer.phone}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary">
                    <Phone size={14} className="text-primary" /> {selectedCustomer.phone}
                  </a>
                  {selectedCustomer.email && (
                    <a href={`mailto:${selectedCustomer.email}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary">
                      <Mail size={14} className="text-primary" /> {selectedCustomer.email}
                    </a>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Thống kê</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-blue-600">{selectedCustomer.totalOrders}</p>
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Đơn hàng</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-emerald-600">{Intl.NumberFormat('vi-VN').format(selectedCustomer.totalSpent)}đ</p>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Tổng chi tiêu</p>
                  </div>
                </div>
                <div className="bg-surface-container-low rounded-xl p-3 text-center">
                  <p className="text-sm font-bold text-slate-600">
                    TB: {Intl.NumberFormat('vi-VN').format(Math.round(selectedCustomer.totalSpent / Math.max(1, selectedCustomer.totalOrders)))}đ/đơn
                  </p>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hoạt động</p>
                <div className="bg-surface-container-low rounded-xl p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mua gần nhất</span>
                    <span className="font-bold text-slate-700">{new Date(selectedCustomer.lastOrderAt).toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Khách hàng từ</span>
                    <span className="font-bold text-slate-700">{new Date(selectedCustomer.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-4 bg-surface-container-low border-t border-slate-100">
              <Button variant="outline" className="w-full h-11 rounded-xl font-bold" onClick={() => setSelectedCustomer(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Orders Tab ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 12;

const OrdersTab: React.FC<{ 
  merchantId: string; 
  refreshKey: number; 
  updatedOrder?: any;
  merchantInfo: MerchantInfo | null;
}> = ({ merchantId, refreshKey, updatedOrder, merchantInfo }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'preparing' | 'ready' | 'all'>('pending');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [splitDrafts, setSplitDrafts] = useState<Record<number, { ids: string; newTable: string }>>({});
  const [splittingOrderId, setSplittingOrderId] = useState<number | null>(null);

  const parseSplitItemIds = (raw: string) =>
    raw
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);

  const appendSuggestedOrderItemId = (current: string, itemId: number) => {
    const parsed = parseSplitItemIds(current);
    if (parsed.includes(itemId)) return current;
    const t = current.trim();
    return t ? `${t}, ${itemId}` : String(itemId);
  };

  const fetchOrders = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get(`/orders/merchant/${merchantId}`);
      const rawList: any[] = res.data?.orders ?? (Array.isArray(res.data) ? res.data : []);
      const mapped: Order[] = rawList.map((o: any) => ({
        id: o.id,
        tableNumber: o.table_number ?? o.tableNumber ?? '??',
        customerName: o.customer_name ?? o.customerName ?? null,
        customerPhone: o.customer_phone ?? o.customerPhone ?? null,
        clientIp: o.client_ip ?? o.clientIp ?? null,
        clientLat: o.client_lat != null ? Number(o.client_lat) : o.clientLat != null ? Number(o.clientLat) : null,
        clientLng: o.client_lng != null ? Number(o.client_lng) : o.clientLng != null ? Number(o.clientLng) : null,
        status: o.status,
        totalPrice: String(o.total_price ?? o.totalPrice ?? 0),
        items: Array.isArray(o.items)
          ? o.items.map((it: any) => ({
              id:
                typeof it.id === 'number' && Number.isFinite(it.id)
                  ? it.id
                  : it.id != null && String(it.id).trim() !== ''
                    ? Number(it.id)
                    : undefined,
              productId:
                it.productId != null && String(it.productId).trim() !== ''
                  ? Number(it.productId)
                  : undefined,
              quantity: Number(it.quantity) || 0,
              price: String(it.price ?? ''),
              note: it.note,
              notes: it.notes,
              product: {
                id:
                  it.product?.id != null && String(it.product.id).trim() !== ''
                    ? Number(it.product.id)
                    : undefined,
                name: it.product?.name ?? '?',
              },
            }))
          : [],
        createdAt: o.created_at ?? o.createdAt ?? new Date().toISOString(),
        type: o.type,
      }));
      setOrders(mapped);
    } catch (err: any) {
      console.error('Fetch orders error:', err);
      setError(err?.message || 'Không thể tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders, refreshKey]);

  // Real-time in-place update when socket emits orderStatusUpdated
  useEffect(() => {
    if (!updatedOrder?.id) return;
    setOrders(prev => prev.map(o =>
      o.id === updatedOrder.id
        ? { ...o, status: updatedOrder.status }
        : o
    ));
  }, [updatedOrder]);

  const handleStatus = async (order: Order, status: Order['status']) => {
    if (!merchantId || merchantId === 'undefined') {
      console.error('[OrdersTab] Missing valid merchantId');
      return;
    }
    setUpdatingId(order.id);
    try {
      // Use merchant-scoped endpoint for correct auth
      await api.put(`/orders/merchant/${merchantId}/${order.id}/status`, { status });
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status } : o));

      // Khi chuyển sang "ready" (nấu xong) -> gửi thông báo cho nhân viên mang ra bàn
      if (status === 'ready') {
        try {
          await ordersApi.notifyReady(merchantId, order.id, order.tableNumber);
          toast.success(`Đã gửi thông báo: "Bàn ${order.tableNumber} mang đơn ra!"`);
        } catch (notifyErr) {
          console.warn('[OrdersTab] Failed to send ready notification:', notifyErr);
          toast.success(`Đã cập nhật! Bàn ${order.tableNumber} nấu xong rồi!`);
        }
      }
    } catch {
      // silently handle
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmSplitBill = async (order: Order) => {
    const draft = splitDrafts[order.id];
    const itemIds = parseSplitItemIds(draft?.ids ?? '');
    if (itemIds.length === 0) {
      toast.error('Vui lòng nhập ít nhất một ID order_items hợp lệ (số, cách nhau bằng dấu phẩy).');
      return;
    }
    setSplittingOrderId(order.id);
    try {
      await api.post('/orders/bills/split-items', {
        sourceOrderId: order.id,
        itemIds,
        newTableNumber: draft?.newTable?.trim() ? draft.newTable.trim() : undefined,
      });
      toast.success('Đã tách dòng món sang đơn mới.');
      setSplitDrafts((prev) => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
      await fetchOrders();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        (Array.isArray(err?.response?.data?.message) ? err.response.data.message.join(', ') : null) ??
        err?.message;
      toast.error(typeof msg === 'string' && msg ? msg : 'Không thể tách đơn.');
    } finally {
      setSplittingOrderId(null);
    }
  };

  const elapsed = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    return m < 1 ? 'Vừa xong' : m < 60 ? `${m} phút` : `${Math.floor(m / 60)}h`;
  };

  // Filter orders based on status and search query
  const filtered: Order[] = useMemo(() => {
    return orders.filter(o => {
      if (o.type === 'call_staff') return false;
      if (filter !== 'all' && o.status !== filter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchId = String(o.id).includes(query);
        const matchTable = o.tableNumber.toLowerCase().includes(query);
        const matchCustomer = (o.customerName || '').toLowerCase().includes(query);
        const matchIp = (o.clientIp || '').toLowerCase().includes(query);
        if (!matchId && !matchTable && !matchCustomer && !matchIp) return false;
      }
      return true;
    });
  }, [orders, filter, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedOrders: Order[] = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  // Reset page when filter or search changes
  useEffect(() => { setCurrentPage(1); }, [filter, searchQuery]);

  // Export to Excel (CSV format)
  const handleExportExcel = () => {
    const headers = ['Mã đơn', 'Bàn', 'Khách hàng', 'SĐT', 'IP khách', 'Trạng thái', 'Tổng tiền', 'Thời gian', 'Món'];
    const rows = filtered.map(o => [
      `#${o.id}`,
      `Bàn ${o.tableNumber}`,
      o.customerName || 'Khách',
      o.customerPhone || '',
      o.clientIp || '',
      o.status === 'pending' ? 'Chờ xử lý' :
        o.status === 'preparing' ? 'Đang nấu' :
        o.status === 'ready' ? 'Sẵn sàng' :
        o.status === 'completed' ? 'Hoàn tất' :
        o.status === 'paid' ? 'Đã thanh toán' : 'Đã hủy',
      `${Intl.NumberFormat('vi-VN').format(+o.totalPrice)}đ`,
      new Date(o.createdAt).toLocaleString('vi-VN'),
      o.items.map(it => `${it.quantity}x ${it.product.name}`).join('; '),
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `don-hang-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const stats = useMemo(() => ({
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
    completed: orders.filter(o => o.status === 'completed').length,
    revenue: orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + +o.totalPrice, 0),
  }), [orders]);

  if (loading) return (
    <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary" size={24} /></div>
  );

  return (
    <>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { key: 'pending', label: 'Chờ xử lý', value: stats.pending, clickFilter: 'pending' as const, color: 'text-primary' },
            { key: 'preparing', label: 'Đang làm', value: stats.preparing, clickFilter: 'preparing' as const, color: 'text-amber-600' },
            { key: 'completed', label: 'Hoàn tất', value: stats.completed, clickFilter: 'all' as const, color: 'text-emerald-600' },
            { key: 'revenue', label: 'Doanh thu', value: `${Math.floor(stats.revenue / 1000)}k`, clickFilter: 'all' as const, color: 'text-primary' },
          ].map((s) => (
            <Card
              key={s.key}
              onClick={() => setFilter(s.clickFilter)}
              className={cn("cursor-pointer transition-all hover:shadow-md", filter === s.clickFilter && s.key !== 'revenue' ? 'ring-2 ring-primary/20 shadow-md transform scale-[1.02]' : '')}
            >
              <CardContent className="pt-6 pb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2">{s.label}</p>
                <p className={`text-4xl font-black ${s.color} tracking-tight`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Toolbar: Filter tabs + Search + Export */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex bg-surface/60 backdrop-blur-sm border border-outline-variant/20 rounded-xl p-1.5 gap-1.5 shadow-sm">
            {([['pending', 'Chờ xử lý'], ['preparing', 'Đang nấu'], ['ready', 'Nấu xong'], ['all', 'Lịch sử']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all",
                  filter === id ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-500 hover:text-primary hover:bg-primary/5"
                )}
              >
                {label}
                {(id === 'pending' || id === 'preparing' || id === 'ready') && stats[id as keyof typeof stats] > 0 && (
                  <span className={cn("text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center", filter === id ? "bg-white/25" : "bg-primary/10 text-primary")}>
                    {stats[id as keyof typeof stats]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã đơn, bàn, khách, IP..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-48 lg:w-64 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <XCircle size={16} />
                </button>
              )}
            </div>

            {/* Export */}
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="rounded-xl gap-2 font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50">
              <Download size={16} />
              <span className="hidden sm:inline">Export</span>
            </Button>

            {/* Refresh */}
            <Button variant="ghost" size="icon" onClick={fetchOrders} className="rounded-xl hover:bg-primary/10 hover:text-primary">
              <RefreshCw size={16} />
            </Button>
          </div>
        </div>

        {/* Results info */}
        {!loading && (
          <div className="text-sm text-slate-500 font-medium px-1">
            {filtered.length > 0
              ? `Hiển thị ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} trong ${filtered.length} đơn hàng`
              : 'Không tìm thấy đơn hàng nào'}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {error && (
            <div className="col-span-full p-6 bg-red-50 border border-red-100 rounded-2xl flex flex-col items-center gap-3">
              <p className="text-red-600 font-bold text-sm text-center">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchOrders} className="text-red-600 border-red-200 hover:bg-red-100">
                <RefreshCw size={14} className="mr-2" /> Thử lại
              </Button>
            </div>
          )}

          {paginatedOrders.length === 0 && !loading && !error && (
            <div className="col-span-full py-24 text-center bg-surface/40 rounded-3xl border border-dashed border-outline-variant/30">
              <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock size={32} className="text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Không có đơn hàng nào</p>
              {searchQuery && <p className="text-xs text-slate-400 mt-2">Thử từ khóa khác</p>}
            </div>
          )}

          {paginatedOrders.map(order => (
            <Card key={order.id} className="overflow-hidden transition-all duration-300 border-none ring-1 ring-outline-variant/10 shadow-premium hover:shadow-xl">
              <div className={cn("flex items-center justify-between px-6 py-5 border-b border-outline-variant/8", order.status === 'pending' ? "bg-primary/[0.03]" : "bg-surface")}>
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner", {
                    'bg-primary/10 text-primary': order.status === 'pending',
                    'bg-amber-50 text-amber-600': order.status === 'preparing',
                    'bg-emerald-50 text-emerald-600': order.status === 'completed',
                  })}>
                    <TableIcon size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-black text-xl text-on-surface tracking-tight leading-none">Bàn {order.tableNumber}</p>
                      <span className="text-xs text-slate-400 font-bold">#{order.id}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {order.customerName && (
                        <span className="text-[10px] font-black text-primary uppercase flex items-center gap-1">
                          <User size={10} className="fill-primary/10" />
                          {order.customerName}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                        {order.customerName && <span className="w-1 h-1 rounded-full bg-slate-200" />}
                        {elapsed(order.createdAt)}
                      </span>
                      {order.clientIp && (
                        <span className="text-[9px] font-mono text-slate-400 w-full">IP {order.clientIp}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={order.status === 'pending' ? 'default' : order.status === 'preparing' ? 'warning' : 'success'}>
                    {order.status === 'pending' ? 'Chờ' : order.status === 'preparing' ? 'Làm' : 'Xong'}
                  </Badge>
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="text-[10px] text-primary hover:text-primary/70 font-bold flex items-center gap-1 transition-colors"
                  >
                    <Eye size={12} /> Chi tiết
                  </button>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4 min-h-[100px]">
                {order.items.slice(0, 3).map((item, i) => (
                  <div key={item.id ?? `item-${order.id}-${i}`} className="flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-bold text-on-surface flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">{item.quantity}</span>
                        <span className="truncate">{item.product.name}</span>
                      </p>
                    </div>
                    {formatItemNoteDisplay(item) ? (
                      <div className="rounded-xl border border-primary/15 bg-surface-container-low/95 px-3 py-2.5 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tuỳ chọn &amp; ghi chú</p>
                        <p className="text-base font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">{formatItemNoteDisplay(item)}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
                {order.items.length > 3 && (
                  <p className="text-xs text-slate-400 font-medium">+{order.items.length - 3} món khác</p>
                )}

                {order.items.length > 0 &&
                  order.status !== 'paid' &&
                  order.status !== 'cancelled' && (
                    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low/40 p-4 space-y-3 mt-2">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-600">
                        <Scissors size={14} className="text-primary shrink-0" />
                        Tách dòng món sang đơn mới
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Nhập ID dòng món (<span className="font-mono font-bold">order_items</span>), cách nhau bằng dấu phẩy.
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Ví dụ: 12, 13"
                        value={splitDrafts[order.id]?.ids ?? ''}
                        onChange={(e) =>
                          setSplitDrafts((prev) => ({
                            ...prev,
                            [order.id]: {
                              ids: e.target.value,
                              newTable: prev[order.id]?.newTable ?? '',
                            },
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gợi ý từ đơn hiện tại</p>
                        <div className="flex flex-wrap gap-2">
                          {order.items.map((it) =>
                            typeof it.id === 'number' && it.id > 0 ? (
                              <button
                                key={it.id}
                                type="button"
                                title={`Thêm #${it.id}`}
                                onClick={() =>
                                  setSplitDrafts((prev) => ({
                                    ...prev,
                                    [order.id]: {
                                      ids: appendSuggestedOrderItemId(prev[order.id]?.ids ?? '', it.id!),
                                      newTable: prev[order.id]?.newTable ?? '',
                                    },
                                  }))
                                }
                                className="max-w-full rounded-lg border border-primary/20 bg-surface px-2.5 py-1.5 text-left text-[11px] font-bold text-primary shadow-sm transition-colors hover:bg-primary/5"
                              >
                                <span className="font-mono">#{it.id}</span>
                                <span className="text-slate-600 font-semibold"> · </span>
                                <span className="text-slate-700">{it.product.name}</span>
                              </button>
                            ) : null,
                          )}
                        </div>
                        {order.items.some((it) => !(typeof it.id === 'number' && it.id > 0)) && (
                          <p className="text-[10px] font-bold text-amber-700">
                            Một số dòng chưa có ID — tải lại trang hoặc cập nhật backend nếu vẫn thiếu.
                          </p>
                        )}
                      </div>
                      <input
                        type="text"
                        autoComplete="off"
                        placeholder="Bàn đích (tuỳ chọn, ví dụ 03)"
                        value={splitDrafts[order.id]?.newTable ?? ''}
                        onChange={(e) =>
                          setSplitDrafts((prev) => ({
                            ...prev,
                            [order.id]: {
                              ids: prev[order.id]?.ids ?? '',
                              newTable: e.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl font-black border-primary/25 text-primary hover:bg-primary/5"
                        disabled={
                          splittingOrderId === order.id ||
                          parseSplitItemIds(splitDrafts[order.id]?.ids ?? '').length === 0
                        }
                        onClick={() => void confirmSplitBill(order)}
                      >
                        {splittingOrderId === order.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <>
                            <Scissors size={16} className="mr-2" />
                            Xác nhận tách đơn
                          </>
                        )}
                      </Button>
                    </div>
                  )}
              </div>

              <div className="px-6 py-5 pt-0">
                <Separator className="mb-5" />
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Tạm tính</span>
                  <span className="text-lg font-black text-primary">{Intl.NumberFormat('vi-VN').format(+order.totalPrice)}đ</span>
                </div>

                {order.status === 'pending' && (
                  <Button className="w-full h-11 rounded-xl shadow-lg shadow-primary/20" onClick={() => handleStatus(order, 'preparing')} disabled={updatingId === order.id}>
                    {updatingId === order.id ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" className="mr-2" />}
                    Tiếp nhận chế biến
                  </Button>
                )}
                {order.status === 'preparing' && (
                  <Button variant="default" className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200" onClick={() => handleStatus(order, 'ready')} disabled={updatingId === order.id}>
                    {updatingId === order.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={18} className="mr-2" />}
                    Báo nấu xong
                  </Button>
                )}
                {order.status === 'ready' && (
                  <Button variant="default" className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 animate-pulse" onClick={() => handleStatus(order, 'completed')} disabled={updatingId === order.id}>
                    {updatingId === order.id ? <Loader2 size={16} className="animate-spin" /> : <ShoppingBag size={18} className="mr-2" />}
                    Xác nhận đã phục vụ
                  </Button>
                )}
                {order.status === 'completed' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-center gap-2 text-emerald-600 font-black text-sm h-11 bg-emerald-50 rounded-xl">
                      <Check size={18} /> Đang phục vụ
                    </div>
                    <Button variant="outline" className="w-full h-11 rounded-xl border-slate-200 text-slate-500 hover:bg-surface-container-low" onClick={() => handleStatus(order, 'paid')} disabled={updatingId === order.id}>
                      Dọn bàn & Thanh toán
                    </Button>
                  </div>
                )}
                {order.status === 'paid' && (
                  <div className="flex items-center justify-center gap-2 text-slate-400 font-black text-sm h-11 bg-surface-container-low rounded-xl">
                    <Check size={18} /> Đã thanh toán
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-xl"
            >
              <ChevronLeft size={16} />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                const isNearCurrent = Math.abs(page - currentPage) <= 2;
                const isFirst = page === 1;
                const isLast = page === totalPages;
                if (!isNearCurrent && !isFirst && !isLast) {
                  if (page === 2 || page === totalPages - 1) return <span key={page} className="px-2 text-slate-400">...</span>;
                  return null;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      "w-9 h-9 rounded-xl text-sm font-bold transition-all",
                      page === currentPage ? "bg-primary text-white shadow-md" : "text-slate-500 hover:bg-surface-container-low"
                    )}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-xl"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatus}
          updatingId={updatingId}
          merchantInfo={merchantInfo}
        />
      )}
    </>
  );
};


// ─── Sidebar Navigation ──────────────────────────────────────────────────────
const NAV_ITEMS: { id: Tab; label: string; icon: any }[] = [
  { id: 'pos', label: 'Bán tại quầy', icon: ShoppingBag },
  { id: 'tables', label: 'Bàn & Live', icon: TableIcon },
  // { id: 'orders', label: 'Đơn hàng', icon: ClipboardList },
  { id: 'history', label: 'Lịch sử', icon: Archive },
  { id: 'customers', label: 'Khách hàng', icon: Users },
  { id: 'loyalty', label: 'Tích điểm', icon: Gift },
  { id: 'report', label: 'Báo cáo', icon: BarChart2 },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export const MerchantDashboard: React.FC<MerchantDashboardProps> = ({ merchantId, merchantName, onLogout }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab) || 'pos';

  const [refreshKey, setRefreshKey] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [newOrderNotify, setNewOrderNotify] = useState<Order | null>(null);
  const [merchantDetails, setMerchantDetails] = useState<any>(null);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(() => {
    return localStorage.getItem('audio_unlocked') === 'true';
  });
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [productInsights, setProductInsights] = useState<{
    topSellers: { id: number; name: string; units_sold: number }[];
    zeroRecentSales: { id: number; name: string }[];
  } | null>(null);

  const {
    socketStatus,
    activeCallStaff,
    activeCallPayment,
    activeLoyaltyRedeems,
    activeReadyOrders,
    newOrderNotify: incomingOrder,
    refreshTrigger,
    updatedOrder,
    clearOrderNotify,
    clearCallStaff,
    clearCallPayment,
    clearLoyaltyRedeem,
    clearReadyOrder,
    connect: reconnectSocket,
    staffPresenceByEmployeeId,
  } = useMerchantSocket(merchantId);

  const [activeStaffList, setActiveStaffList] = useState<EmployeeWithUser[]>([]);

  useEffect(() => {
    if (!merchantId) return;
    void (async () => {
      try {
        const { data } = await employeesApi.list({ active: true });
        setActiveStaffList(data.employees ?? []);
      } catch {
        setActiveStaffList([]);
      }
    })();
  }, [merchantId, refreshKey]);

  useEffect(() => {
    if (incomingOrder) {
      setNewOrderNotify({
        ...incomingOrder,
        createdAt: incomingOrder.createdAt || new Date().toISOString()
      } as Order);
      setUnreadNotifications(prev => prev + 1);
      
      const orderActivity: Activity = {
        id: `order-${incomingOrder.id}`,
        type: 'order',
        title: `Đơn hàng mới #${incomingOrder.id}`,
        description: `Bàn ${incomingOrder.tableNumber} vừa đặt món • ${Intl.NumberFormat('vi-VN').format(+incomingOrder.totalPrice)}đ`,
        timestamp: new Date().toISOString(),
        metadata: incomingOrder,
      };
      setActivities(prev => [orderActivity, ...prev].slice(0, 50));
    }
  }, [incomingOrder]);

  useEffect(() => {
    activeCallStaff.forEach(call => {
      setActivities(prev => {
        if (prev.find(a => a.id === `staff-${call.tableNumber}-${call.createdAt}`)) return prev;
        const act: Activity = {
          id: `staff-${call.tableNumber}-${call.createdAt}`,
          type: 'call_staff',
          title: 'Gọi nhân viên',
          description: `Bàn ${call.tableNumber} yêu cầu hỗ trợ`,
          timestamp: call.createdAt,
        };
        return [act, ...prev].slice(0, 50);
      });
    });
  }, [activeCallStaff]);

  useEffect(() => {
    activeCallPayment.forEach(call => {
      setActivities(prev => {
        if (prev.find(a => a.id === `pay-${call.tableNumber}-${call.createdAt}`)) return prev;
        const act: Activity = {
          id: `pay-${call.tableNumber}-${call.createdAt}`,
          type: 'call_payment',
          title: call.loyaltyPaymentMethod
            ? 'Thanh toán tích điểm'
            : call.paymentPreference
              ? 'Gọi thanh toán (chọn hình thức)'
              : 'Yêu cầu thanh toán',
          description: call.loyaltyPaymentMethod
            ? `Bàn ${call.tableNumber} — ${call.loyaltyPaymentMethod === 'bank_qr' ? 'QR ngân hàng' : 'thu ngân tại bàn'}`
            : call.paymentPreference
              ? `Bàn ${call.tableNumber} — ${call.paymentPreference === 'bank_qr' ? 'QR ngân hàng' : 'thu ngân tại bàn'}`
              : `Bàn ${call.tableNumber} muốn thanh toán hóa đơn`,
          timestamp: call.createdAt,
        };
        return [act, ...prev].slice(0, 50);
      });
    });
  }, [activeCallPayment]);

  useEffect(() => {
    activeReadyOrders.forEach(call => {
      setActivities(prev => {
        if (prev.find(a => a.id === `ready-${call.tableNumber}-${call.createdAt}`)) return prev;
        const act: Activity = {
          id: `ready-${call.tableNumber}-${call.createdAt}`,
          type: 'ready',
          title: 'Nấu xong',
          description: `Bàn ${call.tableNumber} - Món đã sẵn sàng phục vụ`,
          timestamp: call.createdAt,
        };
        return [act, ...prev].slice(0, 50);
      });
    });
  }, [activeReadyOrders]);

  useEffect(() => {
    activeLoyaltyRedeems.forEach((ev) => {
      setActivities((prev) => {
        if (prev.find((a) => a.id === `loyre-${ev.transactionId}`)) return prev;
        const act: Activity = {
          id: `loyre-${ev.transactionId}`,
          type: 'loyalty_redeem',
          title: 'Khách đổi quà tích điểm',
          description:
            (ev.tableNumber !== '—' ? `Bàn ${ev.tableNumber} — ` : '') +
            `${ev.rewardTitle} (−${ev.pointsCost} điểm) · *${ev.customerPhoneLast4} · còn ${ev.newBalance} điểm`,
          timestamp: ev.createdAt,
        };
        return [act, ...prev].slice(0, 50);
      });
    });
  }, [activeLoyaltyRedeems]);

  useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [refreshTrigger]);

  const fetchMerchantDetails = useCallback(async () => {
    try {
      const res = await api.get(`/merchants/${merchantId}`);
      setMerchantDetails(res.data);
    } catch { /* ignored */ }
  }, [merchantId]);

  useEffect(() => {
    fetchMerchantDetails();
  }, [fetchMerchantDetails]);

  useEffect(() => {
    if (!merchantId) return;
    void (async () => {
      try {
        const { data } = await api.get('orders/insights/products?days=30');
        setProductInsights(data);
      } catch {
        setProductInsights(null);
      }
    })();
  }, [merchantId]);

  useEffect(() => {
    if (!merchantId) return;
    void registerMerchantWebPush();
  }, [merchantId]);

  const checkOnboarding = useCallback(async () => {
    const hasSeen = localStorage.getItem(`has_seen_onboarding_${merchantId}`);
    if (hasSeen === 'true') return;

    try {
      const res = await api.get(`/menu/merchant/${merchantId}/categories`);
      const categories = Array.isArray(res.data) ? res.data : [];
      if (categories.length === 0) {
        setIsOnboardingOpen(true);
      }
    } catch (err) {
      console.error('Failed to check onboarding status:', err);
    }
  }, [merchantId]);

  useEffect(() => {
    checkOnboarding();
  }, [checkOnboarding]);

  const finishOnboarding = () => {
    localStorage.setItem(`has_seen_onboarding_${merchantId}`, 'true');
    setIsOnboardingOpen(false);
  };

  const setTab = (tab: Tab) => {
    setSearchParams({ tab });
    if (tab === 'orders') {
      setUnreadNotifications(0);
    }
  };

  const unlockAudio = () => { 
    setIsAudioUnlocked(true); 
    localStorage.setItem('audio_unlocked', 'true'); 
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.volume = 0;
    audio.play().catch(() => {});
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-[#eeeeee] flex flex-row font-sans overflow-hidden notranslate" translate="no">
        {/* ─── SIDEBAR (Persistent on all screens) ────────────────────────── */}
        <aside className="fixed inset-y-0 left-0 lg:static flex flex-col w-20 lg:w-24 bg-[#2c3e50] shrink-0 border-r border-white/5 py-4 lg:py-8 items-center z-[100] shadow-2xl">
          <div className="w-10 h-10 lg:w-12 lg:h-12 bg-primary rounded-xl lg:rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 transform rotate-3 mb-6 lg:mb-10 shrink-0">
            <ShoppingBag size={20} className="text-white lg:hidden" />
            <ShoppingBag size={28} className="text-white hidden lg:block" />
          </div>

          <nav className="flex-1 flex flex-col gap-2 lg:gap-4 w-full px-2 lg:px-3 overflow-y-auto no-scrollbar">
            {NAV_ITEMS.map((item) => (
              <Tooltip key={item.id} delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setTab(item.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 lg:p-3 rounded-lg lg:rounded-[20px] transition-all duration-300 group relative",
                      activeTab === (item.id as string) 
                        ? "bg-white/10 text-white shadow-lg ring-1 ring-white/20 scale-105" 
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <item.icon size={20} className={cn("transition-all", activeTab === (item.id as string) ? "text-primary" : "text-slate-400 group-hover:scale-110")} />
                    <span className="text-[7px] lg:text-[8px] font-black uppercase tracking-widest text-center leading-none mt-1 opacity-80">{item.label}</span>
                    {item.id === 'orders' && unreadNotifications > 0 && (
                      <span className="absolute top-1.5 right-2 lg:top-2 lg:right-4 w-4 h-4 bg-red-500 border-2 border-[#2c3e50] rounded-full flex items-center justify-center text-[8px] text-white font-black shadow-lg shadow-red-500/20">
                        {unreadNotifications}
                      </span>
                    )}
                    {activeTab === (item.id as string) && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full shadow-[0_0_15px_rgba(0,177,79,0.5)]" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#1a252f] border-none shadow-2xl font-black uppercase text-[9px] tracking-widest px-3 py-2 hidden lg:block">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </nav>

          <div className="mt-auto px-2 lg:px-4 py-4 lg:py-6 border-t border-white/5 w-full flex flex-col items-center">
             <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl" onClick={onLogout}>
               <LogOut size={20} />
             </Button>
          </div>
        </aside>

        {/* ─── MAIN CONTENT AREA ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto no-scrollbar relative ml-20 lg:ml-0">
          
          {/* iOS Audio Unlock Modal */}
          {!isAudioUnlocked && (
            <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6 text-center">
              <div className="max-w-xs w-full bg-surface rounded-[32px] p-8 shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
                  <Bell size={40} className="animate-bounce" />
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-3 tracking-tight">Kích hoạt âm thanh</h2>
                <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">Vui lòng nhấn nút dưới đây để nhận thông báo thoại và tiếng chuông khi có khách gọi.</p>
                <Button 
                  onClick={unlockAudio}
                  className="w-full h-14 rounded-2xl bg-primary hover:bg-primary-hover text-white font-black uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all"
                >
                  Bắt đầu ngay
                </Button>
              </div>
            </div>
          )}

          {/* Connection Error Banner */}
          {(socketStatus === 'disconnected' || socketStatus === 'error') && (
            <div className="sticky top-0 z-[200] w-full bg-red-600 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2 text-sm font-bold">
                <span className="w-2 h-2 rounded-full bg-surface animate-pulse flex-shrink-0" />
                <span>⚠️ Mất kết nối — Đơn hàng mới sẽ không tự cập nhật!</span>
              </div>
              <button
                onClick={() => { reconnectSocket(); }}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-black uppercase transition-all backdrop-blur-sm"
              >
                Kết nối lại
              </button>
            </div>
          )}

          {/* Header */}
          <header className="sticky top-0 z-50 w-full bg-surface/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
            <div className="container mx-auto px-4 lg:px-6 h-16 lg:h-20 flex items-center justify-between gap-8">
              <div className="flex items-center gap-3 flex-shrink-0">
                <div>
                  <p className="font-black text-primary text-base lg:text-lg leading-none tracking-tight">KivoMenu</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-black uppercase text-slate-400 border-slate-200">{merchantDetails?.name || (merchantName === 'Demo Merchant' ? 'Cửa hàng Demo' : merchantName)}</Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0 min-w-0">
                {activeStaffList.length > 0 && (
                  <div className="hidden md:flex flex-col min-w-0 max-w-[14rem] lg:max-w-md xl:max-w-lg">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 px-0.5">
                      Nhân viên
                    </p>
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar items-center">
                      {activeStaffList.map((emp) => {
                        const live = staffPresenceByEmployeeId[emp.id];
                        const pr = live?.presence;
                        const label =
                          pr === 'online' || pr === 'away' || pr === 'offline'
                            ? STAFF_PRESENCE_LABELS[pr]
                            : '…';
                        const dot =
                          pr === 'online'
                            ? 'bg-emerald-500'
                            : pr === 'away'
                              ? 'bg-amber-400'
                              : pr === 'offline'
                                ? 'bg-slate-400'
                                : 'bg-slate-300';
                        return (
                          <div
                            key={emp.id}
                            className="flex items-center gap-1.5 shrink-0 rounded-full border border-slate-200/90 bg-surface-container-low/90 pl-2 pr-2.5 py-1"
                            title={live?.at ? `Cập nhật ${new Date(live.at).toLocaleString('vi-VN')}` : undefined}
                          >
                            <span className={cn('h-2 w-2 rounded-full shrink-0', dot)} />
                            <span className="text-[10px] font-bold text-slate-800 max-w-[5.5rem] truncate">
                              {emp.name}
                            </span>
                            <span
                              className={cn(
                                'text-[9px] font-black uppercase',
                                pr === 'online'
                                  ? 'text-emerald-700'
                                  : pr === 'away'
                                    ? 'text-amber-700'
                                    : pr === 'offline'
                                      ? 'text-slate-600'
                                      : 'text-slate-400',
                              )}
                            >
                              {label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <Button
                  variant="ghost" size="icon"
                  className={cn("text-slate-400 hover:bg-primary/5 hover:text-primary rounded-xl relative shrink-0", isActivityOpen && "bg-primary/10 text-primary")}
                  onClick={() => setIsActivityOpen(true)}
                >
                  <Bell size={20} />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-2 right-2.5 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] text-white font-black">
                      {unreadNotifications}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </header>

          {/* Activity Sidebar Drawer */}
          <div 
            className={cn(
              "fixed inset-0 z-[250] bg-black/40 backdrop-blur-sm transition-opacity duration-300",
              isActivityOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            onClick={() => setIsActivityOpen(false)}
          >
            <div 
              className={cn(
                "absolute right-0 top-0 bottom-0 w-full sm:w-[400px] bg-surface shadow-2xl transition-transform duration-300 transform flex flex-col",
                isActivityOpen ? "translate-x-0" : "translate-x-full"
              )}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 h-20 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Bell size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 tracking-tight">Hoạt động live</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time alerts</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsActivityOpen(false)}
                  className="w-10 h-10 rounded-full hover:bg-surface-container-low flex items-center justify-center text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
                {activities.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mb-4">
                      <Bell size={32} opacity={0.3} />
                    </div>
                    <p className="font-bold text-sm">Chưa có hoạt động nào</p>
                    <p className="text-xs font-medium mt-1">Các thông báo mới sẽ xuất hiện tại đây</p>
                  </div>
                ) : (
                  activities.map((activity) => (
                    <div 
                      key={activity.id}
                      className={cn(
                        "group p-4 rounded-2xl border transition-all duration-300 cursor-pointer active:scale-[0.98]",
                        activity.type === 'order' ? "bg-blue-50/50 border-blue-100 hover:bg-blue-50" :
                        activity.type === 'call_staff' ? "bg-red-50/50 border-red-100 hover:bg-red-50" :
                        activity.type === 'call_payment' ? "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50" :
                        activity.type === 'loyalty_redeem' ? "bg-amber-50/50 border-amber-100 hover:bg-amber-50" :
                        "bg-surface-container-low border-slate-100 hover:bg-surface-container-low"
                      )}
                      onClick={() => {
                        if (activity.type === 'order') {
                           setTab('orders');
                           setIsActivityOpen(false);
                        }
                      }}
                    >
                      <div className="flex gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl shrink-0 flex items-center justify-center shadow-sm",
                          activity.type === 'order' ? "bg-blue-500 text-white" :
                          activity.type === 'call_staff' ? "bg-red-500 text-white" :
                          activity.type === 'call_payment' ? "bg-emerald-500 text-white" :
                          activity.type === 'loyalty_redeem' ? "bg-amber-500 text-white" :
                          "bg-slate-500 text-white"
                        )}>
                          {activity.type === 'order' ? <ShoppingBag size={20} /> :
                           activity.type === 'call_staff' ? <AlertTriangle size={20} /> :
                           activity.type === 'call_payment' ? <CreditCard size={20} /> :
                           activity.type === 'loyalty_redeem' ? <Gift size={20} /> :
                           <Clock size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-black text-sm text-slate-800 leading-none">{activity.title}</p>
                            <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                              {new Date(activity.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[13px] font-medium text-slate-500 line-clamp-2 leading-relaxed">
                            {activity.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-surface-container-low/50">
                <Button 
                  variant="ghost" 
                  className="w-full h-11 rounded-xl text-slate-500 font-bold"
                  onClick={() => setActivities([])}
                  disabled={activities.length === 0}
                >
                  Xóa tất cả nhật ký
                </Button>
              </div>
            </div>
          </div>

          <main className={cn(
            "flex-1 pb-24 lg:pb-16",
            activeTab === 'pos' ? "h-[calc(100vh-5rem)] overflow-hidden" : "w-full p-4 lg:p-8"
          )}>
            <div className={activeTab === 'pos' ? "h-full flex flex-col min-h-0" : "animate-fade-in"}>
              {activeTab === 'pos' && (
                <>
                  {productInsights && (
                    <div className="hidden lg:flex gap-3 px-4 pt-3 pb-1 text-xs text-slate-600 border-b border-slate-200/80 bg-surface/80 shrink-0">
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-slate-800">Bán chạy 30 ngày:</span>{' '}
                        {productInsights.topSellers?.slice(0, 4).map((p) => `${p.name} (${p.units_sold})`).join(' · ') || '—'}
                      </div>
                      {productInsights.zeroRecentSales?.length ? (
                        <div className="shrink-0 text-amber-700 font-medium">
                          {productInsights.zeroRecentSales.length} món chưa có đơn
                        </div>
                      ) : null}
                    </div>
                  )}
                  <div className="flex-1 min-h-0">
                    <PosTab merchantId={merchantId} merchantName={merchantName} tableCount={merchantDetails?.tableCount || 10} refreshTrigger={refreshKey} />
                  </div>
                </>
              )}
              {activeTab === 'orders' && <OrdersTab merchantId={merchantId} refreshKey={refreshKey} updatedOrder={updatedOrder} merchantInfo={merchantDetails} />}
              {activeTab === 'tables' && <TablesTab merchantId={merchantId} refreshKey={refreshKey} tableCount={merchantDetails?.tableCount || 10} />}
              {activeTab === 'customers' && <CustomersTab merchantId={merchantId} />}
              {activeTab === 'loyalty' && <LoyaltyTab merchantId={merchantId} />}
              {activeTab === 'report' && <ReportTab merchantId={merchantId} />}
              {activeTab === 'history' && <OrderHistoryTab merchantId={merchantId} />}
              {activeTab === 'settings' && <SettingsTab merchantId={merchantId} onUpdate={fetchMerchantDetails} />}
            </div>
          </main>

          {/* ─── NOTIFICATION POPUPS ─────────────────────────────────────── */}
          
          {/* Payment Requests */}
          <div className="fixed top-24 left-24 lg:left-28 z-[110] flex flex-col gap-3 w-[calc(100%-7rem)] lg:w-full lg:max-w-xs pointer-events-none">
            {activeCallPayment.map((call) => {
              const tier = call.loyaltyPaymentMethod
                ? 'loyalty'
                : call.paymentPreference
                  ? 'pref'
                  : 'bill';
              const cardCls =
                tier === 'loyalty'
                  ? 'border-2 border-violet-500 shadow-2xl bg-violet-50/95 backdrop-blur-sm ring-4 ring-violet-500/10 rounded-2xl'
                  : tier === 'pref'
                    ? 'border-2 border-sky-500 shadow-2xl bg-sky-50/95 backdrop-blur-sm ring-4 ring-sky-500/10 rounded-2xl'
                    : 'border-2 border-emerald-500 shadow-2xl bg-emerald-50/95 backdrop-blur-sm ring-4 ring-emerald-500/10 rounded-2xl';
              const textCls =
                tier === 'loyalty' ? 'text-violet-950' : tier === 'pref' ? 'text-sky-950' : 'text-emerald-900';
              const hdrCls =
                tier === 'loyalty'
                  ? 'text-violet-600/80'
                  : tier === 'pref'
                    ? 'text-sky-700/85'
                    : 'text-emerald-600/70';
              const subCls =
                tier === 'loyalty'
                  ? 'text-violet-700/90'
                  : tier === 'pref'
                    ? 'text-sky-800/90'
                    : 'text-emerald-700/90';
              const headline =
                tier === 'loyalty'
                  ? 'THANH TOÁN TÍCH ĐIỂM'
                  : tier === 'pref'
                    ? 'GỌI THANH TOÁN'
                    : 'GỌI THANH TOÁN BILL';
              const subline =
                call.loyaltyPaymentMethod === 'bank_qr' || call.paymentPreference === 'bank_qr'
                  ? 'Khách chọn QR ngân hàng'
                  : call.loyaltyPaymentMethod === 'at_table' || call.paymentPreference === 'at_table'
                    ? 'Thu ngân tại bàn'
                    : null;
              const btnCls =
                tier === 'loyalty'
                  ? 'w-full bg-violet-600 hover:bg-violet-700 text-white font-black uppercase tracking-widest h-10'
                  : tier === 'pref'
                    ? 'w-full bg-sky-600 hover:bg-sky-700 text-white font-black uppercase tracking-widest h-10'
                    : 'w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest h-10';
              return (
                <div key={`pay-${call.tableNumber}-${tier}-${call.createdAt}`} className="pointer-events-auto animate-in slide-in-from-left-10 fade-in duration-500">
                  <Card className={cardCls}>
                    <CardContent className={`p-4 text-center ${textCls}`}>
                      <p className="text-xl font-black tracking-tighter mb-1">BÀN {call.tableNumber}</p>
                      <div className="mb-4 space-y-1">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${hdrCls}`}>{headline}</p>
                        {subline && (
                          <p className={`text-[10px] font-bold normal-case tracking-normal ${subCls}`}>{subline}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className={btnCls}
                        onClick={() => clearCallPayment(call.tableNumber)}
                      >
                        Xác nhận
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
            {activeLoyaltyRedeems.map((r) => (
              <div
                key={`loyre-${r.transactionId}`}
                className="pointer-events-auto animate-in slide-in-from-left-10 fade-in duration-500"
              >
                <Card className="border-2 border-amber-500 shadow-2xl bg-amber-50/95 backdrop-blur-sm ring-4 ring-amber-500/15 rounded-2xl">
                  <CardContent className="p-4 text-center text-amber-950">
                    <p className="text-xl font-black tracking-tighter mb-1">
                      {r.tableNumber !== '—' ? `BÀN ${r.tableNumber}` : 'ĐỔI QUÀ'}
                    </p>
                    <p className="text-[10px] text-amber-700/80 font-black uppercase tracking-widest mb-2">
                      Khách đổi quà · −{r.pointsCost} điểm
                    </p>
                    <p className="text-xs font-bold text-amber-900 mb-1">{r.rewardTitle}</p>
                    <p className="text-[10px] font-bold text-amber-800/90 mb-4">
                      SĐT *{r.customerPhoneLast4} · còn {r.newBalance} điểm
                    </p>
                    <Button
                      size="sm"
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest h-10"
                      onClick={() => clearLoyaltyRedeem(r.transactionId)}
                    >
                      Đã giao quà
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* Staff Calls */}
          <div className="fixed top-24 right-4 z-[110] flex flex-col gap-3 w-[calc(100%-6rem)] lg:max-w-xs pointer-events-none">
            {activeCallStaff.map((call) => (
              <div key={`staff-${call.tableNumber}`} className="pointer-events-auto animate-in slide-in-from-right-10 fade-in duration-500">
                <Card className="border-2 border-red-500 shadow-2xl bg-red-50/95 backdrop-blur-sm ring-4 ring-red-500/10 rounded-2xl">
                  <CardContent className="p-4 text-center text-red-900">
                    <p className="text-xl font-black tracking-tighter mb-1">BÀN {call.tableNumber}</p>
                    <p className="text-[10px] text-red-600/70 font-black uppercase tracking-widest mb-4">GỌI NHÂN VIÊN</p>
                    <Button
                      size="sm"
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest h-10"
                      onClick={() => clearCallStaff(call.tableNumber)}
                    >
                      Xác nhận hỗ trợ
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* Ready to Serve - Mang đơn ra bàn */}
          <div className="fixed bottom-6 lg:bottom-10 left-4 lg:left-28 z-[110] flex flex-col gap-3 w-[calc(100%-6rem)] lg:max-w-xs pointer-events-none">
            {activeReadyOrders.map((call) => (
              <div key={`ready-${call.tableNumber}`} className="pointer-events-auto animate-in slide-in-from-left-10 fade-in duration-500">
                <Card className="border-2 border-amber-500 shadow-2xl bg-amber-50/95 backdrop-blur-sm ring-4 ring-amber-500/10 rounded-2xl">
                  <CardContent className="p-4 text-center text-amber-900">
                    <p className="text-2xl mb-1">🍽️</p>
                    <p className="text-xl font-black tracking-tighter">BÀN {call.tableNumber}</p>
                    <p className="text-[10px] text-amber-600/70 font-black uppercase tracking-widest mb-4">MANG ĐƠN RA!</p>
                    <Button
                      size="sm"
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest h-10"
                      onClick={() => clearReadyOrder(call.tableNumber)}
                    >
                      Đã mang ra
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* New Order Notification */}
          {newOrderNotify && (
            <div className="fixed bottom-6 lg:bottom-10 right-4 lg:right-10 z-[100] w-[calc(100%-6rem)] lg:max-w-sm animate-in slide-in-from-right-10 fade-in duration-500">
              <Card className="border-2 border-primary shadow-2xl bg-surface overflow-hidden rounded-2xl">
                <div className="bg-primary px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Bell size={18} className="animate-bounce" />
                    <span className="text-xs font-black uppercase tracking-widest">Đơn hàng mới!</span>
                  </div>
                  <button onClick={() => { clearOrderNotify(); setNewOrderNotify(null); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40">
                    <X size={16} />
                  </button>
                </div>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <TableIcon size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-black text-slate-900 leading-tight">Bàn {newOrderNotify.tableNumber}</p>
                      <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {newOrderNotify.items?.length || 0} món • {Intl.NumberFormat('vi-VN').format(+newOrderNotify.totalPrice)}đ
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 rounded-xl h-11 bg-primary font-black text-[10px] lg:text-xs uppercase" onClick={() => { setTab('orders'); clearOrderNotify(); setNewOrderNotify(null); }}>Xem chi tiết</Button>
                    <Button variant="outline" className="rounded-xl h-11 px-4 lg:px-5 font-black text-[10px] lg:text-xs uppercase" onClick={() => { clearOrderNotify(); setNewOrderNotify(null); }}>Bỏ qua</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <OnboardingModal 
        isOpen={isOnboardingOpen} 
        onClose={finishOnboarding} 
      />
    </TooltipProvider>
  );
};
