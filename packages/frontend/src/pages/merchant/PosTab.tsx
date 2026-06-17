import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShoppingCart, Trash2, Loader2, Plus, Minus, Search, Printer, X, CreditCard, Sparkles, CheckCircle, ArrowLeft, QrCode, AlertTriangle, Coffee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import api from '../../lib/api';
import { Button, Input, Card, Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui';
import { cn } from '../../lib/utils';
import { InvoiceTemplate } from '../../components/merchant/InvoiceTemplate';
import { toDbStatus } from '@/lib/orderStatus';
import { buildVietQrUrl } from '../../lib/vietqr';
import { vi } from '@/locales/vi';

interface Product {
  id: number;
  name: string;
  price: string;
  imageUrl?: string;
  isAvailable?: boolean;
}

interface Category {
  id: number;
  name: string;
  products: Product[];
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface TableOrder {
  id: number;
  tableNumber: string;
  status: string;
  totalPrice: string;
  items: CartItem[];
  createdAt: string;
  sessionId?: string;
}

interface GroupedTable {
  tableNumber: string;
  totalPrice: number;
  orders: TableOrder[];
  items: CartItem[];
}

interface PosTabProps {
  merchantId: string;
  merchantName: string;
  tableCount?: number;
  refreshTrigger?: number; // Passed from parent
  backUrl?: string; // Optional back URL for employee POS
}

export const PosTab: React.FC<PosTabProps> = ({ merchantId, merchantName, tableCount = 10, refreshTrigger = 0, backUrl }) => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'menu' | 'cart'>('menu');
  const [activeCategoryId, setActiveCategoryId] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState('Mang về');
  const [shouldPrint, setShouldPrint] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Table management
  const [tables, setTables] = useState<TableOrder[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState<GroupedTable | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [processingTableNumber, setProcessingTableNumber] = useState<string | null>(null);
  const [merchantInfo, setMerchantInfo] = useState<any>(null);
  const [payStep, setPayStep] = useState<'method' | 'qr'>('method');
  const [payMethod, setPayMethod] = useState<'cash' | 'vietqr'>('cash');
  const [mergePosModal, setMergePosModal] = useState<{ source: string; master: string } | null>(null);
  const [unmergePosModal, setUnmergePosModal] = useState<{ master: string; source: string } | null>(null);

  const invoiceRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const handlePrint = useReactToPrint({ contentRef: invoiceRef });

  const fetchMenu = async () => {
    try {
      const res = await api.get(`/menu/merchant/${merchantId}/categories`);
      setCategories(
        (Array.isArray(res.data) ? res.data : [])
          .map((cat: any) => ({
            ...cat,
            products: Array.isArray(cat.products) ? cat.products : [],
          })),
      );
    } catch {
      console.error('Lỗi khi lấy menu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchTables();
    fetchMerchantInfo();
  }, [merchantId, refreshTrigger]);

  const fetchMerchantInfo = async () => {
    try {
      const res = await api.get(`/merchants/${merchantId}`);
      setMerchantInfo(res.data);
    } catch { /* ignored */ }
  };

  const payQrUrl = useMemo(() => {
    if (!selectedTable || !merchantInfo?.bankAccount || !merchantInfo?.bankName) return null;
    return buildVietQrUrl(
      {
        bankName: merchantInfo.bankName,
        bankAccount: merchantInfo.bankAccount,
        bankOwner: merchantInfo.bankOwner ?? null,
      },
      selectedTable.totalPrice,
      `Ban ${selectedTable.tableNumber} thanh toan`,
    );
  }, [selectedTable, merchantInfo]);

  const fetchTables = async () => {
    setLoadingTables(true);
    try {
      // Try authenticated endpoint first
      let res;
      try {
        res = await api.get('/orders/active');
      } catch {
        // Fallback: get all merchant orders and filter
        res = await api.get(`/orders/merchant/${merchantId}/tables`);
      }
      const orders = Array.isArray(res.data?.orders) ? res.data.orders : (Array.isArray(res.data) ? res.data : []);
      setTables(orders);
    } catch {
      console.error('Lỗi khi lấy bàn');
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  const getTablesWithOrders = (): GroupedTable[] => {
    const tableGroups = new Map<string, GroupedTable>();
    tables.forEach(order => {
      // Filter: skip completed/cancelled/paid, skip takeaway orders
      if (
        order.tableNumber &&
        order.tableNumber !== 'Mang về' &&
        order.tableNumber !== 'Tại quầy' &&
        order.status !== 'completed' &&
        order.status !== 'cancelled' &&
        order.status !== 'paid'
      ) {
        const key = order.tableNumber;
        if (!tableGroups.has(key)) {
          tableGroups.set(key, {
            tableNumber: key,
            totalPrice: 0,
            orders: [],
            items: []
          });
        }
        
        const group = tableGroups.get(key)!;
        group.orders.push(order);
        group.totalPrice += parseFloat(order.totalPrice || '0');
        
        // Merge items
        if (Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const prod = item.product || { id: item.productId, name: item.name || 'Sản phẩm', price: String(item.price || 0) };
            const existingItem = group.items.find(i => i.product.id === prod.id);
            if (existingItem) {
              existingItem.quantity += item.quantity;
            } else {
              group.items.push({
                product: {
                  id: prod.id,
                  name: prod.name,
                  price: String(prod.price)
                },
                quantity: item.quantity
              });
            }
          });
        }
      }
    });
    return Array.from(tableGroups.values());
  };

  const clearTable = async (group: GroupedTable) => {
    if (!confirm(`Dọn bàn ${group.tableNumber}? Tất cả đơn của bàn này sẽ được đánh dấu hoàn thành.`)) return;
    setProcessingTableNumber(group.tableNumber);
    try {
      await Promise.all(
        group.orders.map(order =>
          api.put(`/orders/merchant/${merchantId}/${order.id}/status`, { status: toDbStatus('COMPLETED') })
        )
      );
      await fetchTables();
    } catch {
      alert('Dọn bàn thất bại');
    } finally {
      setProcessingTableNumber(null);
    }
  };

  const confirmMergePos = async () => {
    if (!mergePosModal?.master.trim()) return;
    try {
      await api.post('/orders/tables/merge', {
        masterTableNumber: mergePosModal.master.trim(),
        sourceTableNumbers: [mergePosModal.source],
      });
      await fetchTables();
      setMergePosModal(null);
    } catch {
      alert('Ghép bàn thất bại');
    }
  };

  const confirmUnmergePos = async () => {
    if (!unmergePosModal?.source.trim()) return;
    try {
      await api.post('/orders/tables/split', {
        masterTableNumber: unmergePosModal.master,
        sourceTableNumber: unmergePosModal.source.trim(),
      });
      await fetchTables();
      setUnmergePosModal(null);
    } catch {
      alert('Tách bàn thất bại');
    }
  };

  const payTable = async (group: GroupedTable) => {
    setSelectedTable(group);
    setPayStep('method'); // Reset step
    setPayMethod('cash'); // Reset method
    setShowPayModal(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      const typing =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        el?.isContentEditable;

      if (e.key === 'F3') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select?.();
        return;
      }
      if (e.key === 'F9' && !typing) {
        e.preventDefault();
        const openTables = getTablesWithOrders();
        if (openTables.length > 0) {
          void payTable(openTables[0]);
        } else {
          setActiveView('cart');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tables]);

  const confirmPayTable = async () => {
    if (!selectedTable) return;
    setProcessingTableNumber(selectedTable.tableNumber);
    try {
      await api.post(`/orders/merchant/${merchantId}/table/${selectedTable.tableNumber}/pay`);
      setShowPayModal(false);
      setSelectedTable(null);
      await fetchTables();
      if (shouldPrint) {
        setLastOrder({
          id: selectedTable.orders[0]?.id || 0,
          tableNumber: selectedTable.tableNumber,
          totalPrice: String(selectedTable.totalPrice),
          items: selectedTable.items,
          createdAt: new Date().toISOString()
        });
        setTimeout(() => handlePrint(), 500);
      }
    } catch {
      alert('Thanh toán bàn thất bại');
    } finally {
      setProcessingTableNumber(null);
    }
  };

  const addToCart = (product: Product) => {
    if (product.isAvailable === false) return;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + (+item.product.price * item.quantity), 0);
  const discountAmount = discountValue
    ? discountType === 'percent'
      ? Math.min(subtotal * (parseFloat(discountValue) / 100), subtotal)
      : Math.min(parseFloat(discountValue), subtotal)
    : 0;
  const totalAmount = subtotal - discountAmount;

  const applyDiscount = () => {
    const val = parseFloat(discountValue);
    if (isNaN(val) || val < 0) {
      setDiscountValue('');
      setShowDiscountInput(false);
      return;
    }
    if (discountType === 'percent' && val > 100) {
      setDiscountValue('100');
    }
    setShowDiscountInput(false);
  };

  const clearDiscount = () => {
    setDiscountValue('');
    setShowDiscountInput(false);
  };

  const confirmOrder = async () => {
    if (cart.length === 0) return;
    setPlacingOrder(true);
    try {
      let linkedSessionId = undefined;

      // Try to find active session for the table to merge orders
      if (tableNumber !== 'Mang về' && tableNumber !== 'Tại quầy') {
        try {
          const activeOrdersRes = await api.get(`/orders/active/${merchantId}/${tableNumber}`);
          const activeOrders = activeOrdersRes.data;
          if (Array.isArray(activeOrders) && activeOrders.length > 0) {
            linkedSessionId = activeOrders.find(o => o.sessionId)?.sessionId;
          }
        } catch (e) {
          console.warn('Failed to fetch active session:', e);
        }
      }

      const orderData = {
        merchantId,
        tableNumber: tableNumber || 'Quầy',
        sessionId: linkedSessionId,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.price
        })),
        subtotalPrice: subtotal.toString(),
        discountType: discountValue ? discountType : undefined,
        discountValue: discountValue ? parseFloat(discountValue) : undefined,
        discountAmount: discountAmount.toString(),
        totalPrice: totalAmount.toString(),
        type: 'order',
        fromPos: true,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
      };

      const res = await api.post('/orders', orderData);
      const newOrder = res.data?.order || res.data;

      // No need to explicitly update status to 'pending' as the backend defaults to 'pending'.
      // This also avoids the 400 error when trying to transition from 'pending' to 'pending'.

      setLastOrder({ ...newOrder, items: cart });
      setCart([]);
      setDiscountValue('');
      setShowDiscountInput(false);
      setCustomerName('');
      setCustomerPhone('');

      const isTableOrder = tableNumber !== 'Mang về' && tableNumber !== 'Tại quầy';
      setTableNumber('Mang về');
      
      if (shouldPrint && !isTableOrder) {
        setTimeout(() => handlePrint(), 500);
      }
    } catch {
      alert('Tạo đơn hàng thất bại');
    } finally {
      setPlacingOrder(false);
    }
  };

  const filteredProducts = (
    activeCategoryId === 'all'
      ? categories.flatMap(c => c.products || [])
      : (categories.find(c => c.id === activeCategoryId)?.products || [])
  ).filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return <div className="p-10 flex justify-center h-full items-center bg-transparent"><Loader2 className="animate-spin text-primary" size={48} /></div>;
  }

  if (categories.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-700 h-full bg-surface/40 backdrop-blur-sm rounded-[2rem] border border-white/20 m-6">
        <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center mb-8 relative group">
          <div className="absolute inset-0 bg-primary/5 rounded-full animate-ping" />
          <div className="absolute inset-0 bg-primary/20 rounded-full scale-0 group-hover:scale-110 transition-transform duration-500" />
          <Coffee size={64} className="text-primary relative z-10 transition-transform duration-500 group-hover:rotate-12" />
        </div>
        <h2 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Cửa hàng chưa có thực đơn</h2>
        <p className="text-slate-500 max-w-sm mx-auto mb-10 font-bold text-sm leading-relaxed uppercase tracking-wide opacity-60">
          Vui lòng thiết lập các Danh mục và Món ăn trong phần quản lý thực đơn trước khi bắt đầu.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={() => navigate('/merchant?tab=settings&section=menu')}
            className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-primary/20 bg-primary hover:bg-primary/90 hover:scale-[1.05] active:scale-[0.95] transition-all transform"
          >
            Thiết lập thực đơn ngay
          </Button>
          <Button 
            variant="ghost"
            onClick={() => fetchMenu()}
            className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400 hover:text-primary hover:bg-primary/5 transition-all"
          >
            Làm mới trang
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-transparent overflow-hidden font-sans text-slate-900 border-none">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-slate-100 bg-surface/90 px-2 sm:px-4">
        <button
          type="button"
          onClick={() => setActiveView('menu')}
          className={cn(
            'rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
            activeView === 'menu'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-slate-500 hover:bg-surface-container-low',
          )}
        >
          {vi.pos.tabMenu}
        </button>
        <button
          type="button"
          onClick={() => setActiveView('cart')}
          className={cn(
            'rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all',
            activeView === 'cart'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-slate-500 hover:bg-surface-container-low',
          )}
        >
          {vi.pos.tabTables}
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
      {/* ─── Product List & Search ─── */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 bg-transparent z-10 relative overflow-hidden transition-all",
        activeView === 'cart' ? 'hidden lg:flex' : 'flex'
      )}>
        {/* Search Header */}
        <header className="h-20 flex items-center px-4 lg:px-6 shrink-0 gap-4">
          {backUrl && (
            <button
              onClick={() => navigate(backUrl)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface shadow-sm hover:bg-surface-container-low transition-colors text-slate-500 hover:text-primary shrink-0"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className={cn("relative max-w-2xl", backUrl ? "flex-1" : "flex-1")}>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <Input 
              ref={searchInputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={vi.pos.searchShortcut}
              className="h-12 pl-12 pr-4 bg-surface border-none shadow-sm focus:ring-1 focus:ring-primary/20 rounded-2xl text-[13px] font-bold transition-all"
            />
          </div>
          {/* Categories Horizontal */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-md">
            <button 
              onClick={() => setActiveCategoryId('all')}
              className={cn(
                "px-4 py-2 rounded-xl whitespace-nowrap text-[10px] font-black uppercase tracking-widest transition-all",
                activeCategoryId === 'all' ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-surface text-slate-400 hover:bg-surface-container-low"
              )}
            >Tất cả</button>
            {categories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={cn(
                  "px-4 py-2 rounded-xl whitespace-nowrap text-[10px] font-black uppercase tracking-widest transition-all",
                  activeCategoryId === cat.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-surface text-slate-400 hover:bg-surface-container-low"
                )}
              >{cat.name}</button>
            ))}
          </div>
        </header>

        {/* Table Management Section */}
        <div className="px-4 lg:px-6 pb-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Bàn đang có đơn</h3>
            <button onClick={fetchTables} className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors">
              Làm mới
            </button>
          </div>
          {loadingTables ? (
            <div className="flex items-center gap-2 text-slate-300">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs font-bold">Đang tải...</span>
            </div>
          ) : getTablesWithOrders().length === 0 ? (
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle size={14} />
              <span className="text-xs font-bold">Tất cả bàn trống</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {getTablesWithOrders().map(order => (
                <div
                  key={order.tableNumber}
                  className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shrink-0 min-w-[180px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm text-amber-800">Bàn {order.tableNumber}</p>
                    <p className="text-[10px] font-bold text-amber-600">
                      {Intl.NumberFormat('vi-VN').format(order.totalPrice)}đ
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => payTable(order)}
                      disabled={processingTableNumber === order.tableNumber}
                      className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-50"
                      title="Thanh toán"
                    >
                      {processingTableNumber === order.tableNumber ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CreditCard size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => setMergePosModal({ source: order.tableNumber, master: '01' })}
                      className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 transition-all"
                      title="Ghép bàn"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => setUnmergePosModal({ master: order.tableNumber, source: '' })}
                      className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 transition-all"
                      title="Tách bàn"
                    >
                      <Minus size={14} />
                    </button>
                    <button
                      onClick={() => clearTable(order)}
                      disabled={processingTableNumber === order.tableNumber}
                      className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-all disabled:opacity-50"
                      title="Dọn bàn"
                    >
                      <Sparkles size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 scroll-smooth thin-scrollbar">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-6 gap-4">
            {filteredProducts.map(prod => (
              <Card 
                key={prod.id} 
                className={cn(
                  "group relative flex flex-col border-none shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden rounded-[24px] bg-surface",
                  prod.isAvailable === false ? 'opacity-60 grayscale' : 'hover:-translate-y-1'
                )}
                onClick={() => addToCart(prod)}
              >
                <div className="aspect-square relative bg-surface-container-low overflow-hidden">
                  {prod.imageUrl ? (
                    <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container-low text-slate-200"><Plus size={32} /></div>
                  )}
                  {prod.isAvailable === false && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="bg-surface/90 px-3 py-1 rounded-full text-[10px] font-black text-red-600 uppercase tracking-widest shadow-xl">Hết</span>
                    </div>
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1 bg-surface">
                  <h3 className="font-bold text-[13px] text-slate-700 line-clamp-1 leading-none">{prod.name}</h3>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-primary font-black text-sm">{Intl.NumberFormat('vi-VN').format(+prod.price)}đ</span>
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <Plus size={14} />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300">
                <Search size={48} className="mb-4 opacity-10" />
                <p className="font-bold uppercase tracking-widest text-[10px]">Không tìm thấy món</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile View Cart Bar */}
        <div className="lg:hidden p-4 bg-surface border-t border-slate-100 shrink-0">
          <Button 
            className="w-full h-12 rounded-2xl flex items-center justify-between px-6 font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
            onClick={() => setActiveView('cart')}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart size={18} />
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-primary">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
              Xem giỏ hàng
            </div>
            <span className="flex items-center gap-1">
              {discountAmount > 0 && <span className="text-red-500 text-[9px] line-through opacity-60">{Intl.NumberFormat('vi-VN').format(subtotal)}đ</span>}
              <span>{Intl.NumberFormat('vi-VN').format(totalAmount)}đ</span>
            </span>
          </Button>
        </div>
      </div>

      {/* ─── RIGHT: Cart Side Panel ─── */}
      <div className={cn(
        "w-full lg:w-[320px] xl:w-[380px] flex flex-col bg-surface shrink-0 border-l border-slate-100 relative z-20 transition-all",
        activeView === 'menu' ? 'hidden lg:flex' : 'flex'
      )}>
        <header className="h-20 border-b border-slate-200 bg-surface flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-primary transition-colors" onClick={() => setActiveView('menu')}>
              <X size={24} />
            </button>
            <div className="relative">
              <ShoppingCart className="text-primary" size={24} />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </div>
            <h2 className="font-black text-lg text-slate-800 uppercase tracking-tight">Chi tiết đơn</h2>
          </div>
          <button onClick={() => setCart([])} className="text-slate-400 hover:text-red-500 transition-colors p-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest">
            <Trash2 size={14} /> Xóa rổ
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 thin-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30 select-none pointer-events-none">
              <ShoppingCart size={64} className="mb-4" />
              <p className="font-black text-sm uppercase tracking-widest">Rổ hàng đang trống</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="bg-surface p-4 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 hover:border-primary/20 transition-all group">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-800 line-clamp-1 leading-none">{item.product.name}</p>
                  <p className="text-[10px] font-black text-primary uppercase mt-1.5 tracking-wider">{Intl.NumberFormat('vi-VN').format(+item.product.price)}đ / Món</p>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center bg-surface-container-low rounded-xl p-1 gap-1 border border-slate-200/50">
                      <button 
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-surface hover:text-primary hover:shadow-sm transition-all shadow-none"
                      >
                        <Minus size={14} strokeWidth={3} />
                      </button>
                      <span className="w-8 text-center font-black text-sm text-slate-700">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-surface hover:text-primary hover:shadow-sm transition-all shadow-none"
                      >
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    </div>
                    <span className="font-black text-slate-900 text-sm">{Intl.NumberFormat('vi-VN').format(+item.product.price * item.quantity)}</span>
                  </div>
                </div>
                <button onClick={() => removeFromCart(item.product.id)} className="text-slate-200 hover:text-red-500 transition-colors p-1.5 rounded-xl hover:bg-red-500/5 lg:opacity-0 group-hover:opacity-100">
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer Checkout */}
        <div className="p-6 bg-surface border-t border-slate-200 space-y-4 shadow-[0_-15px_40px_rgba(0,0,0,0.04)] z-30">
          <div className="space-y-3 bg-surface-container-low p-4 rounded-2xl border border-slate-200/50">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Bàn phục vụ</label>
              <select
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                className="h-10 w-full appearance-none bg-surface rounded-xl border border-slate-200 px-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all cursor-pointer text-sm"
              >
                <option value="Mang về">Mang về</option>
                <option value="Tại quầy">Tại quầy</option>
                {Array.from({ length: tableCount ?? 10 }, (_, i) => {
                  const numStr = String(i + 1).padStart(2, '0');
                  return (
                    <option key={i + 1} value={numStr}>Bàn {i + 1}</option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Khách hàng</label>
                <input
                  type="text"
                  placeholder="Tên khách"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="h-10 w-full bg-surface rounded-xl border border-slate-200 px-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Số điện thoại</label>
                <input
                  type="tel"
                  placeholder="09xxx..."
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="h-10 w-full bg-surface rounded-xl border border-slate-200 px-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all text-sm"
                />
              </div>
            </div>

            {/* Discount Section */}
            <div className="pt-1 flex flex-col gap-2">
              {showDiscountInput ? (
                <div className="flex items-center gap-2">
                  <div className="flex bg-surface rounded-xl border border-slate-200 overflow-hidden flex-1">
                    <button
                      onClick={() => setDiscountType('percent')}
                      className={cn(
                        "flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition-all",
                        discountType === 'percent' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-surface-container-low'
                      )}
                    >%</button>
                    <button
                      onClick={() => setDiscountType('amount')}
                      className={cn(
                        "flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition-all",
                        discountType === 'amount' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-surface-container-low'
                      )}
                    >₫</button>
                  </div>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyDiscount()}
                    placeholder={discountType === 'percent' ? '0-100' : '0'}
                    min="0"
                    max={discountType === 'percent' ? 100 : undefined}
                    className="flex-1 h-10 px-3 bg-surface rounded-xl border border-slate-200 font-bold text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                    autoFocus
                  />
                  <button
                    onClick={applyDiscount}
                    className="h-10 px-4 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-primary/90 transition-all"
                  >OK</button>
                  <button
                    onClick={clearDiscount}
                    className="h-10 px-3 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowDiscountInput(true)}
                    className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">Giảm giá</span>
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                  {discountValue && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-wider">
                        -{discountType === 'percent' ? `${discountValue}%` : `${Intl.NumberFormat('vi-VN').format(parseFloat(discountValue))}đ`}
                      </span>
                      <button onClick={clearDiscount} className="text-slate-300 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-1">
              {discountAmount > 0 && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-slate-400">Tạm tính</span>
                  <span className="text-[10px] font-bold text-slate-400 line-through">
                    {Intl.NumberFormat('vi-VN').format(subtotal)}đ
                  </span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-red-500">Giảm giá</span>
                  <span className="text-[10px] font-bold text-red-500">
                    -{Intl.NumberFormat('vi-VN').format(discountAmount)}đ
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[2px]">Thành tiền</span>
                <span className="text-xl font-black text-primary tracking-tight">
                  {Intl.NumberFormat('vi-VN').format(totalAmount)}đ
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 py-1 bg-surface-container-low rounded-xl border border-slate-200/50">
            <div className="flex items-center gap-2">
              <Printer size={14} className={shouldPrint ? "text-primary" : "text-slate-300"} />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">In bill tự động</span>
            </div>
            <button 
              onClick={() => setShouldPrint(!shouldPrint)}
              className={cn("w-9 h-4 rounded-full relative transition-colors", shouldPrint ? 'bg-primary' : 'bg-slate-300')}
            >
              <div className={cn("absolute top-0.5 w-3 h-3 bg-surface rounded-full transition-all", shouldPrint ? 'right-0.5' : 'left-0.5')} />
            </button>
          </div>

          <Button 
            className="w-full h-14 text-sm font-black gap-3 rounded-2xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all transform uppercase tracking-widest flex items-center justify-center disabled:grayscale disabled:scale-100"
            disabled={cart.length === 0 || placingOrder}
            onClick={confirmOrder}
          >
            {placingOrder ? (
              <Loader2 className="animate-spin text-white" size={20} />
            ) : (
              <>
                {tableNumber === 'Mang về' || tableNumber === 'Tại quầy' ? (
                  <>
                    <Printer size={18} className="opacity-80" strokeWidth={2.5} />
                    Thanh toán
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} className="opacity-80" strokeWidth={2.5} />
                    Đặt món
                  </>
                )}
              </>
            )}
          </Button>
        </div>
      </div>
      </div>

      {/* Pay Table Modal */}
      {showPayModal && selectedTable && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShowPayModal(false)}>
          <div className="bg-surface rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-300" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 bg-slate-900 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-surface/10 flex items-center justify-center text-primary">
                    <CreditCard size={20} />
                 </div>
                 <div>
                    <h3 className="font-black text-sm uppercase tracking-widest leading-none">Thanh toán</h3>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">Bàn {selectedTable.tableNumber}</p>
                 </div>
              </div>
              <button onClick={() => setShowPayModal(false)} className="w-8 h-8 rounded-full bg-surface/10 flex items-center justify-center hover:bg-surface/20 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 scrollbar-hide max-h-[70vh] overflow-y-auto">
              {payStep === 'method' ? (
                <div className="space-y-6">
                  <div className="text-center py-4 bg-surface-container-low rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Cần thanh toán</p>
                    <p className="text-3xl font-black text-primary tracking-tight">{Intl.NumberFormat('vi-VN').format(selectedTable.totalPrice)}đ</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={() => setPayMethod('cash')}
                      className={cn("p-4 rounded-2xl border-2 flex items-center justify-between transition-all group", payMethod === 'cash' ? "border-primary bg-primary/5 shadow-premium" : "border-slate-100 hover:border-primary/20")}
                    >
                      <div className="flex items-center gap-4 text-left">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", payMethod === 'cash' ? "bg-primary text-white" : "bg-surface-container-low text-slate-400")}>
                          <ShoppingCart size={24} />
                        </div>
                        <div>
                          <p className="font-black text-sm text-slate-900">Tiền mặt</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Khách gửi tiền trực tiếp</p>
                        </div>
                      </div>
                      <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center", payMethod === 'cash' ? "bg-primary border-primary text-white" : "border-slate-200")}>
                        {payMethod === 'cash' && <CheckCircle size={14} strokeWidth={4} />}
                      </div>
                    </button>

                    <button 
                      onClick={() => setPayMethod('vietqr')}
                      className={cn("p-4 rounded-2xl border-2 flex items-center justify-between transition-all group", payMethod === 'vietqr' ? "border-indigo-600 bg-indigo-50 shadow-premium" : "border-slate-100 hover:border-indigo-600/20")}
                    >
                      <div className="flex items-center gap-4 text-left">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", payMethod === 'vietqr' ? "bg-indigo-600 text-white" : "bg-surface-container-low text-slate-400")}>
                          <QrCode size={24} />
                        </div>
                        <div>
                          <p className="font-black text-sm text-slate-900 transition-colors group-hover:text-indigo-600">Chuyển khoản</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tạo mã QR VietQR</p>
                        </div>
                      </div>
                      <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center", payMethod === 'vietqr' ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200")}>
                        {payMethod === 'vietqr' && <CheckCircle size={14} strokeWidth={4} />}
                      </div>
                    </button>
                  </div>

                  {payMethod === 'vietqr' && (!merchantInfo?.bankAccount || !merchantInfo?.bankName) && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-amber-800">
                      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black">Chưa thiết lập ngân hàng!</p>
                        <p className="text-[9px] font-medium leading-relaxed mt-1 opacity-80">Vui lòng vào phần Cài đặt để cập nhật thông tin Ngân hàng trước khi dùng VietQR.</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center py-4 space-y-6">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Mã thanh toán</p>
                    <p className="text-2xl font-black text-primary tracking-tight">{Intl.NumberFormat('vi-VN').format(selectedTable.totalPrice)}đ</p>
                  </div>

                  <div className="relative p-6 bg-surface rounded-[2.5rem] shadow-premium border-4 border-slate-50 flex flex-col items-center text-center">
                    {payQrUrl ? (
                      <>
                        <img src={payQrUrl} alt="VietQR" className="w-56 h-56 object-contain" />
                        <div className="mt-4 space-y-1">
                          <p className="text-xs font-black text-slate-900 uppercase">{merchantInfo.bankName} - {merchantInfo.bankAccount}</p>
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{merchantInfo.bankOwner}</p>
                        </div>
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-indigo-600 text-white rounded-full flex items-center gap-2 shadow-xl">
                          <CreditCard size={12} fill="white" />
                          <span className="text-[10px] font-black tracking-widest uppercase">VietQR</span>
                        </div>
                      </>
                    ) : (
                       <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-400 gap-2 px-2 text-center">
                          <QrCode size={40} />
                          <p className="text-[10px] font-bold">Chưa cài đặt thông tin thanh toán</p>
                       </div>
                    )}
                  </div>

                  <p className="text-[10px] text-center font-bold text-slate-400 leading-relaxed px-6">
                    Nội dung: <span className="text-slate-900">BAN {selectedTable.tableNumber} thanh toan</span> <br/>
                    Khách hàng quét mã bằng App Ngân hàng bất kỳ.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 bg-surface-container-low border-t border-slate-100 flex gap-4">
              {payStep === 'method' ? (
                <>
                  <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px]" onClick={() => setShowPayModal(false)}>Hủy</Button>
                  <Button 
                    disabled={payMethod === 'vietqr' && (!merchantInfo?.bankAccount || !merchantInfo?.bankName)}
                    className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20" 
                    onClick={() => payMethod === 'cash' ? confirmPayTable() : setPayStep('qr')}
                  >
                    Tiếp tục
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px]" onClick={() => setPayStep('method')}>Trở lại</Button>
                  <Button 
                    disabled={processingTableNumber === selectedTable.tableNumber}
                    className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20" 
                    onClick={confirmPayTable}
                  >
                    {processingTableNumber === selectedTable.tableNumber ? <Loader2 className="animate-spin mr-2" size={16} /> : <CheckCircle size={16} className="mr-2" strokeWidth={3} />}
                    Xác nhận
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!mergePosModal} onOpenChange={(open) => !open && setMergePosModal(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Ghép bàn</DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Gộp đơn đang mở từ <span className="font-bold text-slate-800">Bàn {mergePosModal?.source}</span> sang bàn chính.
          </DialogDescription>
          <div className="space-y-2 py-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Bàn chính</label>
            <Input
              value={mergePosModal?.master ?? ''}
              onChange={(e) => mergePosModal && setMergePosModal({ ...mergePosModal, master: e.target.value })}
              placeholder="Ví dụ: 01"
              className="rounded-xl"
            />
          </div>
          <p className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
            Xác nhận: Bàn {mergePosModal?.source} → Bàn {mergePosModal?.master?.trim() || '…'}
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={() => setMergePosModal(null)}>
              Hủy
            </Button>
            <Button type="button" onClick={() => void confirmMergePos()} disabled={!mergePosModal?.master.trim()}>
              Xác nhận ghép
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!unmergePosModal} onOpenChange={(open) => !open && setUnmergePosModal(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogTitle>Tách bàn phụ</DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            Bàn hiện tại đang là bàn chính <span className="font-bold">{unmergePosModal?.master}</span>. Nhập số bàn phụ cần tách
            (đơn sẽ về lại bàn đó).
          </DialogDescription>
          <div className="space-y-2 py-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Số bàn phụ</label>
            <Input
              value={unmergePosModal?.source ?? ''}
              onChange={(e) => unmergePosModal && setUnmergePosModal({ ...unmergePosModal, source: e.target.value })}
              placeholder="Ví dụ: 02"
              className="rounded-xl"
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={() => setUnmergePosModal(null)}>
              Hủy
            </Button>
            <Button type="button" onClick={() => void confirmUnmergePos()} disabled={!unmergePosModal?.source.trim()}>
              Xác nhận tách
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="hidden">
        {lastOrder && (
          <InvoiceTemplate 
            ref={invoiceRef}
            merchantName={merchantName}
            tableNumber={lastOrder.tableNumber}
            orderId={lastOrder.id}
            items={lastOrder.items}
            totalPrice={lastOrder.totalPrice}
            createdAt={lastOrder.createdAt}
          />
        )}
      </div>
    </div>
  );
};
