import React, { useCallback, useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Gift, Sparkles } from 'lucide-react';
import { normalizeVnCustomerPhone } from '../lib/phoneUtils';

export function isDrinksLikeCategoryName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    /nước|đồ uống|trà |trà$|^trà|trà sữa|coffee|café|cà phê|ca phe|sinh tố|smoothie|nước ép|matcha|milk|sữa tươi|drink|juice|soda|bia|beer|chanh|mojito|yogurt|đá xay|macchiato|latte|espresso|trân châu|topping/i.test(
      lower,
    ) || /bubble|frappe|freeze/i.test(lower)
  );
}

type ProgramBrief = {
  rewardCount: number;
  hasActiveRewards: boolean;
  earnRuleLabel: string;
};

type Phase = 'ask' | 'form' | 'hidden';

export const LoyaltyDrinksNudge: React.FC<{
  merchantId: string;
  tablePadded: string;
  sessionId: string | null;
}> = ({ merchantId, tablePadded, sessionId }) => {
  const [brief, setBrief] = useState<ProgramBrief | null>(null);
  const [phase, setPhase] = useState<Phase>('ask');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const declineKey = `loyalty_declined_${merchantId}_${tablePadded}_${sessionId ?? ''}`;
  const optinKey = `loyalty_optin_${merchantId}_${sessionId ?? ''}`;

  useEffect(() => {
    if (!sessionId) {
      setPhase('hidden');
      return;
    }
    if (sessionStorage.getItem(declineKey) === '1') {
      setPhase('hidden');
      return;
    }
    if (localStorage.getItem(optinKey) === '1') {
      setPhase('hidden');
      return;
    }
    const savedSession = localStorage.getItem('guest_session_id');
    if (savedSession === sessionId) {
      setName(localStorage.getItem('guest_name') ?? '');
      setPhone(localStorage.getItem('guest_phone') ?? '');
    }
    void (async () => {
      try {
        const mid = encodeURIComponent(merchantId);
        const { data } = await api.get<ProgramBrief>(`/public/loyalty/${mid}/program`);
        setBrief(data);
      } catch {
        setBrief(null);
      }
    })();
  }, [merchantId, tablePadded, sessionId, declineKey, optinKey]);

  const saveOptIn = useCallback(() => {
    if (!sessionId) return;
    const n = name.trim();
    const raw = phone.trim();
    const canon = normalizeVnCustomerPhone(raw) ?? raw.replace(/\D/g, '');
    if (!n) {
      toast.error('Vui lòng nhập tên hiển thị.');
      return;
    }
    if (!canon || canon.length < 8) {
      toast.error('Nhập số điện thoại hợp lệ (ít nhất 8 số).');
      return;
    }
    localStorage.setItem('guest_session_id', sessionId);
    localStorage.setItem('guest_name', n);
    localStorage.setItem('guest_phone', canon);
    localStorage.setItem(optinKey, '1');
    setPhase('hidden');
    toast.success('Đã lưu — điểm sẽ ghi theo SĐT khi bạn thanh toán đơn.');
  }, [name, phone, sessionId, optinKey]);

  const onDecline = useCallback(() => {
    sessionStorage.setItem(declineKey, '1');
    setPhase('hidden');
  }, [declineKey]);

  if (!sessionId || phase === 'hidden') return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-amber-50/80 p-3.5 shadow-sm">
      <div className="flex items-start gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 border border-amber-200">
          <Gift className="text-amber-800" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          {phase === 'ask' && (
            <>
              <p className="text-xs font-black text-amber-950 leading-snug">
                Tích điểm &amp; đổi quà tại quán
              </p>
              <p className="text-[10px] font-medium text-stone-600 mt-1 leading-relaxed">
                {brief?.hasActiveRewards
                  ? `Quán đang có ${brief.rewardCount} phần quà đổi bằng điểm. ${brief.earnRuleLabel}`
                  : brief?.earnRuleLabel ?? 'Khi thanh toán đơn có ghi SĐT, bạn được cộng điểm để đổi quà theo chương trình của quán.'}
              </p>
              <p className="text-[10px] font-bold text-stone-700 mt-1.5">
                Bạn có muốn tham gia tích điểm không?
              </p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={onDecline}
                  className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border border-stone-300 text-stone-600 bg-white hover:bg-stone-50 active:scale-95 transition"
                >
                  Không, cảm ơn
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('form')}
                  className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-primary text-white shadow-sm hover:opacity-95 active:scale-95 transition flex items-center gap-1"
                >
                  <Sparkles size={12} />
                  Có, tham gia
                </button>
              </div>
            </>
          )}
          {phase === 'form' && (
            <>
              <p className="text-xs font-black text-amber-950">Nhập thông tin để tích điểm</p>
              <p className="text-[10px] text-stone-600 mt-0.5 leading-relaxed">
                Dùng cho đơn tại bàn này. Bạn vẫn có thể sửa trong giỏ trước khi gửi đơn.
              </p>
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  placeholder="Tên của bạn"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-xs font-bold text-stone-800 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-primary/25"
                />
                <input
                  type="tel"
                  placeholder="Số điện thoại"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-xs font-bold text-stone-800 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-primary/25"
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => setPhase('ask')}
                  className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-stone-500 border border-stone-200 bg-white"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={() => void saveOptIn()}
                  className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase bg-amber-700 text-white shadow-sm active:scale-95"
                >
                  Lưu thông tin
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
