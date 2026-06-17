import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  TrendingUp, ShoppingBag, Clock, CreditCard, CalendarDays, 
  Star, MessageSquare, 
  RefreshCw, ChevronLeft, ChevronRight, BarChart, 
  Sun, Sunset, Moon, Hash
} from 'lucide-react';
import api from '../../lib/api';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '../../components/ui';
import { cn } from '../../lib/utils';

interface Order {
  id: number;
  tableNumber: string;
  status: string;
  totalPrice: string;
  createdAt: string;
  items: { product: { name: string }; quantity: number }[];
}

interface Review {
  id: number;
  merchantId: string;
  tableNumber: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

const statusLabel: Record<string, string> = { 
  pending: 'Chờ nhận', 
  confirmed: 'Đã nhận',
  preparing: 'Đang nấu', 
  ready: 'Chờ bưng',
  completed: 'Xong', 
  paid: 'Đã trả',
  cancelled: 'Huỷ' 
};

const statusVariant: Record<string, any> = { 
  pending: 'secondary', 
  confirmed: 'default',
  preparing: 'warning', 
  ready: 'info',
  completed: 'success', 
  paid: 'success',
  cancelled: 'destructive' 
};

interface RevenueResponse {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  items: { date: string; revenue: number; orders: number }[];
}

export const ReportTab: React.FC<{ merchantId: string }> = ({ merchantId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueResponse | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [ordersPage, setOrdersPage] = useState(1);
  const [reviewsPage, setReviewsPage] = useState(1);
  
  const ORDERS_PER_PAGE = 10;
  const REVIEWS_PER_PAGE = 6;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/orders/merchant/${merchantId}`);
      const orderList = Array.isArray(r.data) ? r.data : Array.isArray(r.data?.orders) ? r.data.orders : [];
      const mapped = orderList.map((o: any) => ({
        id: o.id,
        tableNumber: o.table_number || o.tableNumber || '00',
        status: o.status,
        totalPrice: String(o.total_price || o.totalPrice || 0),
        createdAt: o.created_at || o.createdAt,
        items: Array.isArray(o.items) ? o.items : [],
      }));
      setOrders(mapped);
    } catch (err) {
      console.error('Fetch orders failed', err);
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const fetchRevenue = useCallback(async () => {
    setRevenueLoading(true);
    setRevenueError(null);
    try {
      const r = await api.get<RevenueResponse>(`/orders/revenue`, {
        params: { period, merchantId },
      });
      setRevenueData(r.data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Không tải được báo cáo doanh thu.';
      setRevenueError(msg);
      setRevenueData(null);
    } finally {
      setRevenueLoading(false);
    }
  }, [merchantId, period]);

  useEffect(() => {
    void fetchRevenue();
  }, [fetchRevenue]);

  const fetchReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const res = await api.get(`/reviews/merchant/${merchantId}`);
      const reviewList = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.reviews) ? res.data.reviews : [];
      setReviews(reviewList.map((r: any) => ({ ...r, tableNumber: r.table_number || r.tableNumber })));
    } catch {
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [merchantId]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const now = new Date();
  const cutoff = useMemo(() => {
    if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (period === 'week') return now.getTime() - 7 * 86400000;
    return now.getTime() - 30 * 86400000;
  }, [period, now]);

  const filtered = useMemo(() => orders.filter(o => new Date(o.createdAt).getTime() >= cutoff), [orders, cutoff]);

  const stats = useMemo(() => {
    const paidRev = revenueData?.totalRevenue ?? 0;
    const paidOrders = revenueData?.totalOrders ?? 0;
    const avgOrder = revenueData?.averageOrderValue ?? 0;
    const cancelled = filtered.filter(o => o.status === 'cancelled').length;
    const completedOrders = filtered.filter(o => o.status === 'completed' || o.status === 'paid');
    const morning = completedOrders.filter(o => {
      const h = new Date(o.createdAt).getHours();
      return h >= 6 && h < 11;
    }).reduce((s, o) => s + Number(o.totalPrice), 0);
    const afternoon = completedOrders.filter(o => {
      const h = new Date(o.createdAt).getHours();
      return h >= 11 && h < 17;
    }).reduce((s, o) => s + Number(o.totalPrice), 0);
    const evening = completedOrders.filter(o => {
      const h = new Date(o.createdAt).getHours();
      return h >= 17 && h < 24;
    }).reduce((s, o) => s + Number(o.totalPrice), 0);
    return {
      revenue: paidRev,
      avgOrder,
      cancelled,
      totalOrders: paidOrders,
      morning,
      afternoon,
      evening,
    };
  }, [filtered, revenueData]);

  // Top Products
  const sortedProducts = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.filter(o => o.status !== 'cancelled').forEach(o => 
      o.items.forEach(i => { counts[i.product.name] = (counts[i.product.name] || 0) + i.quantity; })
    );
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [filtered]);

  const maxProductQty = sortedProducts[0]?.[1] || 1;

  const chartEntries = useMemo((): [string, number][] => {
    if (revenueData?.items?.length) {
      return revenueData.items.map((it) => {
        const parts = it.date.split('-');
        const label =
          period === 'month' && parts.length === 3
            ? `${parts[2]}/${parts[1]}`
            : parts.length === 3
              ? `${parts[2]}/${parts[1]}`
              : it.date;
        return [label, it.revenue] as [string, number];
      });
    }
    return [['—', 0]];
  }, [revenueData, period]);

  const maxRev = Math.max(...chartEntries.map(([, v]) => v), 100000);

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const Pagination = ({ current, total, onPageChange }: { current: number; total: number; onPageChange: (p: number) => void }) => {
    if (total <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 mt-4">
        <Button variant="ghost" size="icon" className="w-8 h-8" disabled={current === 1} onClick={() => onPageChange(current - 1)}>
          <ChevronLeft size={14} />
        </Button>
        <span className="text-[10px] font-black text-slate-400">{current} / {total}</span>
        <Button variant="ghost" size="icon" className="w-8 h-8" disabled={current === total} onClick={() => onPageChange(current + 1)}>
          <ChevronRight size={14} />
        </Button>
      </div>
    );
  };

  const MetricCard = ({ label, value, sub, icon, color = "primary" }: { label: string; value: string; sub?: string; icon: React.ReactNode; color?: string }) => (
    <Card className="border-none shadow-premium relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
      <div className={cn("absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] group-hover:scale-125 transition-transform duration-500", `bg-${color}`)} />
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", 
            color === 'primary' ? 'bg-primary/10 text-primary' : 
            color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : 
            color === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
          )}>
            {icon}
          </div>
          {sub && <Badge variant="outline" className="text-[9px] font-black tracking-widest">{sub}</Badge>}
        </div>
        <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Period & Refresh */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex bg-surface/60 backdrop-blur-sm border border-slate-200 rounded-xl p-1 shadow-sm w-fit">
          {([['today', 'Hôm nay'], ['week', 'Tuần này'], ['month', 'Tháng này']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setPeriod(key); setOrdersPage(1); }}
              className={cn(
                "px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                period === key ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          onClick={() => {
            void fetchOrders();
            void fetchRevenue();
          }}
          variant="outline"
          className="rounded-xl font-bold gap-2 text-primary border-primary/20 hover:bg-primary/5"
        >
          <RefreshCw size={14} className={cn((loading || revenueLoading) && 'animate-spin')} />{' '}
          {loading || revenueLoading ? 'Đang cập nhật...' : 'Làm mới'}
        </Button>
      </div>

      {revenueError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {revenueError}
        </div>
      )}

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {revenueLoading && !revenueData ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-none shadow-premium animate-pulse">
                <CardContent className="pt-6 h-28 bg-surface-container-low rounded-xl" />
              </Card>
            ))}
          </>
        ) : (
          <>
            <MetricCard
              label="Tổng doanh thu"
              value={Intl.NumberFormat('vi-VN').format(stats.revenue) + 'đ'}
              sub="Đơn đã thanh toán (theo kỳ)"
              icon={<CreditCard size={20} />}
              color="primary"
            />
            <MetricCard
              label="Giá trị trung bình / đơn"
              value={Intl.NumberFormat('vi-VN').format(Math.round(stats.avgOrder)) + 'đ'}
              sub="Chỉ đơn paid"
              icon={<ShoppingBag size={20} />}
              color="emerald"
            />
            <MetricCard
              label="Số đơn đã thanh toán"
              value={String(stats.totalOrders)}
              sub={`${stats.cancelled} đơn huỷ (mẫu trang)`}
              icon={<Hash size={20} />}
              color="amber"
            />
            <MetricCard
              label="Ngày có doanh thu"
              value={String(revenueData?.items?.filter((i) => i.revenue > 0).length ?? 0)}
              sub="Trong kỳ chọn"
              icon={<TrendingUp size={20} />}
              color="rose"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 border-none shadow-premium">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <BarChart size={18} className="text-primary" /> Doanh thu theo thời gian
                </CardTitle>
                <CardDescription className="text-xs font-medium">Báo cáo doanh thu đã thanh toán</CardDescription>
              </div>
              <Badge variant="secondary" className="bg-primary/5 text-primary border-0 font-black">
                {period === 'today' ? 'Hôm nay' : period === 'week' ? 'ISO Tuần' : 'Cả tháng'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-48 pt-6 pb-2 overflow-x-auto no-scrollbar">
              {chartEntries.map(([label, val]) => (
                <div key={label} className="flex flex-col items-center gap-2 flex-1 min-w-[30px] group">
                  <div className="relative w-full h-full flex items-end">
                    <div 
                      className="w-full bg-primary/10 rounded-t-md hover:bg-primary/20 transition-all duration-300 relative group-hover:bg-primary/30"
                      style={{ height: `${Math.max(5, (val / maxRev) * 100)}%` }}
                    >
                      {val > 0 && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-black px-2 py-1 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                          {Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(val)}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Day Part Insights */}
        <Card className="border-none shadow-premium">
          <CardHeader>
            <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Clock size={18} className="text-amber-500" /> Thời điểm vàng
            </CardTitle>
            <CardDescription className="text-xs font-medium">Doanh thu theo buổi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              { label: 'Sáng (6h - 11h)', val: stats.morning, icon: <Sun size={14} className="text-amber-500" />, color: 'amber' },
              { label: 'Trưa - Chiều (11h - 17h)', val: stats.afternoon, icon: <Sunset size={14} className="text-orange-500" />, color: 'orange' },
              { label: 'Tối (17h - 24h)', val: stats.evening, icon: <Moon size={14} className="text-indigo-500" />, color: 'indigo' },
            ].map(part => {
              const total = (stats.morning + stats.afternoon + stats.evening) || 1;
              const percent = Math.round((part.val / total) * 100);
              return (
                <div key={part.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {part.icon}
                      <span className="text-xs font-bold text-slate-600">{part.label}</span>
                    </div>
                    <span className="text-xs font-black text-slate-800">{Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(part.val)}đ</span>
                  </div>
                  <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-1000", `bg-${part.color === 'indigo' ? 'indigo-500' : part.color === 'orange' ? 'orange-500' : 'amber-500'}`)} 
                      style={{ width: `${percent}%` }} 
                    />
                  </div>
                  <p className="text-[10px] text-right font-black text-slate-300">{percent}%</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best Sellers */}
        <Card className="border-none shadow-premium">
          <CardHeader>
            <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
              <ShoppingBag size={18} className="text-emerald-500" /> Sản phẩm bán chạy
            </CardTitle>
            <CardDescription className="text-xs font-medium">Top 5 sản phẩm hiệu quả nhất</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-300">
                <ShoppingBag size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs font-bold">Chưa có dữ liệu bán lẻ</p>
              </div>
            ) : (
              <div className="space-y-5">
                {sortedProducts.map(([name, qty], i) => (
                  <div key={name} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0">
                      0{i+1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-black text-slate-700 truncate">{name}</p>
                        <p className="text-xs font-black text-primary">{qty} lượt</p>
                      </div>
                      <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-400 rounded-full" 
                          style={{ width: `${(qty / maxProductQty) * 100}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Feedback */}
        <Card className="border-none shadow-premium">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Star size={18} className="text-yellow-500 fill-yellow-500" /> Đánh giá dịch vụ
                </CardTitle>
                <CardDescription className="text-xs font-medium">Trung bình: {avgRating.toFixed(1)} sao</CardDescription>
              </div>
              <Button onClick={fetchReviews} variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <RefreshCw size={14} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {reviewsLoading ? (
              <div className="flex items-center justify-center py-12"><RefreshCw size={24} className="animate-spin text-slate-200" /></div>
            ) : reviews.length === 0 ? (
              <div className="py-12 text-center text-slate-300">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs font-bold">Chưa có lời nhắn từ khách</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.slice((reviewsPage - 1) * REVIEWS_PER_PAGE, reviewsPage * REVIEWS_PER_PAGE).map((review) => (
                  <div key={review.id} className="p-3 bg-surface-container-low/50 rounded-xl border border-slate-100">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={10} className={cn(s <= review.rating ? "text-yellow-500 fill-yellow-500" : "text-slate-200 fill-slate-200")} />
                        ))}
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-surface px-2 py-0.5 rounded border border-slate-100">Bàn {review.tableNumber}</span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 italic">"{review.comment || 'Khách hàng không để lại bình luận'}"</p>
                  </div>
                ))}
                <Pagination current={reviewsPage} total={Math.ceil(reviews.length / REVIEWS_PER_PAGE)} onPageChange={setReviewsPage} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent History */}
      <Card className="border-none shadow-premium overflow-hidden">
        <CardHeader className="bg-surface-container-low/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <CalendarDays size={18} className="text-primary" /> Lịch sử đơn hàng
              </CardTitle>
              <CardDescription className="text-xs font-medium">Danh sách đơn hàng trong giai đoạn</CardDescription>
            </div>
            <Badge variant="outline" className="font-black text-[10px] tracking-widest">{filtered.length} ĐƠN</Badge>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Đơn #</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Bàn</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Món chi tiết</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Trạng thái</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Tổng tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">Không có dữ liệu đơn hàng</td>
                </tr>
              ) : (
                filtered.slice((ordersPage - 1) * ORDERS_PER_PAGE, ordersPage * ORDERS_PER_PAGE).map(order => (
                  <tr key={order.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-800">#{order.id}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1">{new Date(order.createdAt).toLocaleTimeString('vi-VN')}</p>
                    </td>
                    <td className="px-5 py-4 font-black text-slate-600">Bàn {order.tableNumber}</td>
                    <td className="px-5 py-4 text-xs text-slate-500 max-w-[250px] truncate">
                      {order.items.map(it => `${it.quantity}x ${it.product.name}`).join(', ')}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Badge variant={statusVariant[order.status] || 'default'} className="text-[10px] font-black uppercase tracking-wide">
                        {statusLabel[order.status] || order.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-primary">
                      {Intl.NumberFormat('vi-VN').format(Number(order.totalPrice))}đ
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <CardContent className="bg-surface-container-low/30 p-2">
           <Pagination current={ordersPage} total={Math.ceil(filtered.length / ORDERS_PER_PAGE)} onPageChange={setOrdersPage} />
        </CardContent>
      </Card>
    </div>
  );
};
