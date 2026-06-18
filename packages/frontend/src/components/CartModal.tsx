import React from 'react';
import { ShoppingBasket, Minus, Plus, Trash2, Send, Loader2, X, Info, CreditCard } from 'lucide-react';
import { formatTimeShort } from '@shared/utils';
import toast from 'react-hot-toast';
import { Button, Badge } from './ui';
import { normalizeVnCustomerPhone } from '../lib/phoneUtils';

interface CartItem {
  product: {
    id: number;
    name: string;
    price: string;
    imageUrl?: string;
    options?: string;
    saleActive?: boolean;
    salePrice?: number;
  };
  quantity: number;
  options: {
    size: string;
    sugar: string;
    toppings: string[];
  };
}

function parseVndDigits(v: string | undefined): number {
  const d = String(v ?? '').replace(/\D/g, '');
  return d ? Number(d) : 0;
}

function getCartProductUnitBase(product: CartItem['product']): number {
  const list = parseVndDigits(product.price);
  if (product.saleActive && typeof product.salePrice === 'number' && product.salePrice > 0) {
    return product.salePrice;
  }
  return list;
}

function lineTotalForCartItem(item: CartItem): number {
  const basePrice = getCartProductUnitBase(item.product);
  let optionsJson: any = { sizes: [], toppings: [] };
  try {
    const raw = item.product.options;
    if (typeof raw === 'string') optionsJson = JSON.parse(raw);
    else if (typeof raw === 'object' && raw !== null) optionsJson = raw;
  } catch {
    /* ignore */
  }
  const sizeLetter = item.options.size;
  const sizeOption = optionsJson.sizes?.find(
    (s: any) => String(s.label) === sizeLetter || String(s.label).includes(sizeLetter),
  );
  const sizeExtra = parseFloat(String(sizeOption?.extraPrice || 0));
  const toppingsExtra = (item.options.toppings || []).reduce((tSum: number, tName: string) => {
    const toppingDetails = optionsJson.toppings?.find((td: any) => td.name === tName);
    return tSum + parseFloat(String(toppingDetails?.price || 0));
  }, 0);
  const quantity = parseInt(String(item.quantity || 0), 10);
  return (basePrice + sizeExtra + toppingsExtra) * quantity;
}

interface CartModalProps {
  items: CartItem[];
  existingOrders: any[];
  onUpdateQuantity: (productId: number, options: any, delta: number) => void;
  onRemoveItem: (productId: number, options: any) => void;
  onClose: () => void;
  onSubmit: (note: string, customerName: string, customerPhone: string) => void;
  onCallPayment: () => Promise<void>;
  submitting: boolean;
  sessionId: string | null;
  /** Dùng khóa tích điểm tự chọn (LoyaltyDrinksNudge) */
  merchantId?: string | null;
}

// ─── Component v1.1.0 (Fixed Slice) ───────────────────────────────────────────
export const CartModal: React.FC<CartModalProps> = ({ 
  items, 
  existingOrders,
  onUpdateQuantity, 
  onRemoveItem, 
  onClose, 
  onSubmit,
  onCallPayment,
  submitting,
  sessionId,
  merchantId,
}) => {
  const [note, setNote] = React.useState('');
  const [callingPayment, setCallingPayment] = React.useState(false);
  
  const [customerName, setCustomerName] = React.useState(() => {
    const savedSession = localStorage.getItem('guest_session_id');
    const savedName = localStorage.getItem('guest_name');
    if (savedSession === sessionId && savedName) return savedName;
    return '';
  });

  const [customerPhone, setCustomerPhone] = React.useState(() => {
    const savedSession = localStorage.getItem('guest_session_id');
    const savedPhone = localStorage.getItem('guest_phone');
    if (savedSession === sessionId && savedPhone) return savedPhone;
    return '';
  });

  React.useEffect(() => {
    if (sessionId) {
      localStorage.setItem('guest_session_id', sessionId);
      localStorage.setItem('guest_name', customerName);
      localStorage.setItem('guest_phone', customerPhone);
    }
  }, [customerName, customerPhone, sessionId]);

  const [loyaltyOptIn, setLoyaltyOptIn] = React.useState(false);
  React.useLayoutEffect(() => {
    try {
      if (!merchantId || !sessionId) {
        setLoyaltyOptIn(false);
        return;
      }
      setLoyaltyOptIn(localStorage.getItem(`loyalty_optin_${merchantId}_${sessionId}`) === '1');
    } catch {
      setLoyaltyOptIn(false);
    }
  }, [merchantId, sessionId]);

  const loyaltyPhoneOk = React.useMemo(() => {
    if (!loyaltyOptIn) return true;
    const raw = customerPhone.trim();
    const canon = normalizeVnCustomerPhone(raw) ?? raw.replace(/\D/g, '');
    return canon.length >= 8;
  }, [loyaltyOptIn, customerPhone]);

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + lineTotalForCartItem(item), 0);
  };

  /** Chênh lệch giá niêm yết vs giá sau sale (chỉ trên giá món, không tính topping/size — cùng áp vào cả hai). */
  const saleSavingsVsList = React.useMemo(() => {
    return items.reduce((sum, item) => {
      if (!item.product.saleActive) return sum;
      const listUnit = parseVndDigits(item.product.price);
      const saleUnit = getCartProductUnitBase(item.product);
      const delta = Math.max(0, listUnit - saleUnit);
      const q = Number(item.quantity) || 0;
      return sum + delta * q;
    }, 0);
  }, [items]);

  const servedTotal = (existingOrders || []).reduce((s, o) => {
    const p = parseFloat(String(o.totalPrice || o.total_price || 0));
    return s + p;
  }, 0);
  const subtotal = calculateSubtotal();
  const total = subtotal + servedTotal;

  return (
    <div className="fixed inset-0 z-[110] bg-stone-950/40 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-300 notranslate" translate="no" onClick={onClose}>
      <div 
        className="w-full max-w-lg mx-auto bg-surface-container-low rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[92vh] animate-in slide-in-from-bottom duration-500" 
        onClick={e => e.stopPropagation()}
      >
        {/* Handle for dragging feel */}
        <div className="w-full py-3 flex justify-center cursor-pointer" onClick={onClose}>
            <div className="w-12 h-1.5 bg-outline-variant/70 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-stone-900 tracking-tight">Giỏ hàng</h2>
            <div className="flex gap-2 mt-1">
                <Badge className="bg-primary-container text-on-primary-container border-0 rounded-lg text-[10px] font-black py-0.5">
                    {items.length} món mới
                </Badge>
                {existingOrders.length > 0 && (
                    <Badge className="bg-surface-container-high text-primary border-0 rounded-lg text-[10px] font-black py-0.5">
                        {existingOrders.length} đơn đã đặt
                    </Badge>
                )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-11 h-11 rounded-2xl bg-surface shadow-sm flex items-center justify-center text-stone-400 active:scale-95 transition-all border border-outline-variant/60"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-6 space-y-7 pb-40 no-scrollbar pt-2">
          
          {/* Section: Floating Customer Info (Top Priority) */}
          {items.length > 0 && (
            <div className="animate-in slide-in-from-top-4 duration-500 delay-150">
              <div className="bg-primary-container/20 rounded-[2rem] p-5 shadow-sm border border-outline-variant/50 flex flex-col gap-4 relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute -top-6 -right-6 w-20 h-20 bg-primary-container/20 rounded-full blur-2xl" />
                
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-xl bg-primary-container flex items-center justify-center text-primary">
                    <Info size={16} />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-black text-stone-900 leading-none">Thông tin khách hàng</h3>
                    <p className="text-[10px] text-stone-400 font-bold mt-1 uppercase tracking-tight">Để nhân viên dễ xưng hô & phục vụ</p>
                  </div>
                </div>

                {loyaltyOptIn && (
                  <p className="text-[10px] font-bold text-amber-900 bg-amber-100/80 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
                    Bạn đã chọn tham gia <strong>tích điểm đổi quà</strong> — vui lòng nhập đúng số điện thoại để quán cộng điểm khi thanh toán.
                  </p>
                )}

                <div className="grid grid-cols-1 gap-3">
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Tên của bạn (VD: Anh Nam...)" 
                      className="w-full h-13 bg-surface border-outline-variant/70 rounded-2xl px-5 text-sm focus:ring-2 focus:ring-primary/20 transition-all border outline-none font-bold placeholder:text-stone-300" 
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <input 
                      type="tel"
                      placeholder={loyaltyOptIn ? 'Số điện thoại (bắt buộc để tích điểm)' : 'Số điện thoại (tùy chọn)'} 
                      className="w-full h-13 bg-surface border-outline-variant/70 rounded-2xl px-5 text-sm focus:ring-2 focus:ring-primary/20 transition-all border outline-none font-medium placeholder:text-stone-300" 
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Section: New Items (Giỏ hàng hiện tại) */}
          {items.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-4 bg-primary rounded-full" />
                <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest">Món mới chọn</h3>
              </div>
              
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={`${item.product.id}-${index}`} className="bg-surface p-3.5 rounded-[1.5rem] shadow-sm border border-outline-variant/70 flex gap-4 transition-all">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-surface-container-high border border-outline-variant/60 flex items-center justify-center relative">
                      {item.product.imageUrl ? (
                        <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBasket size={24} className="text-stone-300" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col py-0.5">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-stone-800 text-sm line-clamp-1">{item.product.name}</h4>
                        <button 
                            onClick={() => onRemoveItem(item.product.id, item.options)}
                            className="text-stone-300 hover:text-red-400 active:scale-90 transition-colors p-1"
                        >
                            <Trash2 size={14} />
                        </button>
                      </div>
                      
                      <p className="text-[11px] text-stone-400 font-bold">
                        {item.options.size !== 'M' ? `Size ${item.options.size} • ` : ''}{item.options.sugar}% Đường
                      </p>
                      
                      <div className="flex items-center justify-between mt-auto">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-primary font-black text-sm">
                            {Intl.NumberFormat('vi-VN').format(lineTotalForCartItem(item))}đ
                          </span>
                          {item.product.saleActive && (
                            <span className="text-[9px] font-black uppercase text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 w-fit">
                              Đã áp sale
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center bg-surface-container-low rounded-xl p-1 border border-outline-variant/50">
                            <button 
                                onClick={() => onUpdateQuantity(item.product.id, item.options, -1)}
                                className="w-7 h-7 flex items-center justify-center bg-surface text-stone-400 rounded-lg active:scale-90 shadow-sm transition-all"
                            >
                                <Minus size={12} strokeWidth={3} />
                            </button>
                            <span className="mx-3 font-black text-stone-700 text-sm">{item.quantity}</span>
                            <button 
                                onClick={() => onUpdateQuantity(item.product.id, item.options, 1)}
                                className="w-7 h-7 flex items-center justify-center bg-primary text-white rounded-lg active:scale-95 shadow-md shadow-primary/20 transition-all font-bold"
                            >
                                <Plus size={12} strokeWidth={3} />
                            </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty States */}
          {items.length === 0 && existingOrders.length === 0 && (
            <div className="py-20 flex flex-col items-center">
              <div className="w-24 h-24 bg-surface rounded-3xl flex items-center justify-center shadow-sm border border-outline-variant/60 text-stone-200 mb-6 group">
                <ShoppingBasket size={48} className="group-hover:scale-110 transition-transform duration-500" />
              </div>
              <h3 className="text-lg font-black text-stone-900 mb-2">Giỏ hàng trống</h3>
              <p className="text-sm text-stone-400 text-center max-w-[200px] leading-relaxed">
                Quý khách chưa chọn món nào. Quay lại thực đơn nhé!
              </p>
              <Button 
                variant="outline" 
                className="mt-8 rounded-2xl border-outline-variant/70 h-12 px-8 font-black uppercase text-xs tracking-widest text-stone-600 active:scale-95" 
                onClick={onClose}
              >
                Tiếp tục chọn món
              </Button>
            </div>
          )}

          {/* Section: Served Items (Đã phục vụ) */}
          {existingOrders.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-primary rounded-full" />
                    <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest">Danh sách đã đặt</h3>
                </div>
              </div>
              
              <div className="space-y-3">
                {existingOrders.map((order) => (
                  <div key={order.id} className="bg-surface-container-low/45 backdrop-blur-sm border border-outline-variant/60 rounded-[1.5rem] p-4 relative">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <span className="font-bold text-primary/70 uppercase tracking-widest text-[9px]">Mã đơn: #{String(order.id).slice(-4)}</span>
                        <Badge className={`${
                            String(order.status).toLowerCase() === 'completed'
                              ? 'bg-primary text-white'
                              : String(order.status).toLowerCase() === 'preparing'
                                ? 'bg-surface-container-low text-primary'
                                : 'bg-surface-container-low text-primary'
                        } border-0 font-black text-[9px] uppercase tracking-tighter rounded-lg`}>
                            {String(order.status).toLowerCase() === 'completed' ? 'Đã phục vụ' : 
                             String(order.status).toLowerCase() === 'preparing' ? 'Đang chế biến' : 
                             'Đã nhận đơn'}
                        </Badge>
                    </div>
                    <div className="space-y-3">
                      {(order.items || []).map((item: any, idx: number) => (
                        <div key={`${order.id}-${idx}`} className="flex justify-between items-center bg-surface p-2.5 rounded-xl border border-outline-variant/60 shadow-sm">
                          <div className="flex items-center gap-3">
                             <span className="w-6 h-6 rounded-lg bg-surface-container-low text-primary flex items-center justify-center font-black text-[10px]">
                                {item.quantity}
                             </span>
                             <div className="flex flex-col">
                                <span className="text-xs font-bold text-stone-700">{item.product?.name || 'Món cũ'}</span>
                                {(item.note ?? item.notes) && (
                                  <p className="text-[9px] text-stone-400 truncate max-w-[150px]">
                                    {item.note ?? item.notes}
                                  </p>
                                )}
                             </div>
                          </div>
                          <span className="font-black text-stone-800 text-xs">{Intl.NumberFormat('vi-VN').format((Number(item.price) || 0) * (Number(item.quantity) || 0))}đ</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/60">
                       <span className="font-bold text-primary/70 uppercase tracking-wider text-[10px]">
                         Thời gian: {formatTimeShort(order.createdAt ?? order.created_at)}
                       </span>
                       <span className="text-primary font-black">{Intl.NumberFormat('vi-VN').format(Number(order.totalPrice) || 0)}đ</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Note Section */}
          {items.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-4 bg-primary rounded-full" />
                <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest">Ghi chú thêm</h3>
              </div>
              
              <div className="bg-surface rounded-[2rem] p-5 shadow-sm border border-outline-variant/70">
                <textarea 
                  className="w-full bg-surface-container-low border-outline-variant/60 rounded-2xl p-4 text-stone-700 placeholder:text-stone-300 focus:bg-surface resize-none transition-all text-sm h-24 border outline-none"
                  placeholder="VD: Không đá, ít ngọt, nhiều trân châu..." 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Floating Action Footer */}
        <div className="relative bottom-0 left-0 right-0 p-6 bg-surface shadow-[0_-12px_40px_rgba(0,0,0,0.06)] rounded-t-[2.5rem]">
            {/* Payment / Summary Bar */}
            <div className="bg-stone-950 rounded-3xl p-5 mb-5 shadow-lg shadow-stone-900/10">
                <div className="flex justify-between items-center mb-3 opacity-60">
                    <span className="text-white font-bold text-[10px] uppercase tracking-widest">Thanh toán tại quầy/bàn</span>
                    <CreditCard size={14} className="text-white" />
                </div>
                
                <div className="space-y-2 mb-4">
                    {items.length > 0 && (
                        <div className="flex justify-between text-white/70 text-[11px] font-bold">
                            <span>Giỏ hàng hiện tại ({items.reduce((s, i) => s + i.quantity, 0)} món)</span>
                            <span>{Intl.NumberFormat('vi-VN').format(subtotal)}đ</span>
                        </div>
                    )}
                    {saleSavingsVsList > 0 && (
                        <div className="flex justify-between text-emerald-300/95 text-[11px] font-black">
                            <span>Ưu đãi so với giá niêm yết</span>
                            <span>−{Intl.NumberFormat('vi-VN').format(saleSavingsVsList)}đ</span>
                        </div>
                    )}
                    {existingOrders.length > 0 && (
                        <div className="flex justify-between text-primary text-[11px] font-bold">
                            <span>Đã phục vụ ({existingOrders.reduce((s, o) => s + (o.items?.length || 0), 0)} món)</span>
                            <span>{Intl.NumberFormat('vi-VN').format(servedTotal)}đ</span>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center py-1 mt-1 border-t border-white/10">
                    <span className="text-white/60 text-xs font-black uppercase">Tạm tính toàn bộ</span>
                    <span className="text-white font-black text-xl">
                        {Intl.NumberFormat('vi-VN').format(total)}đ
                    </span>
                </div>

                {existingOrders.some(o => o.status === 'completed') && (
                    <button 
                        className="w-full mt-4 h-11 rounded-2xl bg-surface/10 hover:bg-surface/20 text-white font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                        onClick={async () => {
                            setCallingPayment(true);
                            try { await onCallPayment(); } finally { setCallingPayment(false); }
                        }}
                        disabled={callingPayment}
                    >
                        {callingPayment ? <Loader2 size={16} className="animate-spin" /> : <>GỌI THANH TOÁN TẠI BÀN</>}
                    </button>
                )}
            </div>

            {/* Confirm Action */}
            {items.length > 0 ? (
                <Button 
                    className="w-full bg-primary text-white py-4 rounded-3xl font-black text-base shadow-xl shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 h-16"
                    onClick={() => {
                        if (!sessionId) {
                            alert('Vui lòng quét mã QR tại bàn để thực hiện đặt món.');
                            return;
                        }
                        if (!loyaltyPhoneOk) {
                            toast.error('Nhập số điện thoại hợp lệ để tích điểm (ít nhất 8 số).');
                            return;
                        }
                        onSubmit(note, customerName, customerPhone);
                    }}
                    disabled={submitting || !customerName.trim() || !loyaltyPhoneOk}
                >
                    {submitting ? (
                        <Loader2 className="animate-spin" />
                    ) : (
                        <div className="flex items-center justify-between w-full px-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-surface/35 flex items-center justify-center text-white">
                                    <Send size={18} />
                                </div>
                                <span className="text-left font-black tracking-tighter">XÁC NHẬN ĐẶT<br/><span className="text-[10px] opacity-60 uppercase tracking-widest leading-none">Gửi {items.reduce((s, i) => s + i.quantity, 0)} món mới</span></span>
                            </div>
                            <div className="flex flex-col items-end leading-none">
                                <span className="text-lg font-black">{Intl.NumberFormat('vi-VN').format(total)}đ</span>
                                <span className="text-[10px] font-bold opacity-60 mt-1">Order này: {Intl.NumberFormat('vi-VN').format(subtotal)}đ</span>
                            </div>
                        </div>
                    )}
                </Button>
            ) : (
                <Button 
                    className="w-full bg-stone-950 text-white py-4 rounded-3xl font-black text-sm transition-all h-16 uppercase tracking-widest active:scale-95 shadow-xl shadow-stone-900/10"
                    onClick={onClose}
                >
                    {existingOrders.length > 0 ? (
                        <div className="flex items-center justify-between w-full px-5">
                            <div className="flex flex-col items-start leading-tight">
                                <span className="text-[10px] opacity-40 font-bold uppercase tracking-[0.2em] mb-0.5">Tổng hóa đơn của bạn</span>
                                <span className="text-lg font-black text-primary">{Intl.NumberFormat('vi-VN').format(servedTotal)}đ</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black tracking-widest opacity-60">CHỌN THÊM MÓN</span>
                                <div className="w-8 h-8 rounded-xl bg-surface/25 flex items-center justify-center">
                                    <ShoppingBasket size={18} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>TIẾP TỤC CHỌN MÓN</>
                    )}
                </Button>
            )}
        </div>
      </div>
    </div>
  );
};
