import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Gift, Loader2, PartyPopper, AlertTriangle, CheckCircle2, X, Sparkles } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import axios from 'axios';
import { normalizeVnCustomerPhone } from '../lib/phoneUtils';

/** Gợi ý trạng thái đổi quà cho khách (sau khi đã tra cứu điểm). */
export type RewardRedeemHint =
  | { mode: 'lookup' }
  | { mode: 'ready' }
  | { mode: 'nearly'; gap: number }
  | { mode: 'need'; gap: number };

export function getRewardRedeemHint(
  points: number | null,
  cost: number,
): RewardRedeemHint {
  if (points === null || !Number.isFinite(cost) || cost <= 0) return { mode: 'lookup' };
  if (points >= cost) return { mode: 'ready' };
  const gap = cost - points;
  const nearlyThreshold = Math.max(5, Math.ceil(cost * 0.2));
  if (gap <= nearlyThreshold) return { mode: 'nearly', gap };
  return { mode: 'need', gap };
}

export type LoyaltyTxRow = {
  id: number;
  delta_points: number;
  reason: string;
  note?: string | null;
  reward_title?: string | null;
  created_at: string;
};

export type LoyaltyRewardRow = {
  id: number;
  title: string;
  description: string | null;
  pointsCost: number;
  imageUrl?: string | null;
  highlightLabel?: string | null;
  productId?: number | null;
  productName?: string | null;
};

type Props = {
  merchantId: string;
  /** Số bàn / mã bàn (URL) — gửi kèm API để quầy thấy trong thông báo */
  tableNumberHint?: string | null;
  sessionId?: string | null;
};

export type LoyaltyCustomerPopup =
  | {
      variant: 'lookup_success';
      points: number;
      earnRule: string | null;
      redeemableTitles: string[];
      nearlyLines: string[];
      rewardCount: number;
    }
  | { variant: 'lookup_fail'; message: string }
  | {
      variant: 'redeem_success';
      rewardTitle: string;
      cost: number;
      balanceAfter: number;
    }
  | { variant: 'redeem_fail'; message: string }
  | { variant: 'insufficient'; have: number; need: number; rewardTitle: string };

function LoyaltyPopupPortal({
  popup,
  onClose,
}: {
  popup: LoyaltyCustomerPopup;
  onClose: () => void;
}) {
  if (typeof document === 'undefined') return null;

  const shell = (
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center sm:items-center p-4 bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border-2 border-amber-200 bg-gradient-to-b from-amber-50 to-surface shadow-2xl p-5 animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {popup.variant === 'lookup_success' && (
              <CheckCircle2 className="text-emerald-600 shrink-0" size={26} aria-hidden />
            )}
            {popup.variant === 'redeem_success' && (
              <PartyPopper className="text-amber-600 shrink-0" size={26} aria-hidden />
            )}
            {(popup.variant === 'lookup_fail' ||
              popup.variant === 'redeem_fail' ||
              popup.variant === 'insufficient') && (
              <AlertTriangle className="text-amber-700 shrink-0" size={26} aria-hidden />
            )}
            <h3 className="text-base font-black text-amber-950 leading-tight">
              {popup.variant === 'lookup_success' && 'Tra cứu thành công'}
              {popup.variant === 'lookup_fail' && 'Không tra cứu được'}
              {popup.variant === 'redeem_success' && 'Đổi quà thành công'}
              {popup.variant === 'redeem_fail' && 'Chưa đổi được quà'}
              {popup.variant === 'insufficient' && 'Chưa đủ điểm'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-stone-500 hover:bg-amber-100 hover:text-stone-800 shrink-0"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {popup.variant === 'lookup_success' && (
          <div className="space-y-3 text-sm">
            <p className="font-black text-2xl text-amber-950 tabular-nums">{popup.points} điểm</p>
            {popup.earnRule ? (
              <p className="text-[11px] font-semibold text-amber-900/90 leading-snug">{popup.earnRule}</p>
            ) : null}
            {popup.rewardCount > 0 ? (
              <p className="text-[11px] font-medium text-stone-600">
                Đang có <span className="font-black text-stone-800">{popup.rewardCount}</span> phần quà trong chương
                trình.
              </p>
            ) : null}
            {popup.redeemableTitles.length > 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase text-emerald-800 mb-1 flex items-center gap-1">
                  <Sparkles size={12} /> Đổi ngay được
                </p>
                <ul className="text-[11px] font-bold text-emerald-950 space-y-1 list-disc pl-4">
                  {popup.redeemableTitles.slice(0, 6).map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {popup.nearlyLines.length > 0 ? (
              <div className="rounded-xl border border-amber-300/80 bg-amber-100/50 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase text-amber-900 mb-1">Sắp đủ điểm</p>
                <ul className="text-[11px] font-semibold text-amber-950 space-y-1.5 leading-snug">
                  {popup.nearlyLines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {popup.redeemableTitles.length === 0 && popup.nearlyLines.length === 0 && popup.rewardCount > 0 ? (
              <p className="text-[11px] font-medium text-stone-600">
                Tiếp tục tích điểm khi thanh toán — chạm phần quà bên dưới để xem cần thêm bao nhiêu điểm.
              </p>
            ) : null}
          </div>
        )}

        {popup.variant === 'lookup_fail' && (
          <p className="text-sm font-medium text-stone-700 leading-relaxed">{popup.message}</p>
        )}

        {popup.variant === 'redeem_success' && (
          <div className="space-y-2 text-sm">
            <p className="font-bold text-stone-800">
              Bạn đã đổi: <span className="text-amber-900 font-black">{popup.rewardTitle}</span>
            </p>
            <p className="text-[11px] text-stone-600">
              Đã trừ <span className="font-black tabular-nums text-red-700">−{popup.cost}</span> điểm · Số dư còn{' '}
              <span className="font-black tabular-nums text-emerald-700">{popup.balanceAfter}</span> điểm.
            </p>
            <p className="text-[11px] font-semibold text-amber-900/90 leading-snug border-t border-amber-100 pt-2 mt-2">
              Quầy đã nhận thông báo — nhờ nhân viên xác nhận và giao phần quà tại quầy.
            </p>
          </div>
        )}

        {popup.variant === 'redeem_fail' && (
          <p className="text-sm font-medium text-stone-700 leading-relaxed">{popup.message}</p>
        )}

        {popup.variant === 'insufficient' && (
          <div className="space-y-2 text-sm">
            <p className="font-bold text-stone-800">
              Phần quà: <span className="text-amber-950">{popup.rewardTitle}</span>
            </p>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              Bạn đang có <span className="font-black tabular-nums">{popup.have}</span> điểm, cần thêm{' '}
              <span className="font-black tabular-nums text-amber-900">{popup.need - popup.have}</span> điểm nữa (cần{' '}
              <span className="font-black tabular-nums">{popup.need}</span> điểm để đổi).
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-amber-500 py-2.5 text-xs font-black uppercase tracking-wide text-amber-950 hover:bg-amber-600 transition-colors"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );

  return createPortal(shell, document.body);
}

/**
 * Khối tra cứu SĐT → điểm, lịch sử, đổi quà (API public loyalty đã có sẵn).
 */
export const CustomerLoyaltyLookupPanel: React.FC<Props> = ({
  merchantId,
  tableNumberHint,
  sessionId,
}) => {
  const [phoneInput, setPhoneInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const [earnRule, setEarnRule] = useState<string | null>(null);
  const [tx, setTx] = useState<LoyaltyTxRow[]>([]);
  const [rewards, setRewards] = useState<LoyaltyRewardRow[]>([]);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [popup, setPopup] = useState<LoyaltyCustomerPopup | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    let cancelled = false;
    void (async () => {
      try {
        const mid = encodeURIComponent(merchantId);
        const { data } = await api.get(`/public/loyalty/${mid}/rewards`);
        if (!cancelled) setRewards(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setRewards([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  const runLookup = useCallback(async (opts?: { suppressSuccessPopup?: boolean }) => {
    const raw = phoneInput.trim();
    const phone = normalizeVnCustomerPhone(raw) ?? raw.replace(/\D/g, '');
    if (!phone || phone.length < 8) {
      toast.error('Nhập số điện thoại hợp lệ (ít nhất 8 chữ số).');
      return;
    }
    setLookupLoading(true);
    try {
      const mid = encodeURIComponent(merchantId);
      const [accRes, txRes, rwRes] = await Promise.all([
        api.get(`/public/loyalty/${mid}/account`, { params: { phone } }),
        api.get(`/public/loyalty/${mid}/transactions`, { params: { phone, limit: 20 } }),
        api.get(`/public/loyalty/${mid}/rewards`),
      ]);
      const newPoints = Number(accRes.data?.points ?? 0);
      const er = typeof accRes.data?.earnRuleLabel === 'string' ? accRes.data.earnRuleLabel : null;
      const rwList: LoyaltyRewardRow[] = Array.isArray(rwRes.data) ? rwRes.data : [];

      const redeemableTitles = rwList
        .filter((r) => getRewardRedeemHint(newPoints, r.pointsCost).mode === 'ready')
        .map((r) => r.title);
      const nearlyLines = rwList
        .map((r) => {
          const h = getRewardRedeemHint(newPoints, r.pointsCost);
          if (h.mode !== 'nearly') return null;
          return `Chỉ còn ${h.gap} điểm để đổi ${r.title}.`;
        })
        .filter((s): s is string => Boolean(s))
        .slice(0, 5);

      setPhoneInput(phone);
      setPoints(newPoints);
      setEarnRule(er);
      setTx(Array.isArray(txRes.data) ? txRes.data : []);
      if (rwList.length > 0) {
        setRewards(rwList);
      }

      if (!opts?.suppressSuccessPopup) {
        setPopup({
          variant: 'lookup_success',
          points: newPoints,
          earnRule: er,
          redeemableTitles,
          nearlyLines,
          rewardCount: rwList.length,
        });
      }
    } catch {
      const msg = 'Không tra cứu được. Kiểm tra mạng hoặc thử lại sau.';
      toast.error(msg);
      setPopup({ variant: 'lookup_fail', message: msg });
      setPoints(null);
      setEarnRule(null);
      setTx([]);
      setRewards([]);
    } finally {
      setLookupLoading(false);
    }
  }, [merchantId, phoneInput]);

  const redeemReward = useCallback(
    async (rewardId: number, cost: number) => {
      const phone =
        normalizeVnCustomerPhone(phoneInput.trim()) ?? phoneInput.replace(/\D/g, '');
      if (!phone || phone.length < 8) {
        toast.error('Nhập và tra cứu SĐT trước khi đổi quà.');
        return;
      }
      if (points != null && points < cost) {
        const msg = 'Chưa đủ điểm để đổi phần quà này.';
        toast.error(msg);
        setPopup({
          variant: 'insufficient',
          have: points,
          need: cost,
          rewardTitle:
            rewards.find((r) => r.id === rewardId)?.title ?? 'Phần quà đã chọn',
        });
        return;
      }
      setRedeemingId(rewardId);
      const rewardTitle = rewards.find((r) => r.id === rewardId)?.title ?? 'Quà';
      try {
        const mid = encodeURIComponent(merchantId);
        const body: {
          phone: string;
          rewardId: number;
          tableNumber?: string;
          sessionId?: string;
        } = { phone, rewardId };
        const tn = tableNumberHint?.trim();
        if (tn) body.tableNumber = tn;
        const sid = sessionId?.trim();
        if (sid) body.sessionId = sid;
        const { data } = await api.post<{
          points?: number;
          rewardTitle?: string;
        }>(`/public/loyalty/${mid}/redeem`, body);
        const balanceAfter = Number(data?.points ?? 0);
        const title = typeof data?.rewardTitle === 'string' ? data.rewardTitle : rewardTitle;
        setPopup({
          variant: 'redeem_success',
          rewardTitle: title,
          cost,
          balanceAfter,
        });
        toast.success('Đã đổi quà — xem chi tiết trong cửa sổ vừa hiện.');
        await runLookup({ suppressSuccessPopup: true });
      } catch (error: unknown) {
        const msg = axios.isAxiosError(error)
          ? (error.response?.data as { message?: string })?.message
          : null;
        const text = typeof msg === 'string' ? msg : 'Không đổi được quà. Thử lại sau.';
        toast.error(text);
        setPopup({ variant: 'redeem_fail', message: text });
      } finally {
        setRedeemingId(null);
      }
    },
    [merchantId, phoneInput, points, rewards, runLookup, sessionId, tableNumberHint],
  );

  return (
    <div className="space-y-4">
      {popup ? <LoyaltyPopupPortal popup={popup} onClose={() => setPopup(null)} /> : null}
      <p className="text-xs font-medium text-stone-600 leading-relaxed">
        Xem quà bên dưới bất cứ lúc nào. Tra cứu SĐT để thấy điểm hiện có, nhãn <span className="font-bold text-emerald-700">Đổi ngay</span> hoặc dòng gợi ý kiểu{' '}
        <span className="font-bold text-amber-900">Chỉ còn X điểm để đổi…</span> khi bạn gần đủ điểm. Nhân viên xác nhận phần quà tại quầy.
      </p>
      <div className="flex gap-2">
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="VD: 0912..."
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          className="flex-1 rounded-xl border-2 border-yellow-200 bg-white px-3 py-2.5 text-sm font-bold text-stone-900 outline-none focus:border-yellow-400"
        />
        <button
          type="button"
          onClick={() => void runLookup()}
          disabled={lookupLoading}
          className="shrink-0 rounded-xl bg-yellow-500 px-4 py-2 text-xs font-black text-yellow-950 hover:bg-yellow-600 disabled:opacity-50 inline-flex items-center justify-center min-w-[5.5rem]"
        >
          {lookupLoading ? <Loader2 className="animate-spin" size={18} /> : 'Tra cứu'}
        </button>
      </div>
      {points !== null && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/80 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Gift className="text-amber-700" size={22} />
            <div>
              <p className="text-[10px] font-bold uppercase text-amber-800/80">Điểm hiện có</p>
              <p className="text-2xl font-black text-amber-950 tabular-nums">{points}</p>
              {earnRule ? (
                <p className="text-[10px] font-medium text-amber-900/80 mt-1 leading-snug">{earnRule}</p>
              ) : null}
            </div>
          </div>
          {tx.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-stone-500 uppercase mb-1">Giao dịch gần đây</p>
              <ul className="max-h-32 overflow-y-auto space-y-1.5 text-[11px]">
                {tx.map((t) => {
                  const label =
                    t.note?.trim() ||
                    (t.reason === 'redeem' && t.reward_title
                      ? `Đổi: ${t.reward_title}`
                      : t.reason === 'order_paid'
                        ? 'Tích điểm từ đơn'
                        : t.reason === 'manual_adjust'
                          ? 'Điều chỉnh tại quầy'
                          : t.reason);
                  const when = t.created_at
                    ? new Date(t.created_at).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '';
                  return (
                    <li
                      key={t.id}
                      className="flex justify-between gap-2 text-stone-700 border-b border-amber-100/80 pb-1 last:border-0"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{label}</span>
                        {when ? (
                          <span className="text-[9px] font-medium text-stone-400">{when}</span>
                        ) : null}
                      </span>
                      <span
                        className={
                          t.delta_points >= 0
                            ? 'text-emerald-700 font-black shrink-0 tabular-nums'
                            : 'text-red-600 font-black shrink-0 tabular-nums'
                        }
                      >
                        {t.delta_points >= 0 ? '+' : ''}
                        {t.delta_points}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {rewards.length > 0 ? (
        <div className={points !== null ? 'rounded-2xl border-2 border-amber-200/80 bg-amber-50/40 p-4 space-y-2' : ''}>
          <div className="flex items-baseline justify-between gap-2 px-0.5">
            <p className="text-[10px] font-black text-stone-500 uppercase">Đổi quà</p>
            {points === null ? (
              <span className="text-[9px] font-bold text-stone-500 text-right max-w-[11rem] leading-tight">
                {'Tra cứu SĐT — ví dụ: "Chỉ còn 12 điểm để đổi trà sữa miễn phí"'}
              </span>
            ) : null}
          </div>
          <div className="grid gap-2">
            {rewards.map((rw) => {
              const hint = getRewardRedeemHint(points, rw.pointsCost);
              const canRedeem = hint.mode === 'ready' && redeemingId !== rw.id;
              const busy = redeemingId === rw.id;
              const lockedNearly = !canRedeem && !busy && hint.mode === 'nearly';
              return (
                <button
                  key={rw.id}
                  type="button"
                  disabled={busy || !canRedeem}
                  onClick={() => void redeemReward(rw.id, rw.pointsCost)}
                  className={`text-left rounded-xl border p-2.5 transition flex gap-3 ${
                    canRedeem
                      ? 'border-emerald-300 bg-white hover:border-emerald-400 hover:shadow-sm ring-1 ring-emerald-100/80'
                      : lockedNearly
                        ? 'border-amber-200 bg-amber-50/50 ring-1 ring-amber-100/80 cursor-not-allowed'
                        : 'border-amber-100 bg-white/90 opacity-[0.92] cursor-not-allowed'
                  }`}
                >
                  {rw.imageUrl ? (
                    <img
                      src={rw.imageUrl}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover border border-amber-100 shrink-0 bg-amber-50"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 border border-amber-200">
                      <Gift className="text-amber-700" size={22} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-black text-stone-900">{rw.title}</span>
                      {hint.mode === 'ready' ? (
                        <span className="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow-sm">
                          Đổi ngay
                        </span>
                      ) : null}
                      {rw.highlightLabel ? (
                        <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-red-500 text-white">
                          {rw.highlightLabel}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs font-black text-amber-800">{rw.pointsCost} điểm</span>
                    {rw.description ? (
                      <p className="text-[10px] text-stone-500 mt-0.5 line-clamp-2">{rw.description}</p>
                    ) : null}
                    {rw.productName ? (
                      <p className="text-[10px] font-bold text-emerald-800 mt-0.5">Món: {rw.productName}</p>
                    ) : null}
                    {busy ? (
                      <div className="flex justify-end mt-1">
                        <Loader2 className="animate-spin text-amber-700" size={16} />
                      </div>
                    ) : hint.mode === 'lookup' ? (
                      <p className="text-[10px] font-bold text-stone-500 mt-1.5">
                        Tra cứu điểm phía trên để biết còn thiếu bao nhiêu
                      </p>
                    ) : hint.mode === 'ready' ? (
                      <p className="text-[10px] font-bold text-emerald-700 mt-1.5">Chạm để đổi — đủ điểm</p>
                    ) : hint.mode === 'nearly' ? (
                      <p className="text-[11px] font-bold text-amber-950 mt-1.5 leading-snug">
                        Chỉ còn{' '}
                        <span className="tabular-nums text-amber-800">{hint.gap}</span> điểm để đổi{' '}
                        <span className="font-black text-amber-950">{rw.title}</span>.
                      </p>
                    ) : (
                      <p className="text-[10px] font-bold text-stone-600 mt-1.5 leading-snug">
                        Cần thêm <span className="tabular-nums font-black text-stone-800">{hint.gap}</span> điểm để
                        đổi <span className="font-black text-stone-800">{rw.title}</span>.
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : points !== null ? (
        <p className="text-[11px] text-stone-500 font-medium px-1">
          Quán chưa cập nhật danh sách quà đổi.
        </p>
      ) : null}
    </div>
  );
};
