import React, { useState } from 'react';
import { Heart, Minus, Plus, ChevronLeft, Check, X } from 'lucide-react';
import { Button } from './ui';

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
  discountLabel?: string | null;
}

function parseVndDigits(v: string | undefined): number {
  const d = String(v ?? '').replace(/\D/g, '');
  return d ? Number(d) : 0;
}

function getProductUnitBase(product: Product): number {
  const list = parseVndDigits(product.price);
  if (product.saleActive && typeof product.salePrice === 'number' && product.salePrice > 0) {
    return product.salePrice;
  }
  return list;
}

interface ProductDetailProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, options: any) => void;
  sessionId?: string | null;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({ product, onClose, onAddToCart, sessionId }) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedSugar, setSelectedSugar] = useState('50%');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);

  const parsedOptions = React.useMemo(() => {
    try {
      return product.options ? JSON.parse(product.options) : { sizes: [], toppings: [], sugarLevels: [] };
    } catch {
      return { sizes: [], toppings: [], sugarLevels: [] };
    }
  }, [product.options]);

  const sizes = parsedOptions.sizes?.length > 0 ? parsedOptions.sizes.map((s: any) => ({
    label: `Size ${s.label}`,
    price: s.extraPrice
  })) : [
    { label: 'Size S', price: 0 },
    { label: 'Size M', price: 5000 },
    { label: 'Size L', price: 10000 }
  ];

  const sugarLevels = parsedOptions.sugarLevels?.length > 0 ? parsedOptions.sugarLevels : ['0%', '30%', '50%', '100%'];
  const toppings = parsedOptions.toppings?.length > 0 ? parsedOptions.toppings : [];

  const calculateTotal = () => {
    const basePrice = getProductUnitBase(product);
    const sizeExtra = sizes.find((s: any) => s.label.includes(selectedSize))?.price || 0;
    const toppingsExtra = selectedToppings.reduce((sum: number, name: string) => {
      const t = toppings.find((top: any) => top.name === name);
      return sum + (t?.price || 0);
    }, 0);
    return (basePrice + sizeExtra + toppingsExtra) * quantity;
  };

  const toggleTopping = (name: string) => {
    setSelectedToppings(prev => 
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  const unitListPrice = parseVndDigits(product.price);
  const unitSalePrice = getProductUnitBase(product);
  const savingsPerUnit =
    product.saleActive && unitListPrice > unitSalePrice
      ? unitListPrice - unitSalePrice
      : 0;
  const savingsThisLine = savingsPerUnit * quantity;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 animate-fade-in flex flex-col items-center">
      {/* Centered Container for Desktop */}
      <div className="w-full max-w-2xl bg-surface h-full relative flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header Action Buttons */}
        <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
          <button 
            onClick={onClose}
            className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-full bg-surface/90 shadow-md text-stone-800 active:scale-95 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <button className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-full bg-surface/90 shadow-md text-stone-800 active:scale-95 transition-all">
            <Heart size={20} />
          </button>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar bg-surface">
          {/* Hero Image Section - Tighter on mobile */}
          <section className="relative h-[28vh] sm:h-[40vh] w-full overflow-hidden bg-[#ffedd5]/60 flex items-center justify-center">
            {product.imageUrl ? (
              <img 
                src={product.imageUrl} 
                alt={product.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <Plus size={48} className="text-stone-200" />
            )}
          </section>
          <div className="px-5 -mt-10 relative z-10 pb-40">
            <div className="bg-surface rounded-t-[2.5rem] p-6 sm:p-8">
              <div className="flex justify-between items-start mb-2 gap-4 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-on-surface leading-tight flex-1 pr-4">
                  {product.name}
                </h1>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {product.saleActive && product.discountLabel && (
                    <span className="text-[10px] font-black uppercase text-white bg-red-500 px-2 py-0.5 rounded-full">
                      {product.discountLabel}
                    </span>
                  )}
                  <div className="flex flex-col items-end">
                    <span className="text-on-surface font-black text-lg">
                      {Intl.NumberFormat('vi-VN').format(getProductUnitBase(product))}đ
                    </span>
                    {product.saleActive && (
                      <span className="text-stone-400 line-through text-sm font-bold">
                        {Intl.NumberFormat('vi-VN').format(unitListPrice)}đ
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {savingsThisLine > 0 && (
                <p className="text-emerald-700 text-xs font-bold mb-6 mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
                  Tiết kiệm {Intl.NumberFormat('vi-VN').format(savingsThisLine)}đ so với giá niêm yết
                  {quantity > 1 && (
                    <span className="text-stone-500 font-semibold">
                      ({Intl.NumberFormat('vi-VN').format(savingsPerUnit)}đ × {quantity})
                    </span>
                  )}
                </p>
              )}
            
              <p className="text-stone-500 text-sm leading-snug mb-8">
                {product.description || 'Hương vị thơm ngon hấp dẫn từ Lagi Menu, mang đến cho bạn trải nghiệm tuyệt vời nhất.'}
              </p>

              {/* Customization */}
              <div className="space-y-8 pb-10">
                {/* Sizes */}
                <section>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-black text-on-surface uppercase tracking-wide">Kích thước</h3>
                    <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full">Bắt buộc</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {sizes.map((size: any) => {
                      const sizeLetter = size.label.split(' ')[1];
                      const isActive = selectedSize === sizeLetter;
                      return (
                        <button
                          key={size.label}
                          onClick={() => setSelectedSize(sizeLetter)}
                          className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                            isActive 
                            ? 'border-primary bg-primary/5 text-primary scale-105 shadow-sm' 
                            : 'border-transparent bg-surface-container-low text-stone-600'
                          }`}
                        >
                          <span className="text-[11px] font-bold mb-0.5">{size.label}</span>
                          <span className="text-[9px] opacity-60">+{size.price/1000}k</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Sugar Levels */}
                <section>
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-black text-on-surface uppercase tracking-wide">Mức đường</h3>
                    <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-full">Tùy chọn</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sugarLevels.map((level: string) => (
                      <button
                        key={level}
                        onClick={() => setSelectedSugar(level)}
                        className={`px-5 py-2.5 rounded-full text-[11px] font-bold transition-all border ${
                          selectedSugar === level 
                          ? 'bg-primary text-white border-primary shadow-sm' 
                            : 'bg-surface-container-low text-stone-600 border-[#fed7aa]/60'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Toppings */}
                {toppings.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="text-sm font-black text-on-surface uppercase tracking-wide">Toppings</h3>
                      <span className="text-[10px] font-bold text-stone-400 px-2 py-0.5 bg-[#ffedd5]/55 rounded-full">Thêm</span>
                    </div>
                    <div className="space-y-2">
                      {toppings.map((topping: any) => {
                        const isActive = selectedToppings.includes(topping.name);
                        return (
                          <label 
                            key={topping.name}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                              isActive ? 'border-primary bg-primary/5' : 'border-[#fed7aa]/60 bg-surface'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded flex items-center justify-center transition-all border-2 ${
                                isActive ? 'bg-primary border-primary' : 'bg-surface border-[#fed7aa]/80'
                              }`}>
                                {isActive && <Check size={12} className="text-white" strokeWidth={4} />}
                              </div>
                              <span className={`text-sm font-bold ${isActive ? 'text-on-surface' : 'text-stone-600'}`}>{topping.name}</span>
                            </div>
                            <span className="text-xs font-black text-stone-400">+{topping.price/1000}k</span>
                            <input 
                              type="checkbox" 
                              className="hidden" 
                              checked={isActive}
                              onChange={() => toggleTopping(topping.name)}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-[#fed7aa]/60 bg-surface/95 backdrop-blur-md">
          {!sessionId && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 animate-in slide-in-from-bottom-2">
              <X size={14} className="text-red-500" />
              <p className="text-[10px] font-bold text-red-700">Chế độ xem: Vui lòng quét mã QR tại bàn để đặt món.</p>
            </div>
          )}
          <div className="flex items-center gap-4">
            {/* Quantity Selector */}
            <div className="flex items-center bg-surface-container-low rounded-full p-1 border border-[#fed7aa]/60">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-on-surface active:scale-90 transition-transform shadow-sm border border-[#fed7aa]/60"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-bold text-base">{quantity}</span>
              <button 
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-primary active:scale-90 transition-transform shadow-sm border border-[#fed7aa]/60"
              >
                <Plus size={16} />
              </button>
            </div>

            <Button 
              className="flex-1 bg-primary text-white font-black py-4 px-6 rounded-full flex items-center justify-center gap-4 shadow-lg shadow-primary/20 active:scale-[0.98] transition-all text-sm tracking-wide h-12"
              onClick={() => onAddToCart(product, quantity, { size: selectedSize, sugar: selectedSugar, toppings: selectedToppings })}
            >
              <span>Thêm vào giỏ hàng</span>
              <span className="font-black text-sm">{Intl.NumberFormat('vi-VN').format(calculateTotal())}đ</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
