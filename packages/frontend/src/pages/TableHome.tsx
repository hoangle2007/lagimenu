import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed,
  Star,
  ChevronRight,
  Loader2,
  Heart,
  Sparkles,
  PhoneCall,
  MapPin,
  Phone,
  X,
  MousePointer2,
  Coins,
  QrCode,
  Store,
  CreditCard,
  Gift,
  Wallet,
} from 'lucide-react';
import api from '../lib/api';
import axios from 'axios';
import toast from 'react-hot-toast';
import { fetchOrderGuard, withOrderGeo, type OrderGuardConfig } from '../lib/customerOrderGeo';
import { ReviewModal } from '../components/ReviewModal';
import { WifiWelcomeModal } from '../components/WifiWelcomeModal';
import { withRetry } from '../lib/withRetry';
import { buildVietQrUrl, type PaymentInfo } from '../lib/vietqr';
import { CustomerLoyaltyLookupPanel } from '../components/CustomerLoyaltyLookupPanel';

interface Product {
  id: number;
  name: string;
  price: string;
  description?: string;
  imageUrl?: string;
  isFeatured?: boolean;
  isNew?: boolean;
}

export const TableHome: React.FC = () => {
  const { merchantId, shopId, tableId } = useParams<{
    merchantId?: string;
    shopId?: string;
    tableId: string;
  }>();
  const resolvedMerchantId = merchantId ?? shopId ?? '';
  const navigate = useNavigate();
  const [, setLoading] = useState(true);
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('user-theme') || 'orange');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('user-theme', theme);
  }, [theme]);

  const [merchantInfo, setMerchantInfo] = useState<any>(null);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [callingStaff, setCallingStaff] = useState(false);
  const [callSuccess, setCallSuccess] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [orderGuard, setOrderGuard] = useState<OrderGuardConfig>({ requireLocation: false });
  const [tableDisplayName, setTableDisplayName] = useState<string | null>(null);
  const [networkWeak, setNetworkWeak] = useState(false);
  const cooldownKey = `call_staff_cooldown_${resolvedMerchantId}_${tableId ?? ''}`;
  const loyaltyCooldownKey = `loyalty_pay_cooldown_${resolvedMerchantId}_${tableId ?? ''}`;
  const paymentCooldownKey = `call_payment_cooldown_${resolvedMerchantId}_${tableId ?? ''}`;
  const [loyaltyCooldownLeft, setLoyaltyCooldownLeft] = useState(0);
  const [paymentCooldownLeft, setPaymentCooldownLeft] = useState(0);
  const [callingPayment, setCallingPayment] = useState(false);
  const [showBillQrModal, setShowBillQrModal] = useState(false);
  const [billQrUrl, setBillQrUrl] = useState<string | null>(null);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [loyaltySubmitting, setLoyaltySubmitting] = useState(false);
  const [loyaltyLookupPanelKey, setLoyaltyLookupPanelKey] = useState(0);
  const [loyaltyProgramBrief, setLoyaltyProgramBrief] = useState<{
    rewardCount: number;
    hasActiveRewards: boolean;
    earnRuleLabel: string;
  } | null>(null);
  const [loyaltyProgramLoading, setLoyaltyProgramLoading] = useState(true);
  const [activeOrdersTotal, setActiveOrdersTotal] = useState<number | null>(null);

  useEffect(() => {
    const until = Number(sessionStorage.getItem(cooldownKey) || 0);
    const now = Date.now();
    if (until > now) {
      setCooldownLeft(Math.ceil((until - now) / 1000));
    }
  }, [cooldownKey]);

  useEffect(() => {
    const until = Number(sessionStorage.getItem(loyaltyCooldownKey) || 0);
    const now = Date.now();
    if (until > now) {
      setLoyaltyCooldownLeft(Math.ceil((until - now) / 1000));
    }
  }, [loyaltyCooldownKey]);

  useEffect(() => {
    const until = Number(sessionStorage.getItem(paymentCooldownKey) || 0);
    const now = Date.now();
    if (until > now) {
      setPaymentCooldownLeft(Math.ceil((until - now) / 1000));
    }
  }, [paymentCooldownKey]);

  useEffect(() => {
    if (!resolvedMerchantId) {
      setLoyaltyProgramLoading(false);
      return;
    }
    let cancelled = false;
    setLoyaltyProgramLoading(true);
    void (async () => {
      try {
        const mid = encodeURIComponent(resolvedMerchantId);
        const { data } = await api.get<{
          rewardCount?: number;
          hasActiveRewards?: boolean;
          earnRuleLabel?: string;
        }>(`/public/loyalty/${mid}/program`);
        if (cancelled) return;
        setLoyaltyProgramBrief({
          rewardCount: Math.max(0, Number(data?.rewardCount ?? 0)),
          hasActiveRewards: Boolean(data?.hasActiveRewards),
          earnRuleLabel: typeof data?.earnRuleLabel === 'string' ? data.earnRuleLabel : '',
        });
      } catch {
        if (!cancelled) {
          setLoyaltyProgramBrief({
            rewardCount: 0,
            hasActiveRewards: false,
            earnRuleLabel: '',
          });
        }
      } finally {
        if (!cancelled) setLoyaltyProgramLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedMerchantId]);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setInterval(() => {
      setCooldownLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  useEffect(() => {
    if (loyaltyCooldownLeft <= 0) return;
    const id = setInterval(() => {
      setLoyaltyCooldownLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [loyaltyCooldownLeft]);

  useEffect(() => {
    if (paymentCooldownLeft <= 0) return;
    const id = setInterval(() => {
      setPaymentCooldownLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [paymentCooldownLeft]);

  useEffect(() => {
    if (!showLoyaltyModal && !showBillQrModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showLoyaltyModal, showBillQrModal]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const queryParams = new URLSearchParams(window.location.search);
        const token = queryParams.get('token');
        const paddedTableId = tableId?.padStart(2, '0');

        const [menuRes, guardCfg, tableRes, activeOrdersRes] = await Promise.all([
          withRetry(() => api.get(`/public/menu/${resolvedMerchantId}`), 1, 350),
          withRetry(() => fetchOrderGuard(api, resolvedMerchantId), 1, 350),
          withRetry(
            () =>
              api
                .get(`/public/table/${resolvedMerchantId}/${paddedTableId}`)
                .catch(() => ({ data: null })),
            1,
            350,
          ),
          withRetry(
            () =>
              api
                .get(`/orders/active/${resolvedMerchantId}/${paddedTableId}`)
                .catch(() => ({ data: { orders: [] } })),
            1,
            350,
          ),
        ]);
        setNetworkWeak(false);
        setOrderGuard(guardCfg);
        setTableDisplayName(
          (tableRes as { data?: { displayName?: string } })?.data?.displayName ??
            `Bàn ${parseInt(paddedTableId || '0', 10) || tableId}`,
        );

        try {
          const activeOrders = activeOrdersRes.data?.orders || [];
          const total = activeOrders.reduce((sum: number, o: any) => sum + parseFloat(o.totalPrice || o.total_price || 0), 0);
          setActiveOrdersTotal(total);
        } catch (e) {
          console.warn('Failed to calculate active orders total:', e);
          setActiveOrdersTotal(0);
        }
        
        const m = menuRes.data.merchant;
        setMerchantInfo({
          ...m,
          logoUrl: m?.logoUrl || m?.logo_url,
          bannerUrl: m?.bannerUrl || m?.banner_url,
          openTime: m?.openTime || m?.open_time,
          closeTime: m?.closeTime || m?.close_time,
          wifiSsid: m?.wifiSsid ?? m?.wifi_ssid,
          wifiPassword: m?.wifiPassword ?? m?.wifi_password,
        });

        try {
          // New QR scan = ignore old paid sessionId, get a fresh session.
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
            setSessionError(sessionRes.data.message);
            setSessionId(null);
            localStorage.removeItem(`session_${resolvedMerchantId}_${paddedTableId}`);
          } else {
            setSessionId(sessionRes.data.id);
            localStorage.setItem(`session_${resolvedMerchantId}_${paddedTableId}`, sessionRes.data.id);
            setSessionError(null);
          }

          if (token) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch (sErr: any) {
          if (sErr.response?.status === 403) {
            setSessionError(sErr.response.data.message);
            setSessionId(null);
          }
        }

        const allProducts: Product[] = menuRes.data.categories.flatMap((c: any) => c.products);
        const featured = allProducts.filter(p => p.isFeatured || p.isNew);
        setFeaturedProducts(featured.length > 0 ? featured : allProducts.slice(0, 6));
      } catch (error: any) {
        console.error('Error fetching table home data:', error);
        setNetworkWeak(true);
        toast.error('Mạng yếu, vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };

    if (resolvedMerchantId && tableId) fetchData();
  }, [resolvedMerchantId, tableId]);

  const handleCallStaff = async () => {
    if (!sessionId) {
      alert('Vui lòng quét mã QR tại bàn để gọi nhân viên.');
      return;
    }
    if (callingStaff || cooldownLeft > 0) return;
    setCallingStaff(true);
    try {
      const basePayload = {
        merchantId: resolvedMerchantId,
        tableNumber: tableId?.padStart(2, '0'),
        sessionId: sessionId ?? undefined,
        type: 'call_staff',
        totalPrice: '0',
        items: [{ productId: 'placeholder', quantity: 1, price: 0, notes: 'Staff call request' }],
      };
      const payload = await withOrderGeo(orderGuard, basePayload);
      await api.post('/orders', payload);
      toast.success('Đã gọi, vui lòng chờ nhân viên.');
      setCallSuccess(true);
      const cooldownSeconds = 15;
      const until = Date.now() + cooldownSeconds * 1000;
      sessionStorage.setItem(cooldownKey, String(until));
      setCooldownLeft(cooldownSeconds);
      setTimeout(() => setCallSuccess(false), 3000);
    } catch (error: unknown) {
      console.error('Error calling staff:', error);
      const msg = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message
        : error instanceof Error
          ? error.message
          : 'Không thể gọi nhân viên.';
      toast.error(typeof msg === 'string' ? msg : 'Không thể gọi nhân viên.');
    } finally {
      setCallingStaff(false);
    }
  };

  const openLoyaltyModal = () => {
    setLoyaltyLookupPanelKey((k) => k + 1);
    setShowLoyaltyModal(true);
  };

  const submitCallPayment = async (preference?: 'at_table' | 'bank_qr') => {
    if (!sessionId) {
      toast.error('Vui lòng quét mã QR tại bàn để gọi thanh toán.');
      return;
    }
    if (callingPayment || paymentCooldownLeft > 0) return;
    setCallingPayment(true);
    try {
      const paddedTable = tableId?.padStart(2, '0');
      const note =
        preference === 'at_table'
          ? 'Khách chọn thanh toán tại bàn'
          : preference === 'bank_qr'
            ? 'Khách chọn QR ngân hàng'
            : 'Khách gọi thanh toán bill';
      const basePayload = {
        merchantId: resolvedMerchantId,
        tableNumber: paddedTable,
        sessionId: sessionId ?? undefined,
        type: 'call_payment' as const,
        ...(preference ? { paymentPreference: preference } : {}),
        totalPrice: '0',
        items: [
          {
            productId: 'placeholder',
            quantity: 1,
            price: 0,
            notes: note,
          },
        ],
      };
      const payload = await withOrderGeo(orderGuard, basePayload);
      await api.post('/orders', payload);
      toast.success(
        preference === 'bank_qr'
          ? 'Đã báo thu ngân — mã QR bên dưới.'
          : preference === 'at_table'
            ? 'Đã báo thu ngân tới bàn.'
            : 'Đã gửi yêu cầu thanh toán tới thu ngân.',
      );
      const cooldownSeconds = 18;
      sessionStorage.setItem(
        paymentCooldownKey,
        String(Date.now() + cooldownSeconds * 1000),
      );
      setPaymentCooldownLeft(cooldownSeconds);

      if (preference === 'bank_qr') {
        try {
          const { data } = await api.get<PaymentInfo>(
            `/merchants/${resolvedMerchantId}/payment-info`,
          );
          const addInfo = `Ban ${paddedTable} thanh toan`;
          setBillQrUrl(buildVietQrUrl(data, activeOrdersTotal || 0, addInfo));
        } catch {
          setBillQrUrl(null);
        }
        setShowBillQrModal(true);
      }
    } catch (error: unknown) {
      console.error('Call payment:', error);
      const msg = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message
        : error instanceof Error
          ? error.message
          : 'Không gửi được yêu cầu.';
      toast.error(typeof msg === 'string' ? msg : 'Không gửi được yêu cầu.');
    } finally {
      setCallingPayment(false);
    }
  };

  const submitLoyaltyPay = async (method: 'at_table' | 'bank_qr') => {
    if (!sessionId) {
      toast.error('Vui lòng quét mã QR tại bàn để sử dụng thanh toán tích điểm.');
      return;
    }
    if (loyaltySubmitting || loyaltyCooldownLeft > 0) return;
    setLoyaltySubmitting(true);
    try {
      const paddedTable = tableId?.padStart(2, '0');
      const basePayload = {
        merchantId: resolvedMerchantId,
        tableNumber: paddedTable,
        sessionId: sessionId ?? undefined,
        type: 'loyalty_pay_request',
        loyaltyPaymentMethod: method,
        totalPrice: '0',
        items: [
          {
            productId: 'placeholder',
            quantity: 1,
            price: 0,
            notes: `Thanh toán tích điểm — ${method === 'at_table' ? 'tại bàn' : 'QR ngân hàng'}`,
          },
        ],
      };
      const payload = await withOrderGeo(orderGuard, basePayload);
      await api.post('/orders', payload);
      toast.success('Đã gửi yêu cầu tới nhân viên và thu ngân.');
      const cooldownSeconds = 25;
      sessionStorage.setItem(
        loyaltyCooldownKey,
        String(Date.now() + cooldownSeconds * 1000),
      );
      setLoyaltyCooldownLeft(cooldownSeconds);

      if (method === 'bank_qr') {
        try {
          const { data } = await api.get<PaymentInfo>(
            `/merchants/${resolvedMerchantId}/payment-info`,
          );
          const addInfo = `Ban ${paddedTable} TT tich diem`;
          setBillQrUrl(buildVietQrUrl(data, activeOrdersTotal || 0, addInfo));
        } catch {
          setBillQrUrl(null);
        }
        setShowBillQrModal(true);
      }
    } catch {
      toast.error('Gửi yêu cầu thất bại');
    } finally {
      setLoyaltySubmitting(false);
    }
  };

  const renderProductSection = () => {
    if (featuredProducts.length === 0) return null;
    return (
      <section className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Gợi ý cho bạn</h3>
          </div>
          <button
            onClick={() => navigate(`/order/${resolvedMerchantId}/${tableId}/menu`)}
            className="text-xs font-black uppercase tracking-wider text-primary hover:underline flex items-center gap-1"
          >
            Tất cả <ChevronRight size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {featuredProducts.map(product => (
            <div
              key={product.id}
              onClick={() => navigate(`/order/${resolvedMerchantId}/${tableId}/menu`)}
              className="bg-surface rounded-[2rem] border border-outline-variant/30 overflow-hidden shadow-sm group active:scale-[0.98] transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="h-32 w-full bg-slate-100 relative overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary">
                    <UtensilsCrossed size={28} />
                  </div>
                )}
                {product.isNew && (
                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-primary text-white">
                    Mới
                  </span>
                )}
              </div>
              <div className="p-3.5">
                <h4 className="text-xs font-black text-stone-900 group-hover:text-primary transition-colors leading-tight line-clamp-1">{product.name}</h4>
                <p className="text-[10px] text-stone-400 font-bold mt-1 tracking-tight line-clamp-1">{product.description || 'Hương vị thơm ngon'}</p>
                <div className="flex items-center justify-between mt-3.5">
                  <span className="text-xs font-black text-primary">
                    {Intl.NumberFormat('vi-VN').format(Number(product.price))}đ
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all">
                    <ChevronRight size={12} strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const billPayQrPortal =
    showBillQrModal &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        className="fixed inset-0 z-[340] flex items-end justify-center sm:items-center p-4 bg-black/55 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        onClick={() => {
          setShowBillQrModal(false);
          setBillQrUrl(null);
        }}
      >
        <div
          className="w-full max-w-sm rounded-t-[2.25rem] sm:rounded-[2.25rem] bg-surface shadow-2xl p-6 sm:animate-in sm:zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center space-y-4">
            <h3 className="text-base font-black text-stone-900">Quét mã thanh toán</h3>
            <p className="text-xs text-stone-500">
              Mã QR thanh toán cho đơn hàng bàn {tableDisplayName ?? tableId}.
            </p>
            {billQrUrl ? (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 inline-block">
                <img
                  src={billQrUrl}
                  alt="VietQR"
                  className="w-56 h-56 object-contain rounded-xl bg-surface border border-emerald-100"
                />
              </div>
            ) : null}
            <button
              className="w-full h-12 bg-stone-900 rounded-xl text-white font-black text-xs uppercase"
              onClick={() => { setShowBillQrModal(false); setBillQrUrl(null); }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  const loyaltyModal =
    showLoyaltyModal &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        className="fixed inset-0 z-[340] flex items-end justify-center sm:items-center p-4 bg-black/55 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="loyalty-modal-title"
        onClick={() => setShowLoyaltyModal(false)}
      >
        <div
          className="w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] bg-surface shadow-2xl max-h-[85vh] overflow-y-auto sm:animate-in sm:fade-in-0 sm:zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-outline-variant bg-surface px-5 py-4 rounded-t-[2rem] sm:rounded-t-[2rem]">
            <h2 id="loyalty-modal-title" className="text-base font-black text-primary pr-2">
              Tra cứu &amp; đổi quà tích điểm
            </h2>
            <button
              type="button"
              className="rounded-full p-2 text-stone-500 hover:bg-surface-container-low hover:text-stone-800"
              onClick={() => setShowLoyaltyModal(false)}
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <CustomerLoyaltyLookupPanel
              key={loyaltyLookupPanelKey}
              merchantId={resolvedMerchantId}
              tableNumberHint={tableId}
              sessionId={sessionId}
            />
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
    <div className="max-w-lg mx-auto min-h-screen relative overflow-x-clip text-stone-900 pb-32 notranslate bg-surface" translate="no">
      <WifiWelcomeModal
        wifiSsid={merchantInfo?.wifiSsid ?? merchantInfo?.wifi_ssid}
        wifiPassword={merchantInfo?.wifiPassword ?? merchantInfo?.wifi_password}
      />
      {sessionError && (
        <div className="p-4 bg-red-50 border-b border-red-100 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <X size={16} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-red-900 leading-none mb-1">Chế độ xem thông tin</p>
            <p className="text-[10px] font-medium text-red-700/70 leading-tight">Vui lòng quét mã QR tại bàn để sử dụng các tính năng gọi món/gọi nhân viên.</p>
          </div>
        </div>
      )}
      {networkWeak && (
        <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <X size={16} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-900 leading-none mb-1">Mạng yếu</p>
            <p className="text-[10px] font-medium text-amber-700/70 leading-tight">
              Kết nối không ổn định, vui lòng tải lại nếu chưa thấy dữ liệu mới.
            </p>
          </div>
        </div>
      )}

      {/* ─── HERO SECTION ─── */}
      <div className="relative h-64 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-stone-50 z-10" />
        
        {/* Floating Theme Selector */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
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
                onClick={() => setTheme(t)}
                className={`w-4 h-4 rounded-full ${colorMap[t]} border transition-all duration-200 ${
                  theme === t ? 'border-white scale-125 ring-2 ring-white/30' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-110'
                }`}
                title={`Theme ${t}`}
                type="button"
              />
            );
          })}
        </div>

        {merchantInfo?.bannerUrl ? (
          <img src={merchantInfo.bannerUrl} alt="Cover" className="w-full h-full object-cover scale-110" />
        ) : merchantInfo?.logoUrl ? (
          <img src={merchantInfo.logoUrl} alt="Cover" className="w-full h-full object-cover scale-110 blur-[2px]" />
        ) : (
          <img src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80" alt="Cover" className="w-full h-full object-cover" />
        )}

        <div className="absolute bottom-10 left-0 right-0 px-6 z-20">
          <div className="flex items-end gap-4">
            <div className="w-20 h-20 rounded-2xl bg-surface p-1 shadow-2xl border-2 border-white overflow-hidden">
              {merchantInfo?.logoUrl ? (
                <img src={merchantInfo.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-300 to-orange-500 flex items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--gradient-from) 0%, var(--gradient-to) 100%)' }}>
                  <UtensilsCrossed className="text-white w-10 h-10" />
                </div>
              )}
            </div>
            <div className="flex-1 pb-1">
              <h1 className="text-2xl font-black text-white leading-tight drop-shadow-md">
                {merchantInfo?.name || 'Lagi Menu'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 bg-primary-container text-primary ring-outline-variant">
                  {tableDisplayName ?? `Bàn ${tableId}`}
                </span>
                <span className="text-white/80 text-xs font-medium flex items-center gap-1">
                  <Star size={12} className="fill-yellow-400 text-yellow-400" /> 4.9 (200+)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-6 relative z-10">
        <div className="flex flex-col gap-4">
          {/* ─── Đặt món (CTA chính) ─── */}
          <button
            type="button"
            onClick={() => navigate(`/order/${resolvedMerchantId}/${tableId}/menu`)}
            className="group relative overflow-hidden h-36 rounded-[2.5rem] shadow-xl active:scale-[0.98] transition-all flex items-center justify-between px-8 ring-2 ring-outline-variant"
            style={{
              background: 'linear-gradient(135deg, var(--gradient-from) 0%, var(--gradient-via) 42%, var(--gradient-to) 100%)',
            }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full">
              <div
                className="absolute inset-0 rounded-full bg-surface/10 animate-ping opacity-20"
                style={{ animationDuration: '3s' }}
              />
              <div
                className="absolute inset-0 rounded-full bg-surface/5 animate-pulse"
                style={{ animationDuration: '4s' }}
              />
            </div>

            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-surface/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />

            <div className="relative z-10 text-left text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.35)' }}>
              <div className="flex items-center gap-2 mb-2">
                <UtensilsCrossed size={14} className="text-white/90" aria-hidden />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">E-Menu Digital</p>
              </div>
              <h2 className="text-3xl font-black tracking-tighter leading-none mb-1 text-white">GỌI MÓN NGAY</h2>
              <div className="flex items-center gap-1 text-[10px] font-bold text-white/95">
                <span>Chạm để khám phá thực đơn</span>
                <div className="animate-float-slow ml-1 text-white" aria-hidden>
                  <MousePointer2 size={12} />
                </div>
              </div>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-2 text-white" aria-hidden>
              <div className="w-16 h-16 bg-surface/30 rounded-2xl flex items-center justify-center backdrop-blur-sm group-hover:rotate-12 transition-transform shadow-inner ring-2 ring-white/50">
                <UtensilsCrossed size={32} strokeWidth={2.25} />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-surface rounded-full flex items-center justify-center shadow-lg animate-bounce border-2 border-outline-variant text-primary">
                <ChevronRight size={16} className="text-primary" strokeWidth={3} />
              </div>
            </div>
          </button>

          {activeOrdersTotal !== null && activeOrdersTotal > 0 && (
            <div className="bg-gradient-to-r from-primary to-primary-dark rounded-3xl p-5 text-white shadow-lg flex items-center justify-between mb-2" style={{ background: 'linear-gradient(90deg, var(--gradient-via) 0%, var(--gradient-to) 100%)' }}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary-container">Hóa đơn bàn hiện tại</p>
                <p className="text-2xl font-black tracking-tight mt-0.5">
                  {Intl.NumberFormat('vi-VN').format(activeOrdersTotal)}đ
                </p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wide">
                Chưa thanh toán
              </div>
            </div>
          )}

          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-400 px-1 -mb-1">Dịch vụ quầy</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            {/* ─── Card 1: Thanh toán thường (Không tích điểm) ─── */}
            <section className="rounded-[2rem] bg-surface border-2 border-outline-variant/30 shadow-md p-5 flex flex-col justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-600 border border-stone-200">
                  <CreditCard size={24} strokeWidth={2.25} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wide bg-stone-100 text-stone-500 ring-1 ring-stone-200">
                      Không tích điểm
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-stone-900 mt-1 leading-tight">Thanh toán thường</h3>
                  <p className="text-[11px] font-bold text-stone-400 mt-1.5 leading-relaxed">
                    Yêu cầu gọi thanh toán thường tại quầy thu ngân. Hình thức này không được tích lũy điểm thưởng thành viên.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!!sessionError || callingPayment || paymentCooldownLeft > 0}
                onClick={() => void submitCallPayment(undefined)}
                className="w-full h-12 rounded-2xl text-stone-700 bg-stone-100 hover:bg-stone-200 text-xs font-black uppercase tracking-widest active:scale-[0.99] transition-all disabled:opacity-45 disabled:pointer-events-none flex items-center justify-center gap-2 border border-stone-200"
              >
                {callingPayment ? (
                  <Loader2 size={18} className="animate-spin text-stone-500" aria-hidden />
                ) : paymentCooldownLeft > 0 ? (
                  `Chờ ${paymentCooldownLeft}s`
                ) : (
                  <>
                    <Wallet size={16} className="shrink-0 text-stone-500" aria-hidden />
                    Gọi thanh toán thường
                  </>
                )}
              </button>
            </section>

            {/* ─── Card 2: Thanh toán tích điểm & Đổi quà (Được tích điểm) ─── */}
            <section 
              className="rounded-[2rem] text-white shadow-xl p-5 flex flex-col justify-between gap-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, var(--gradient-from) 0%, var(--gradient-to) 100%)',
              }}
            >
              <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              
              <div className="flex items-start gap-3 relative z-10">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 border border-white/30 text-white">
                  <div className="relative flex h-9 w-9 items-center justify-center">
                    <Gift size={24} className="text-white" strokeWidth={2.25} aria-hidden />
                    <span className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-amber-400">
                      <Coins size={11} className="text-orange-950 font-black" aria-hidden />
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wide bg-amber-400 text-orange-950 ring-1 ring-amber-300 animate-pulse">
                      Được tích điểm
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-white mt-1 leading-tight">Thanh toán tích điểm</h3>
                  <p className="text-[11px] font-bold text-orange-100 mt-1.5 leading-relaxed">
                    {loyaltyProgramBrief?.earnRuleLabel
                      ? loyaltyProgramBrief.earnRuleLabel
                      : 'Gọi thanh toán tại bàn hoặc quét QR tự động để được cộng điểm thưởng.'}
                  </p>
                  
                  {loyaltyProgramLoading ? (
                    <p className="text-[9px] font-medium text-orange-200 mt-1.5 italic">Đang tải thông tin...</p>
                  ) : loyaltyProgramBrief?.hasActiveRewards ? (
                    <p className="text-[9px] font-bold text-amber-300 mt-1.5 leading-snug">
                      Đang có <span className="underline">{loyaltyProgramBrief.rewardCount} phần quà</span> sẵn sàng đổi!
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 relative z-10">
                <button
                  type="button"
                  disabled={!!sessionError || loyaltySubmitting || loyaltyCooldownLeft > 0}
                  onClick={() => void submitLoyaltyPay('at_table')}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5 px-2 active:scale-[0.98] transition-all disabled:opacity-45 bg-white/10 hover:bg-white/15 border border-white/20 text-white min-h-[4.75rem]"
                >
                  <Store size={18} className="text-amber-300" aria-hidden />
                  <span className="text-[10px] font-black uppercase tracking-tight leading-tight">Tại bàn</span>
                  <span className="text-[8px] font-bold text-orange-100/80 leading-tight">Thu ngân ra bàn</span>
                </button>
                <button
                  type="button"
                  disabled={!!sessionError || loyaltySubmitting || loyaltyCooldownLeft > 0}
                  onClick={() => void submitLoyaltyPay('bank_qr')}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5 px-2 active:scale-[0.98] transition-all disabled:opacity-45 bg-white/10 hover:bg-white/15 border border-white/20 text-white min-h-[4.75rem]"
                >
                  <QrCode size={18} className="text-amber-300" aria-hidden />
                  <span className="text-[10px] font-black uppercase tracking-tight leading-tight">QR ngân hàng</span>
                  <span className="text-[8px] font-bold text-orange-100/80 leading-tight">Có tích điểm</span>
                </button>
              </div>

              <button
                type="button"
                onClick={openLoyaltyModal}
                disabled={!!sessionError || loyaltyCooldownLeft > 0}
                className="w-full h-11 rounded-2xl bg-amber-400 hover:bg-amber-300 text-orange-950 text-xs font-black uppercase tracking-widest active:scale-[0.99] transition-all disabled:opacity-40 disabled:pointer-events-none shadow-md flex items-center justify-center gap-1.5 relative z-10 border border-amber-300"
              >
                <Gift size={15} className="shrink-0" aria-hidden />
                {loyaltyCooldownLeft > 0 ? `Chờ ${loyaltyCooldownLeft}s` : 'Tra cứu & đổi quà'}
                <ChevronRight size={14} className="shrink-0 ml-auto" aria-hidden />
              </button>
            </section>
          </div>

          {/* ─── Hỗ trợ tại bàn ─── */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-400 mb-2 px-1">Hỗ trợ tại bàn</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCallStaff}
                disabled={callingStaff || cooldownLeft > 0}
                className={`min-h-[7.5rem] rounded-3xl shadow-lg active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1.5 border-2 px-2 py-3 ${
                  callSuccess
                    ? 'bg-[#ecfdf5] border-[#22c55e] text-[#15803d]'
                    : 'border-[#f87171] shadow-md'
                }`}
                style={
                  callSuccess
                    ? undefined
                    : { background: '#fef2f2', color: '#b91c1c' }
                }
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                    callSuccess ? 'bg-white/80 ring-1 ring-emerald-200' : 'bg-white/70 ring-1 ring-red-100'
                  }`}
                >
                  {callingStaff ? (
                    <Loader2 size={22} className="animate-spin text-[#ef4444]" aria-hidden />
                  ) : callSuccess ? (
                    <Sparkles size={22} className="text-[#15803d]" aria-hidden />
                  ) : (
                    <PhoneCall size={22} className="text-[#dc2626]" aria-hidden />
                  )}
                </div>
                <span
                  className={`text-[11px] font-black uppercase tracking-tight text-center ${
                    callSuccess ? 'text-[#15803d]' : 'text-[#b91c1c]'
                  }`}
                >
                  {callSuccess ? 'Đã gọi' : cooldownLeft > 0 ? `Chờ ${cooldownLeft}s` : 'Gọi nhân viên'}
                </span>
                <span className="text-[9px] font-semibold text-center opacity-80 leading-tight px-1">
                  Nhờ hỗ trợ tại bàn
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="min-h-[7.5rem] rounded-3xl shadow-lg active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1.5 border-2 border-[#eab308] px-2 py-3"
                style={{ background: '#fefce8', color: '#854d0e' }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 ring-1 ring-amber-200">
                  <Star size={22} className="text-[#ca8a04] fill-amber-200" strokeWidth={2} aria-hidden />
                </div>
                <span className="text-[11px] font-black uppercase tracking-tight text-center text-[#713f12]">
                  Đánh giá quán
                </span>
                <span className="text-[9px] font-semibold text-[#a16207] text-center leading-tight px-1 opacity-90">
                  Chia sẻ trải nghiệm
                </span>
              </button>
            </div>
          </div>
        </div>
        
        {/* ─── SHOP INFO ─── */}
        {(merchantInfo?.address || merchantInfo?.phone) && (
          <section className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
             <div className="bg-surface rounded-[2rem] p-6 shadow-premium-sm border border-stone-100/50 flex flex-col gap-5">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-orange-300 rounded-full animate-pulse" />
                   <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Thông tin cửa hàng</h3>
                </div>
                
                <div className="space-y-4">
                  {merchantInfo.address && (
                    <div className="flex items-start gap-4">
                       <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                          <MapPin size={18} />
                       </div>
                       <div className="min-w-0">
                          <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-1 leading-none">Địa chỉ quán</p>
                          <p className="text-[13px] font-bold text-stone-600 leading-snug">{merchantInfo.address}</p>
                       </div>
                    </div>
                  )}

                  {merchantInfo.phone && (
                    <div className="flex items-start gap-4">
                       <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
                          <Phone size={16} />
                       </div>
                       <div className="min-w-0">
                          <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-1 leading-none">Số điện thoại</p>
                          <p className="text-[14px] font-black text-stone-800">{merchantInfo.phone}</p>
                       </div>
                    </div>
                  )}
                </div>
             </div>
          </section>
        )}

        {/* ─── FEATURED PRODUCTS ─── */}
        {renderProductSection()}

        {/* ─── FOOTER INFO ─── */}
        <div className="mt-12 text-center pb-8">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-4">Trải nghiệm dịch vụ số bởi Lagi Menu</p>
          <div className="flex justify-center gap-6 opacity-30">
            <Sparkles size={16} />
            <UtensilsCrossed size={16} />
            <Heart size={16} />
          </div>
        </div>
      </div>

      {/* ─── CALL TO ACTION FLOATING ─── */}
      <div className="fixed bottom-6 left-0 right-0 px-6 z-50 max-w-lg mx-auto w-full pointer-events-none [&_button]:pointer-events-auto">
        <button
          type="button"
          onClick={() => navigate(`/order/${resolvedMerchantId}/${tableId}/menu`)}
          className="w-full h-14 rounded-2xl shadow-2xl flex items-center justify-center gap-3 font-black text-sm active:scale-[0.98] transition-all text-white ring-2 ring-[#fdba74]"
          style={{ background: 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)' }}
        >
          Xem thực đơn & đặt món
          <ChevronRight size={18} />
        </button>
      </div>

      <ReviewModal
        merchantId={resolvedMerchantId}
        tableId={tableId || ''}
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
      />
    </div>
    {billPayQrPortal}
    {loyaltyModal}
    </>
  );
};
