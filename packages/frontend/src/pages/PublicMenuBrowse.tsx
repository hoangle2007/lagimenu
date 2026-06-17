import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, MapPin, Phone } from 'lucide-react';
import api from '../lib/api';

/**
 * Browse-only public menu at /menu/:shopId (no table; ordering via QR at table).
 */
export const PublicMenuBrowse: React.FC = () => {
  const { shopId } = useParams<{ shopId: string }>();
  const [loading, setLoading] = useState(true);
  const [merchantInfo, setMerchantInfo] = useState<Record<string, unknown> | null>(null);
  const [categories, setCategories] = useState<
    { id: number; name: string; products?: { id: number; name: string; price: string }[] }[]
  >([]);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      try {
        const menuRes = await api.get(`/menu/${shopId}`);
        if (cancelled) return;
        const m = menuRes.data?.merchant as Record<string, unknown> | undefined;
        setMerchantInfo(
          m
            ? {
                ...m,
                logoUrl: m.logoUrl || m.logo_url,
                bannerUrl: m.bannerUrl || m.banner_url,
              }
            : null,
        );
        setCategories(
          (menuRes.data?.categories ?? []).map((cat: { id: number; name: string; products?: unknown[] }) => ({
            ...cat,
            products: cat.products ?? [],
          })),
        );
      } catch {
        if (!cancelled) {
          setMerchantInfo(null);
          setCategories([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Đang tải thực đơn...</p>
      </div>
    );
  }

  if (!merchantInfo) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 text-center">
        <p className="font-bold text-stone-800">Không tìm thấy quán</p>
        <Link to="/" className="mt-4 text-primary font-bold text-sm">
          Về trang chủ
        </Link>
      </div>
    );
  }

  const name = String(merchantInfo.name ?? 'Menu');
  const logoUrl = merchantInfo.logoUrl as string | undefined;
  const address = merchantInfo.address as string | undefined;
  const phone = merchantInfo.phone as string | undefined;

  return (
    <div className="max-w-lg mx-auto bg-stone-50 min-h-screen pb-12">
      <header className="bg-surface sticky top-0 z-10 px-4 py-4 border-b border-stone-100 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary/10" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-black text-stone-900 truncate">{name}</h1>
          <p className="text-[11px] text-stone-500 font-medium mt-0.5">Xem thực đơn — đặt món tại bàn qua mã QR</p>
        </div>
      </header>

      {(address || phone) && (
        <div className="mx-4 mt-4 p-3 bg-surface rounded-2xl border border-stone-100 text-xs space-y-2">
          {address && (
            <div className="flex items-start gap-2 text-stone-600">
              <MapPin size={14} className="text-primary flex-shrink-0 mt-0.5" />
              <span>{address}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2 text-stone-600">
              <Phone size={14} className="text-primary flex-shrink-0" />
              <a href={`tel:${phone}`} className="font-bold text-primary">
                {phone}
              </a>
            </div>
          )}
        </div>
      )}

      <div className="px-4 mt-6 space-y-8">
        {categories.map((cat) => (
          <section key={cat.id}>
            <h2 className="text-base font-black text-stone-900 mb-3">{cat.name}</h2>
            <ul className="space-y-2">
              {(cat.products ?? []).map((p) => (
                <li
                  key={p.id}
                  className="bg-surface rounded-2xl p-4 border border-stone-100 flex justify-between items-center gap-3"
                >
                  <span className="font-bold text-stone-800 text-sm">{p.name}</span>
                  <span className="text-primary font-black text-sm whitespace-nowrap">
                    {Intl.NumberFormat('vi-VN').format(Math.round(Number(p.price) || 0))}₫
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
};
