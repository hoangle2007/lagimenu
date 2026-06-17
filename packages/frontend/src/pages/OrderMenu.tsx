import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { Search, ShoppingCart, Plus, Loader2, ChevronRight, Send, ArrowLeft, MapPin, Phone, X, RefreshCw, ChevronLeft, Gift, Paintbrush } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import axios from 'axios';
import { fetchOrderGuard, withOrderGeo, type OrderGuardConfig } from '../lib/customerOrderGeo';
import { ProductDetail } from '../components/ProductDetail';
import { CartModal } from '../components/CartModal';
import { LoyaltyDrinksNudge, isDrinksLikeCategoryName } from '../components/LoyaltyDrinksNudge';
import { CustomerLoyaltyLookupModal } from '../components/CustomerLoyaltyLookupModal';
import { useCustomerSocket } from '../hooks/useCustomerSocket';
import { WifiWelcomeModal } from '../components/WifiWelcomeModal';
import { withRetry } from '../lib/withRetry';
import {
  CustomerOrderTracker,
  filterKitchenOrders,
} from '../components/CustomerOrderTracker';

const LEGACY_CART_KEY = 'cart_items_v2';

interface Product {
  id: number;
  name: string;
  price: string;
  description?: string;
  imageUrl?: string;
  categoryId?: number;
  options?: string;
  saleActive?: boolean;
  salePrice?: number;
  salePinned?: boolean;
  discountLabel?: string | null;
  originalPrice?: string;
}

function parseVndDigits(v: string | undefined): number {
  const d = String(v ?? '').replace(/\D/g, '');
  return d ? Number(d) : 0;
}

/** Giá đơn vị gốc (đã sale nếu đang active). */
function getProductUnitBase(product: Product): number {
  const list = parseVndDigits(product.price);
  if (product.saleActive && typeof product.salePrice === 'number' && product.salePrice > 0) {
    return product.salePrice;
  }
  return list;
}

interface Category {
  id: number;
  name: string;
  products?: Product[];
}

interface CartItem {
  product: Product;
  quantity: number;
  options: {
    size: string;
    sugar: string;
    toppings: string[];
  };
}

export const OrderMenu: React.FC = () => {
  const { merchantId, shopId, tableId } = useParams<{
    merchantId?: string;
    shopId?: string;
    tableId: string;
  }>();
  const resolvedMerchantId = merchantId ?? shopId ?? '';
  const navigate = useNavigate();
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('user-theme') || 'orange');
  const [showThemePicker, setShowThemePicker] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('user-theme', theme);
  }, [theme]);

  const cartStorageKey = useMemo(() => {
    if (!resolvedMerchantId || !tableId) return null;
    return `cart_items_v2::${resolvedMerchantId}::${tableId.padStart(2, '0')}`;
  }, [resolvedMerchantId, tableId]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchantInfo, setMerchantInfo] = useState<any>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [existingOrders, setExistingOrders] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState({ title: '', sub: '' });
  const [tableDisplayName, setTableDisplayName] = useState<string | null>(null);
  const [orderGuard, setOrderGuard] = useState<OrderGuardConfig>({ requireLocation: false });
  const [networkWeak, setNetworkWeak] = useState(false);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const [showCustomerLoyaltyModal, setShowCustomerLoyaltyModal] = useState(false);
  const [customerLoyaltyPanelKey, setCustomerLoyaltyPanelKey] = useState(0);

  const kitchenOrders = useMemo(
    () => filterKitchenOrders(existingOrders),
    [existingOrders],
  );

  // REAL-TIME: Listen for order status updates from the merchant
  const { updatedOrder, clearUpdatedOrder } = useCustomerSocket(resolvedMerchantId);

  useEffect(() => {
    if (updatedOrder) {
      setExistingOrders(prev => {
        // If the order exists, update it; otherwise add it (for redundancy)
        const exists = prev.some(o => o.id === updatedOrder.id);
        if (exists) {
          return prev.map(o => o.id === updatedOrder.id ? { ...o, status: updatedOrder.status } : o);
        }
        return [updatedOrder, ...prev];
      });
      clearUpdatedOrder();

      // Show a toast when an order is served (ready)
      if (updatedOrder.status === 'ready' || updatedOrder.status === 'completed') {
        const title = updatedOrder.status === 'ready' ? '🍽️ Món ăn đã sẵn sàng!' : '✅ Đã hoàn thành!';
        const sub = updatedOrder.status === 'ready' ? 'Nhân viên đang mang món ra cho bạn.' : 'Món đã được phục vụ tận nơi.';
        setToastMessage({ title, sub });
        setOrderSuccess(true);
      }
    }
  }, [updatedOrder, clearUpdatedOrder]);

  const categoryRefs = useRef<{ [key: number]: HTMLElement | null }>({});

  const fetchData = async () => {
    try {
      const queryParams = new URLSearchParams(window.location.search);
      const token = queryParams.get('token');
      const safeTableId = tableId ?? '1';
      const paddedTableId = safeTableId.padStart(2, '0');

      const [menuRes, ordersRes, tableRes, guardCfg] = await Promise.all([
        withRetry(() => api.get(`public/menu/${resolvedMerchantId}`), 1, 350),
        withRetry(
          () => api.get(`orders/active/${resolvedMerchantId}/${paddedTableId}`),
          1,
          350,
        ),
        withRetry(
          () =>
            api.get(`public/table/${resolvedMerchantId}/${paddedTableId}`).catch(() => ({ data: null })),
          1,
          350,
        ),
        withRetry(() => fetchOrderGuard(api, resolvedMerchantId), 1, 350),
      ]);
      setNetworkWeak(false);
      setOrderGuard(guardCfg);
      setTableDisplayName(
        (tableRes as { data?: { displayName?: string } })?.data?.displayName ??
          `Bàn ${parseInt(paddedTableId, 10) || safeTableId}`,
      );

      const m = menuRes.data?.merchant;
      setMerchantInfo({
        ...m,
        logoUrl: m?.logoUrl || m?.logo_url,
        bannerUrl: m?.bannerUrl || m?.banner_url,
        openTime: m?.openTime || m?.open_time,
        closeTime: m?.closeTime || m?.close_time,
        wifiSsid: m?.wifiSsid ?? m?.wifi_ssid,
        wifiPassword: m?.wifiPassword ?? m?.wifi_password,
      });
      setCategories(
        (menuRes.data?.categories ?? []).map((cat: any) => ({
          ...cat,
          products: (cat.products ?? []).map((p: any) => ({
            ...p,
            categoryId: p.categoryId ?? cat.id,
          })),
        })),
      );
      setExistingOrders(ordersRes.data?.orders ?? []);

      try {
        const saleCount = (menuRes.data?.categories ?? []).reduce((acc: number, cat: any) => {
          const n = (cat.products ?? []).filter((p: any) => p.saleActive).length;
          return acc + n;
        }, 0);
        if (saleCount > 0) {
          const toastKey = `sale_toast_shown_${resolvedMerchantId}_${paddedTableId}`;
          if (!sessionStorage.getItem(toastKey)) {
            sessionStorage.setItem(toastKey, '1');
            toast.success(`Đang có ${saleCount} món khuyến mãi — xem trong "Gợi ý cho bạn" (kéo ngang).`, { duration: 4500 });
          }
        }
      } catch {
        /* ignore */
      }

      try {
        // Only re-use stored session if NOT scanning a new QR (no token).
        // New QR scan = fresh session, ignore old paid sessionId.
        const storedSessionId = !token
          ? localStorage.getItem(`session_${resolvedMerchantId}_${paddedTableId}`)
          : null;

        const queryString = [
          token ? `token=${token}` : null,
          storedSessionId ? `sessionId=${storedSessionId}` : null,
        ].filter(Boolean).join('&');

        const sessionRes = await api.get(
          `/public/session/${resolvedMerchantId}/${paddedTableId}${queryString ? `?${queryString}` : ''}`
        );

        if (sessionRes.data.canOrder === false) {
          setSessionId(null);
          localStorage.removeItem(`session_${resolvedMerchantId}_${paddedTableId}`);
          setSessionError(
            sessionRes.data.message ?? 'Phiên đặt món đã kết thúc. Vui lòng quét lại mã QR mới tại bàn.',
          );
        } else {
          setSessionId(sessionRes.data.id ?? null);
          if (sessionRes.data.id) {
            localStorage.setItem(`session_${resolvedMerchantId}_${paddedTableId}`, sessionRes.data.id);
          }
          setSessionError(null);
        }

        if (token) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch (sErr: any) {
        if (sErr.response?.status === 403 || sErr.response?.data?.canOrder === false) {
          setSessionError(sErr.response?.data?.message ?? 'Chế độ xem menu');
          setSessionId(null);
          localStorage.removeItem(`session_${resolvedMerchantId}_${paddedTableId}`);
        } else {
          console.error('Session error:', sErr);
        }
      }

      if (menuRes.data.categories?.length > 0) {
        if (!activeCategory) setActiveCategory(menuRes.data.categories[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setNetworkWeak(true);
      toast.error('Mạng yếu, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (resolvedMerchantId && tableId) {
      fetchData();
    }
  }, [resolvedMerchantId, tableId]);

  // ── localStorage cart persistence (scoped per shop + table; legacy key migrated once) ──
  const prevCartRef = useRef<CartItem[]>([]);

  useLayoutEffect(() => {
    if (!cartStorageKey) return;
    try {
      let raw = localStorage.getItem(cartStorageKey);
      if (!raw) {
        const legacy = localStorage.getItem(LEGACY_CART_KEY);
        if (legacy) {
          raw = legacy;
          localStorage.removeItem(LEGACY_CART_KEY);
          localStorage.setItem(cartStorageKey, legacy);
        }
      }
      const loaded: CartItem[] = raw ? JSON.parse(raw) : [];
      prevCartRef.current = loaded;
      setCart(loaded);
    } catch {
      localStorage.removeItem(cartStorageKey);
      localStorage.removeItem(LEGACY_CART_KEY);
      prevCartRef.current = [];
      setCart([]);
    }
  }, [cartStorageKey]);

  useEffect(() => {
    if (!cartStorageKey) return;
    const timeout = setTimeout(() => {
      if (cart === prevCartRef.current) return;
      prevCartRef.current = cart;
      try {
        localStorage.setItem(cartStorageKey, JSON.stringify(cart));
      } catch {
        // quota — ignore
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [cart, cartStorageKey]);

  const handleRefresh = () => {
    setLoading(true);
    fetchData();
  };

  const refetchActiveOrdersOnly = useCallback(async () => {
    if (!resolvedMerchantId || !tableId) return;
    const paddedTableId = tableId.padStart(2, '0');
    setOrdersRefreshing(true);
    try {
      const res = await api.get(`orders/active/${resolvedMerchantId}/${paddedTableId}`);
      setExistingOrders(res.data?.orders ?? []);
    } catch {
      /* giữ danh sách cũ */
    } finally {
      setOrdersRefreshing(false);
    }
  }, [resolvedMerchantId, tableId]);

  useEffect(() => {
    if (!resolvedMerchantId || !tableId) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void refetchActiveOrdersOnly();
    }, 22000);
    return () => window.clearInterval(id);
  }, [resolvedMerchantId, tableId, refetchActiveOrdersOnly]);

  const allProducts = useMemo(
    () =>
      (categories ?? []).flatMap((c) =>
        (c.products ?? []).map((p) => ({
          ...p,
          categoryId: p.categoryId ?? c.id,
        })),
      ),
    [categories],
  );

  const saleProducts = useMemo(() => {
    const active = allProducts.filter((p) => p.saleActive);
    return [...active].sort((a, b) => {
      if (Boolean(b.salePinned) !== Boolean(a.salePinned)) {
        return Number(Boolean(b.salePinned)) - Number(Boolean(a.salePinned));
      }
      const save = (x: Product) => {
        const list = parseVndDigits(x.price);
        const sp = typeof x.salePrice === 'number' ? x.salePrice : list;
        return Math.max(0, list - sp);
      };
      return save(b) - save(a);
    });
  }, [allProducts]);

  const saleProductIdSet = useMemo(
    () => new Set(saleProducts.map((p) => p.id)),
    [saleProducts],
  );

  const loyaltyNudgeCategoryId = useMemo(() => {
    const c = categories.find((cat) => isDrinksLikeCategoryName(cat.name));
    return c?.id ?? null;
  }, [categories]);

  /** Gợi ý: món đang sale (ghim + mức giảm) trước, sau đó ghép thêm món khác — một hàng kéo ngang. */
  const suggestedProducts = useMemo(() => {
    const MAX = 8;
    const ids = new Set<number>();
    const out: Product[] = [];
    for (const p of saleProducts) {
      if (out.length >= MAX) break;
      ids.add(p.id);
      out.push(p);
    }
    for (const p of allProducts) {
      if (out.length >= MAX) break;
      if (ids.has(p.id)) continue;
      ids.add(p.id);
      out.push(p);
    }
    return out;
  }, [allProducts, saleProducts]);

  const addToCartWithDetails = (product: Product, quantity: number, options: any) => {
    if (!sessionId) {
      toast.error('Vui lòng quét mã QR tại bàn để thêm món vào giỏ hàng.');
      return;
    }
    setCart(prev => {
      const existingIndex = prev.findIndex(item =>
        item.product.id === product.id &&
        JSON.stringify(item.options) === JSON.stringify(options)
      );
      if (existingIndex > -1) {
        const newCart = [...prev];
        newCart[existingIndex].quantity += quantity;
        return newCart;
      }
      return [...prev, { product, quantity, options }];
    });
    setSelectedProduct(null);
  };

  const updateCartQuantity = (productId: number, options: any, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId && JSON.stringify(item.options) === JSON.stringify(options)) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeCartItem = (productId: number, options: any) => {
    setCart(prev => prev.filter(item =>
      !(item.product.id === productId && JSON.stringify(item.options) === JSON.stringify(options))
    ));
  };

  const scrollToCategory = (id: number) => {
    setActiveCategory(id);
    categoryRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const basePrice = getProductUnitBase(item.product);

      let optionsJson: any = { sizes: [], toppings: [], sugarLevels: [] };
      try {
        const raw = item.product.options;
        if (raw && typeof raw === 'string') optionsJson = JSON.parse(raw);
        else if (raw && typeof raw === 'object') optionsJson = raw;
      } catch (e) { console.error('Parse options error', e); }

      const sizeOption = optionsJson.sizes?.find((s: any) => s.label === item.options?.size);
      const sizeExtra = sizeOption ? (Number(sizeOption.extraPrice) || 0) : 0;

      const toppingsExtra = (item.options?.toppings ?? []).reduce((tSum: number, tName: string) => {
        const toppingDetails = optionsJson.toppings?.find((td: any) => td.name === tName);
        return tSum + (toppingDetails ? (Number(toppingDetails.price) || 0) : 0);
      }, 0);

      return sum + (basePrice + sizeExtra + toppingsExtra) * (Number(item.quantity) || 0);
    }, 0);
  };

  const currentTotal = calculateTotal();
  const cartItemCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const cartSaleSavings = useMemo(
    () =>
      cart.reduce((sum, item) => {
        if (!item.product.saleActive) return sum;
        const listUnit = parseVndDigits(item.product.price);
        const saleUnit = getProductUnitBase(item.product);
        const delta = Math.max(0, listUnit - saleUnit);
        return sum + delta * (Number(item.quantity) || 0);
      }, 0),
    [cart],
  );
  const servedTotal = kitchenOrders.reduce((s, o) => s + (Number(o.totalPrice || o.total_price) || 0), 0);
  const grandTotal = currentTotal + servedTotal;

  const submitOrder = async (note: string, customerName: string, customerPhone: string) => {
    if (!resolvedMerchantId || !tableId) return;
    const paddedTableId = tableId.padStart(2, '0');
    setSubmitting(true);
    try {
      const basePayload = {
        merchantId: resolvedMerchantId,
        tableNumber: paddedTableId,
        sessionId,
        customerName,
        customerPhone,
        items: cart.map(item => {
          const basePrice = getProductUnitBase(item.product);
          let optionsJson: any = { sizes: [], toppings: [] };
          try {
            const raw = item.product.options;
            if (raw && typeof raw === 'string') optionsJson = JSON.parse(raw);
            else if (raw && typeof raw === 'object') optionsJson = raw;
          } catch {
            /* ignore options parse error */
          }

          const sizeOption = optionsJson.sizes?.find((s: any) => s.label === item.options?.size);
          const sizeExtra = sizeOption ? +sizeOption.extraPrice : 0;

          const toppingsExtra = (item.options?.toppings ?? []).reduce((tSum: number, tName: string) => {
            const toppingDetails = optionsJson.toppings?.find((td: any) => td.name === tName);
            return tSum + (toppingDetails ? +toppingDetails.price : 0);
          }, 0);

          const finalPrice = basePrice + sizeExtra + toppingsExtra;

          return {
            productId: item.product.id,
            quantity: item.quantity,
            price: finalPrice.toString(),
            note: `Size ${item.options?.size ?? 'M'}, ${item.options?.sugar ?? '100'}% đường${(item.options?.toppings ?? []).length ? ', ' + (item.options?.toppings ?? []).join(', ') : ''}`
          };
        }),
        note,
        notes: note,
        totalPrice: currentTotal.toString(),
      };
      const payload = await withOrderGeo(orderGuard, basePayload);
      await api.post('orders', payload);

      const res = await api.get(`orders/active/${resolvedMerchantId}/${paddedTableId}`);
      setExistingOrders(res.data?.orders ?? []);
      setToastMessage({
        title: 'Đã gọi món!',
        sub: 'Nhân viên sẽ phục vụ bạn sớm.',
      });
      setOrderSuccess(true);
      setCart([]);
    } catch (error: unknown) {
      console.error('Error submitting order:', error);
      const msg = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message
        : error instanceof Error
          ? error.message
          : 'Không thể gửi đơn.';
      toast.error(typeof msg === 'string' ? msg : 'Không thể gửi đơn.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCallPayment = async () => {
    if (!resolvedMerchantId || !tableId) return;
    const paddedTableId = tableId.padStart(2, '0');
    try {
      const basePayload = {
        merchantId: resolvedMerchantId,
        tableNumber: paddedTableId,
        sessionId,
        type: 'call_payment',
        totalPrice: '0',
      };
      const payload = await withOrderGeo(orderGuard, basePayload);
      await api.post('orders', payload);
      setToastMessage({ title: 'Đã gửi yêu cầu thanh toán', sub: 'Vui lòng chờ nhân viên trong giây lát.' });
      setOrderSuccess(true);
      setShowCart(false);
    } catch (error: unknown) {
      console.error('Error calling for payment:', error);
      const msg = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message
        : error instanceof Error
          ? error.message
          : 'Không thể gửi yêu cầu.';
      toast.error(typeof msg === 'string' ? msg : 'Không thể gửi yêu cầu.');
    }
  };

  const SuccessToast = () => (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2.5rem)] max-w-xs animate-in slide-in-from-top-4 duration-500">
      <div className="bg-primary text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3">
        <div className="w-8 h-8 bg-[#fff7ed]/60 rounded-full flex items-center justify-center">
          <Send size={16} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-black">{toastMessage.title}</p>
          <p className="text-[10px] opacity-80">{toastMessage.sub}</p>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (orderSuccess) {
      const timer = setTimeout(() => setOrderSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [orderSuccess]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto bg-[#fff7ed] min-h-screen overflow-x-hidden pb-8">
        <header className="sticky top-0 z-40 bg-[#fff7ed]/95 backdrop-blur-md border-b border-[#fed7aa] px-4 py-3 flex items-center justify-between">
          <div className="h-10 w-32 rounded-full bg-[#ffedd5]/70 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-9 w-9 rounded-full bg-[#ffedd5]/70 animate-pulse" />
            <div className="h-9 w-9 rounded-full bg-[#ffedd5]/70 animate-pulse" />
            <div className="h-9 w-9 rounded-full bg-[#ffedd5]/70 animate-pulse" />
          </div>
        </header>
        <div className="px-4 pt-4 space-y-3">
          <div className="h-32 rounded-3xl bg-[#ffedd5]/60 animate-pulse" />
          <div className="h-16 rounded-2xl bg-[#ffedd5]/50 animate-pulse" />
        </div>
        <div className="px-4 pt-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4 p-4 rounded-[2rem] bg-[#fff7ed] border border-[#fed7aa]/60 shadow-sm">
              <div className="flex-1 space-y-2.5 py-1">
                <div className="h-4 bg-[#ffedd5]/90 rounded-md animate-pulse w-4/5" />
                <div className="h-3 bg-[#ffedd5]/70 rounded-md animate-pulse w-full" />
                <div className="h-3 bg-[#ffedd5]/70 rounded-md animate-pulse w-1/3" />
              </div>
              <div className="w-24 h-24 rounded-xl bg-[#ffedd5]/80 animate-pulse shrink-0" />
            </div>
          ))}
        </div>
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-stone-400 mt-8 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Đang tải thực đơn...
        </p>
      </div>
    );
  }

  const filteredProducts = searchQuery
    ? allProducts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;
  const hasSentToKitchen = kitchenOrders.some((o) =>
    ['pending', 'confirmed'].includes(String(o.status || '').toLowerCase()),
  );
  const hasPreparing = kitchenOrders.some(
    (o) => String(o.status || '').toLowerCase() === 'preparing',
  );
  const hasServed = kitchenOrders.some((o) =>
    ['ready', 'completed'].includes(String(o.status || '').toLowerCase()),
  );

  return (
    <div className="max-w-lg mx-auto bg-[#fff7ed] min-h-screen relative overflow-x-hidden text-on-surface notranslate" translate="no">
      <WifiWelcomeModal
        wifiSsid={merchantInfo?.wifiSsid ?? merchantInfo?.wifi_ssid}
        wifiPassword={merchantInfo?.wifiPassword ?? merchantInfo?.wifi_password}
      />
      {orderSuccess && <SuccessToast />}

      {/* ─── STICKY HEADER ─── */}
      <header className="bg-[#fff7ed]/95 backdrop-blur-md sticky top-0 z-40 px-4 py-3 flex items-center justify-between gap-3 border-b border-[#fed7aa]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/order/${resolvedMerchantId}/${tableId}`)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#ffedd5]/35 text-stone-700 active:scale-90 transition-all mr-1 border border-[#fed7aa]/60"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-[#ffedd5]/30 flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#fed7aa]/60 shadow-sm transition-transform active:scale-95">
            {merchantInfo?.logoUrl ? (
              <img src={merchantInfo.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <img
                src="https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=60&q=80"
                alt="Logo"
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-on-surface tracking-tight leading-tight truncate">
              {merchantInfo?.name || 'Lagi Menu'}
            </h1>
            <p className="text-[11px] text-primary font-bold mt-0.5">
              {tableDisplayName ?? `Bàn ${tableId}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search toggle */}
          <button
            onClick={handleRefresh}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#ffedd5]/30 text-stone-700 hover:bg-[#ffedd5]/50 active:scale-90 transition-all border border-[#fed7aa]/60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => setShowSearch(v => !v)}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90 ${showSearch ? 'bg-primary text-white' : 'bg-[#ffedd5]/30 text-stone-700 hover:bg-[#ffedd5]/50'
              }`}
          >
            <Search size={18} />
          </button>

          <button
            type="button"
            title="Điểm thưởng & đổi quà"
            onClick={() => {
              setCustomerLoyaltyPanelKey((k) => k + 1);
              setShowCustomerLoyaltyModal(true);
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-amber-400/35 text-amber-950 hover:bg-amber-400/55 active:scale-90 transition-all border border-amber-500/40"
          >
            <Gift size={18} />
          </button>

          {/* Theme Switcher Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowThemePicker(v => !v)}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90 ${
                showThemePicker ? 'bg-primary text-white' : 'bg-surface-container-low text-stone-700 hover:bg-surface-container-high border border-outline-variant/60'
              }`}
              title="Đổi màu giao diện"
            >
              <Paintbrush size={16} className={showThemePicker ? "text-white" : "text-primary"} />
            </button>
            {showThemePicker && (
              <div className="absolute right-0 top-11 z-[350] flex flex-col gap-2 bg-surface p-2 rounded-2xl shadow-xl border border-outline-variant/60 animate-in zoom-in-95 duration-150">
                {['orange', 'blue', 'pink', 'green', 'red'].map((t) => {
                  const colorMap: Record<string, string> = {
                    orange: 'bg-orange-500',
                    blue: 'bg-blue-600',
                    pink: 'bg-pink-500',
                    green: 'bg-green-600',
                    red: 'bg-red-600',
                  };
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        setTheme(t);
                        setShowThemePicker(false);
                      }}
                      className={`w-6 h-6 rounded-full ${colorMap[t]} border-2 transition-all ${
                        theme === t ? 'border-white ring-2 ring-primary scale-110' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-105'
                      }`}
                      title={`Theme ${t}`}
                      type="button"
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart icon */}
          <button
            className="relative w-9 h-9 flex items-center justify-center rounded-full bg-[#ffedd5]/30 text-primary hover:bg-[#ffedd5]/50 active:scale-90 transition-all border border-[#fed7aa]/60"
            onClick={() => (cartItemCount > 0 || kitchenOrders.length > 0) && setShowCart(true)}
          >
            <ShoppingCart size={18} />
            {(cartItemCount > 0 || kitchenOrders.length > 0) && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-black min-w-[17px] h-[17px] flex items-center justify-center rounded-full shadow-sm border border-white">
                {cartItemCount > 0 ? cartItemCount : kitchenOrders.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ─── SEARCH BAR (toggle) ─── */}
      {showSearch && (
        <div className="px-4 py-3 bg-[#fff7ed]/95 backdrop-blur-sm border-b border-[#fed7aa] animate-in slide-in-from-top-2 duration-300">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              autoFocus
              type="text"
              placeholder="Tìm món ăn hoặc trà sữa..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#ffedd5]/55 rounded-full text-sm placeholder:text-stone-400 focus:ring-1 focus:ring-primary/20 outline-none transition-all border border-transparent focus:border-primary/20"
            />
          </div>
        </div>
      )}

      {sessionError && (
        <div className="mx-4 mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <X size={16} className="text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-red-900 leading-snug">Chế độ xem menu</p>
            <p className="text-[10px] font-medium text-red-700/70 mt-0.5 leading-relaxed">
              Bạn đang ở chế độ xem. Vui lòng quét mã QR tại bàn để có thể chọn món và gửi đơn.
            </p>
          </div>
        </div>
      )}
      {!sessionError && (hasSentToKitchen || hasPreparing || hasServed) && (
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-2">
          {hasSentToKitchen && (
            <span className="rounded-full bg-[#ffedd5]/50 border border-[#fed7aa]/70 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#9a3412]">
              Đã gửi bếp
            </span>
          )}
          {hasPreparing && (
            <span className="rounded-full bg-[#ffedd5]/50 border border-[#fed7aa]/70 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#9a3412]">
              Đang làm
            </span>
          )}
          {hasServed && (
            <span className="rounded-full bg-[#ffedd5]/50 border border-[#fed7aa]/70 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#9a3412]">
              Đã ra món
            </span>
          )}
        </div>
      )}
      {networkWeak && (
        <div className="mx-4 mt-3 p-3 bg-[#ffedd5]/50 border border-[#fed7aa]/70 rounded-2xl">
          <p className="text-[11px] font-bold text-[#9a3412]">
            Mạng yếu. Bạn có thể bấm Làm mới để thử lại.
          </p>
        </div>
      )}

      <CustomerOrderTracker
        orders={kitchenOrders}
        loading={ordersRefreshing}
        onManualRefresh={refetchActiveOrdersOnly}
      />

      <main className="pb-36 bg-[#fff7ed] overflow-x-hidden">
        {/* ─── SHOP BANNER & INFO ─── */}
        {!filteredProducts && (
          <div className="px-4 pt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-700">
            {merchantInfo?.bannerUrl && (
              <div className="w-full h-32 rounded-3xl overflow-hidden shadow-premium-sm border border-[#fed7aa]/60">
                <img src={merchantInfo.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
              </div>
            )}

            {(merchantInfo?.address || merchantInfo?.phone) && (
              <div className="bg-[#fff7ed]/70 rounded-2xl p-3 px-4 border border-[#fed7aa]/80 flex flex-col gap-2 shadow-sm">
                {merchantInfo.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPin size={13} className="text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] font-bold text-stone-500 leading-tight">{merchantInfo.address}</p>
                  </div>
                )}
                {merchantInfo.phone && (
                  <div className="flex items-center gap-2.5">
                    <Phone size={11} className="text-primary flex-shrink-0" />
                    <p className="text-[10px] font-black text-stone-500">{merchantInfo.phone}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── SEARCH RESULTS ─── */}
        {filteredProducts && (
          <div className="px-4 pt-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
              {filteredProducts.length} kết quả cho "{searchQuery}"
            </p>
            <div className="space-y-4">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  className="w-full flex gap-4 items-center bg-[#fff7ed] rounded-3xl p-3 active:bg-[#ffedd5]/60 transition-all text-left border border-[#fed7aa]/70 shadow-sm"
                  onClick={() => setSelectedProduct(product)}
                >
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 border border-[#fed7aa]/60 shadow-sm bg-[#ffedd5]/30 flex items-center justify-center">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Plus size={20} className="text-stone-200" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-on-surface text-sm truncate">{product.name}</p>
                    <p className="text-primary font-black text-sm mt-0.5">
                      {product.saleActive ? (
                        <>
                          <span>{Intl.NumberFormat('vi-VN').format(getProductUnitBase(product))}đ</span>
                          <span className="text-stone-400 line-through text-xs font-bold ml-1">
                            {Intl.NumberFormat('vi-VN').format(parseVndDigits(product.price))}đ
                          </span>
                        </>
                      ) : (
                        <>{Math.floor(parseVndDigits(product.price) / 1000)}k</>
                      )}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Plus size={16} className="text-white" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── GỢI Ý (ưu tiên món sale + món khác) ─── */}
        {!filteredProducts && suggestedProducts.length > 0 && (
          <section className="pt-4 overflow-hidden bg-transparent">
            <div className="px-4 mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-on-surface leading-none tracking-tight">Gợi ý cho bạn</h2>
                {saleProducts.length > 0 && (
                  <p className="text-[10px] font-bold text-stone-500 mt-1.5 leading-snug">
                    Đang có {saleProducts.length} món sale — kéo ngang để xem thêm
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {saleProducts.length > 0 && (
                  <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                    Sale
                  </span>
                )}
                <span className="flex items-center gap-0.5 text-[9px] font-bold text-stone-400 uppercase tracking-tighter">
                  <ChevronLeft size={12} className="opacity-50" aria-hidden />
                  Vuốt
                  <ChevronRight size={12} className="opacity-50" aria-hidden />
                </span>
              </div>
            </div>

            <div
              className="relative flex gap-3 overflow-x-auto no-scrollbar px-4 pb-2 snap-x scroll-pl-4"
              role="region"
              aria-label="Gợi ý món, vuốt ngang để xem"
            >
              <div
                className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 z-10 bg-gradient-to-l from-[#fff7ed] to-transparent"
                aria-hidden
              />
              {suggestedProducts.map((product) => (
                <button
                  key={`featured-${product.id}`}
                  onClick={() => setSelectedProduct(product)}
                  className={`relative flex-shrink-0 w-32 h-40 rounded-2xl overflow-hidden snap-start shadow-sm group ${
                    product.saleActive
                      ? 'border-2 border-red-200/90'
                      : 'border border-[#fed7aa]/90'
                  }`}
                >
                  {product.imageUrl ? (
                    <>
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div
                        className={`absolute inset-0 bg-gradient-to-t to-transparent ${
                          product.saleActive ? 'from-black/85 via-black/25' : 'from-black/80 via-black/20'
                        }`}
                      />
                      {product.saleActive && product.salePinned && (
                        <div className="absolute top-2 left-2 rounded-full bg-amber-400 text-[9px] font-black px-1.5 py-0.5 text-amber-950 shadow">
                          Ghim
                        </div>
                      )}
                      {product.saleActive && product.discountLabel && (
                        <div className="absolute top-2 right-2 rounded-full bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 shadow">
                          {product.discountLabel}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 text-left">
                        <h3 className="text-white font-bold text-[10px] leading-tight mb-0.5 line-clamp-2">{product.name}</h3>
                        <p className="text-orange-100 font-black text-[11px]">
                          {Intl.NumberFormat('vi-VN').format(getProductUnitBase(product))}đ
                        </p>
                        {product.saleActive && (
                          <p className="text-white/65 line-through text-[9px] font-bold">
                            {Intl.NumberFormat('vi-VN').format(parseVndDigits(product.price))}đ
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div
                      className={`absolute inset-0 flex flex-col justify-end p-2.5 text-left ${
                        product.saleActive
                          ? 'bg-gradient-to-b from-red-50 to-orange-100'
                          : 'bg-gradient-to-b from-[#ffedd5] to-[#fdba74]/50'
                      }`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Plus size={32} className="text-stone-400 opacity-30" />
                      </div>
                      {product.saleActive && product.discountLabel && (
                        <span className="relative z-10 mb-1 self-start rounded-full bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5">
                          {product.discountLabel}
                        </span>
                      )}
                      <h3 className="relative z-10 text-stone-900 font-bold text-[10px] leading-tight mb-0.5 line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="relative z-10 text-[#c2410c] font-black text-[11px]">
                        {Intl.NumberFormat('vi-VN').format(getProductUnitBase(product))}đ
                      </p>
                      {product.saleActive && (
                        <p className="relative z-10 text-stone-500 line-through text-[9px] font-bold">
                          {Intl.NumberFormat('vi-VN').format(parseVndDigits(product.price))}đ
                        </p>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ─── CATEGORY NAVIGATION ─── */}
        {!filteredProducts && (
          <div className="sticky top-[61px] z-30 bg-[#fff7ed]/95 backdrop-blur-sm px-4 pt-3 pb-2 select-none overflow-hidden border-b border-[#fed7aa] shadow-sm">
            <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x">
              {categories.map(category => (
                <button
                  key={`nav-${category.id}`}
                  onClick={() => scrollToCategory(category.id)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 snap-start active:scale-95 border ${activeCategory === category.id
                    ? 'bg-primary text-white border-primary shadow-sm'
                    : 'bg-[#ffedd5]/30 text-stone-600 border-[#fed7aa]/60 hover:bg-[#ffedd5]/50'
                    }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── MENU SECTIONS ─── */}
        {!filteredProducts && (
          <div className="px-4 pt-4 space-y-8">
            {categories.map(category => (
              <section
                key={category.id}
                ref={el => { categoryRefs.current[category.id] = el; }}
                className="scroll-mt-32"
              >
                {/* Section header */}
                <h3 className="text-lg font-black text-on-surface mb-4 px-1">{category.name}</h3>
                {sessionId &&
                  !sessionError &&
                  loyaltyNudgeCategoryId != null &&
                  loyaltyNudgeCategoryId === category.id && (
                    <LoyaltyDrinksNudge
                      merchantId={resolvedMerchantId}
                      tablePadded={(tableId ?? '1').padStart(2, '0')}
                      sessionId={sessionId}
                    />
                  )}

                {/* Product list - 1 COLUMN LIST VIEW (Grab style) */}
                <div className="space-y-4">
                  {(category.products ?? [])
                    .filter((product) => !saleProductIdSet.has(product.id))
                    .map(product => (
                    <div
                      key={product.id}
                  className="group relative flex gap-4 bg-[#fff7ed] hover:bg-[#ffedd5]/35 active:bg-[#ffedd5]/55 transition-all duration-200 cursor-pointer p-4 rounded-[2rem]  shadow-sm border border-[#fed7aa]/50"
                      onClick={() => setSelectedProduct(product)}
                    >
                      {/* Info on left */}
                      <div className="flex-1 flex flex-col justify-center min-w-0 py-1">
                        <h4 className="font-bold text-on-surface text-[15px] leading-snug group-hover:text-primary transition-colors mb-1">
                          {product.name}
                        </h4>
                        <p className="text-[11px] text-stone-400 line-clamp-2 mb-2 leading-relaxed">
                          {product.description || 'Hương vị thơm ngon hấp dẫn từ Lagi Menu.'}
                        </p>
                        <div className="flex items-center justify-between mt-auto gap-2 flex-wrap">
                          {product.saleActive ? (
                            <div className="flex flex-col items-start">
                              <p className="font-black text-primary text-sm">
                                {Intl.NumberFormat('vi-VN').format(getProductUnitBase(product))}đ
                              </p>
                              <p className="text-[11px] text-stone-400 line-through font-bold">
                                {Intl.NumberFormat('vi-VN').format(parseVndDigits(product.price))}đ
                              </p>
                              {product.discountLabel && (
                                <span className="mt-0.5 text-[9px] font-black uppercase text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-100">
                                  {product.discountLabel}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="font-black text-on-surface text-sm">
                              {Intl.NumberFormat('vi-VN').format(parseVndDigits(product.price))}đ
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Thumbnail on right */}
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-[#ffedd5]/25 border border-[#fed7aa]/60 shadow-sm self-start">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover transition-all duration-500"
                          />
                        ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#ffedd5]/25">
                            <Plus size={24} className="text-stone-200" />
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-primary text-white shadow-md flex items-center justify-center active:scale-90 transition-all border border-white">
                          <Plus size={16} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* ─── FLOATING CART BAR (always visible, iOS safe-area) ─── */}
      {!showCart && (
        <div className="fixed bottom-0 left-0 right-0 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] z-50 animate-in fade-in slide-in-from-bottom-5 duration-500">
          <button
            onClick={() => setShowCart(true)}
            className="w-full max-w-sm mx-auto min-h-[56px] py-2.5 rounded-full shadow-lg flex items-center justify-between px-5 gap-3 active:scale-[0.98] transition-all border border-[#fdba74] bg-[#ffedd5] text-stone-900"
          >
            <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1 text-left">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-6 h-6 bg-[#ea580c] rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0">
                  {cartItemCount > 0 ? cartItemCount : kitchenOrders.length > 0 ? kitchenOrders.length : 0}
                </span>
                <span className="font-black text-sm truncate text-stone-800">
                  {cartItemCount > 0
                    ? 'Giỏ hàng của bạn'
                    : kitchenOrders.length > 0
                      ? 'Xem đơn đã đặt'
                      : 'Giỏ hàng trống'}
                </span>
              </div>
              {kitchenOrders.length > 0 && (
                <span className="text-[10px] font-bold text-stone-600 pl-9 leading-tight">
                  {kitchenOrders.length} đơn đang xử lý · chi tiết khi mở giỏ
                </span>
              )}
              {cartItemCount > 0 && cartSaleSavings > 0 && (
                <span className="text-[10px] font-black text-emerald-700 pl-9 leading-tight">
                  Tiết kiệm ~{Intl.NumberFormat('vi-VN').format(cartSaleSavings)}đ từ khuyến mãi (giá gốc món)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex flex-col items-end gap-0.5">
                <span className="font-black text-sm tabular-nums text-[#9a3412]">
                  {Intl.NumberFormat('vi-VN').format(Number(grandTotal) || 0)}đ
                </span>
                <span className="text-[9px] font-semibold text-stone-600">
                  giỏ + đã đặt
                </span>
              </div>
              <ChevronRight size={18} className="text-stone-500 shrink-0" />
            </div>
          </button>
        </div>
      )}

      {/* ─── OVERLAYS ─── */}
      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          sessionId={sessionId}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCartWithDetails}
        />
      )}

      {showCart && (
        <CartModal
          items={cart}
          existingOrders={kitchenOrders}
          onUpdateQuantity={updateCartQuantity}
          onRemoveItem={removeCartItem}
          onClose={() => setShowCart(false)}
          onSubmit={submitOrder}
          onCallPayment={handleCallPayment}
          submitting={submitting}
          sessionId={sessionId}
          merchantId={resolvedMerchantId}
        />
      )}

      <CustomerLoyaltyLookupModal
        open={showCustomerLoyaltyModal}
        onClose={() => setShowCustomerLoyaltyModal(false)}
        merchantId={resolvedMerchantId}
        panelKey={customerLoyaltyPanelKey}
        tableNumberHint={tableId ?? null}
        sessionId={sessionId}
      />
    </div>
  );
};
