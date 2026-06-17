import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Store, LogOut, ShoppingBag, DollarSign,
  Loader2, RefreshCw, CheckCircle2, Users, Package,
} from 'lucide-react';
import api from '../lib/api';
import { formatVND, formatDate } from '@shared/utils';
import {
  Badge, Button, Card, CardContent, Separator,
  Avatar, AvatarFallback,
  TooltipProvider,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewStats {
  totalShops: number;
  totalOrders: number;
  totalRevenue: number;
  activeShops: number;
}

interface ShopSummary {
  id: string;
  name: string;
  slug: string;
  owner_name: string;
  owner_email: string;
  phone: string | null;
  address: string | null;
  order_count: number;
  total_revenue: number;
  product_count: number;
  employee_count: number;
  is_active: boolean;
  created_at: string;
}

interface AdminOrder {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_price: number;
  status: string;
  created_at: string;
}

interface AdminProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category_name: string;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface SystemAdminDashboardProps {
  adminName: string;
  onLogout: () => void;
}

export const SystemAdminDashboard: React.FC<SystemAdminDashboardProps> = ({ adminName, onLogout }) => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail panel state
  const [selectedShop, setSelectedShop] = useState<ShopSummary | null>(null);
  const [shopOrders, setShopOrders] = useState<AdminOrder[]>([]);
  const [shopProducts, setShopProducts] = useState<AdminProduct[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'menu' | 'orders'>('menu');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, shopsRes] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/shops'),
      ]);
      setStats(statsRes.data);
      setShops(shopsRes.data?.shops || shopsRes.data || []);
    } catch (e) {
      console.error('Failed to fetch admin data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchShopDetails = useCallback(async (shopId: string) => {
    setDetailLoading(true);
    try {
      const [ordersRes, productsRes] = await Promise.all([
        api.get(`/admin/shops/${shopId}/orders`),
        api.get(`/admin/shops/${shopId}/products`),
      ]);
      setShopOrders(ordersRes.data || []);
      setShopProducts(productsRes.data || []);
    } catch (e) {
      console.error('Failed to fetch shop details:', e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedShop) {
      fetchShopDetails(selectedShop.id);
    }
  }, [selectedShop, fetchShopDetails]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-slate-400" size={32} />
          <p className="text-slate-500 font-medium">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-surface-container-low">
        {/* Header */}
        <header className="bg-surface border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                <LayoutDashboard size={20} className="text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-lg">Hệ Thống LagiMenu</h1>
                <Badge className="bg-emerald-100 text-emerald-700 text-[9px] h-4 px-1.5 font-bold border-0">
                  SUPER ADMIN
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Separator orientation="vertical" className="h-6" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-surface-container-low transition-colors">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-slate-900 text-white font-bold text-sm">AD</AvatarFallback>
                    </Avatar>
                    <div className="text-left hidden md:block">
                      <p className="text-sm font-bold text-slate-900">{adminName}</p>
                      <p className="text-[10px] text-slate-400">Quản trị viên</p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48" align="end">
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600 font-medium" onClick={onLogout}>
                    <LogOut size={16} className="mr-2" /> Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Page Title */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Tổng quan hệ thống</h2>
              <p className="text-slate-500 text-sm mt-0.5">Giám sát toàn bộ hoạt động</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
              <RefreshCw size={14} /> Làm mới
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tổng cửa hàng</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{stats?.totalShops ?? 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Store size={24} className="text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Hoạt động</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-1">{stats?.activeShops ?? 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <CheckCircle2 size={24} className="text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tổng đơn hàng</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{stats?.totalOrders ?? 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                    <ShoppingBag size={24} className="text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tổng doanh thu</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{formatVND(stats?.totalRevenue ?? 0)}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                    <DollarSign size={24} className="text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Shops List */}
          <Card>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store size={18} className="text-slate-400" />
                  <h3 className="font-bold text-slate-900">Danh sách cửa hàng</h3>
                  <Badge variant="secondary" className="text-xs">{shops.length} cửa hàng</Badge>
                </div>
              </div>

              {shops.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Store size={40} className="mx-auto mb-3 opacity-30" />
                  <p>Chưa có cửa hàng nào</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-surface-container-low/50">
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>Cửa hàng</TableHead>
                        <TableHead>Chủ sở hữu</TableHead>
                        <TableHead className="text-center">Đơn hàng</TableHead>
                        <TableHead className="text-center">Sản phẩm</TableHead>
                        <TableHead className="text-center">Nhân viên</TableHead>
                        <TableHead className="text-right">Doanh thu</TableHead>
                        <TableHead className="text-center">Trạng thái</TableHead>
                        <TableHead className="text-center">Ngày tạo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shops.map((shop, index) => (
                        <TableRow
                          key={shop.id}
                          className="hover:bg-surface-container-low/50 cursor-pointer"
                          onClick={() => setSelectedShop(shop)}
                        >
                          <TableCell className="font-medium text-slate-400">{index + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-surface-container-low rounded-lg flex items-center justify-center text-slate-600 font-bold">
                                {shop.name[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{shop.name}</p>
                                <p className="text-xs text-slate-400">{shop.slug}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium text-slate-700">{shop.owner_name}</p>
                            <p className="text-xs text-slate-400">{shop.owner_email}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 text-slate-600">
                              <ShoppingBag size={14} />
                              <span className="font-semibold">{shop.order_count}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 text-slate-600">
                              <Package size={14} />
                              <span className="font-semibold">{shop.product_count}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1 text-slate-600">
                              <Users size={14} />
                              <span className="font-semibold">{shop.employee_count}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-emerald-600">{formatVND(shop.total_revenue)}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={shop.is_active
                              ? "bg-emerald-100 text-emerald-700 border-0"
                              : "bg-red-100 text-red-700 border-0"
                            }>
                              {shop.is_active ? 'Hoạt động' : 'Tắt'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-sm text-slate-500">
                            {formatDate(shop.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        {/* Shop Detail Slide-over */}
        {selectedShop && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedShop(null)} />
            <div className="relative w-full max-w-4xl bg-surface h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-surface-container-low rounded-xl flex items-center justify-center text-xl font-bold text-slate-700">
                    {selectedShop.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{selectedShop.name}</h3>
                    <p className="text-sm text-slate-500">Chi tiết hoạt động cửa hàng</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedShop(null)}>
                  <LogOut size={20} className="rotate-180" />
                </Button>
              </div>

              <div className="flex border-b bg-surface-container-low/50 px-6">
                <button
                  className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${detailTab === 'menu' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  onClick={() => setDetailTab('menu')}
                >
                  Thực đơn
                </button>
                <button
                  className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${detailTab === 'orders' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  onClick={() => setDetailTab('orders')}
                >
                  Đơn hàng
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {detailLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="animate-spin text-slate-300" size={40} />
                  </div>
                ) : detailTab === 'menu' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {shopProducts.map((p) => (
                        <Card key={p.id}>
                          <CardContent className="p-4">
                            {p.image_url && (
                              <div className="aspect-square rounded-lg bg-surface-container-low mb-3 overflow-hidden">
                                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                              </div>
                            )}
                            <Badge variant="outline" className="mb-2 text-[10px]">{p.category_name}</Badge>
                            <h4 className="font-bold text-slate-900 mb-1">{p.name}</h4>
                            <p className="text-emerald-600 font-bold text-sm">{formatVND(p.price)}</p>
                          </CardContent>
                        </Card>
                      ))}
                      {shopProducts.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-400">
                          Chưa có sản phẩm nào
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mã đơn</TableHead>
                          <TableHead>Khách hàng</TableHead>
                          <TableHead className="text-right">Tổng tiền</TableHead>
                          <TableHead className="text-center">Trạng thái</TableHead>
                          <TableHead className="text-right">Thời gian</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shopOrders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono text-xs text-slate-500">#{String(o.id).slice(0, 8)}</TableCell>
                            <TableCell>
                              <p className="font-medium text-slate-900">{o.customer_name || 'Khách vãng lai'}</p>
                              <p className="text-[10px] text-slate-400">{o.customer_phone || '-'}</p>
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-900">{formatVND(o.total_price)}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={
                                o.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-0' :
                                o.status === 'cancelled' ? 'bg-red-100 text-red-700 border-0' :
                                'bg-blue-100 text-blue-700 border-0'
                              }>
                                {o.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs text-slate-400">
                              {formatDate(o.created_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {shopOrders.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="py-12 text-center text-slate-400">
                              Chưa có đơn hàng nào
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default SystemAdminDashboard;
