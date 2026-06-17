import { PosTab } from '../merchant/PosTab';
import { useAuth } from '@/hooks/useAuth';
import { useMerchantSocket } from '@/hooks/useMerchantSocket';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';
import { VietnameseSpeechBanner } from '@/components/VietnameseSpeechBanner';
import { warmUpVietnameseSpeech, speakVietnamese } from '@/lib/speechVi';
import { vi } from '@/locales/vi';
import { Volume2, WifiOff, Loader2, X, Gift } from 'lucide-react';
import { useState } from 'react';

function AudioUnlockModal({ onUnlock }: { onUnlock: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md text-center p-8 bg-slate-900 border-slate-800 text-white rounded-3xl">
        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Volume2 size={40} className="text-primary animate-pulse" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-white">Kích hoạt thông báo</DialogTitle>
        </DialogHeader>
        <p className="text-slate-400 font-medium my-6">
          Nhấn nút bên dưới để bật âm thanh báo đơn mới và giọng nói cho trình duyệt.
        </p>
        <Button
          className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-xl shadow-primary/20 text-lg"
          onClick={() => { setOpen(false); onUnlock(); }}
        >
          Sẵn sàng phục vụ!
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function EmployeePosTab() {
  const { user } = useAuth();
  const shopId = user?.shop?.id || (user as any)?.shopId || '';

  const {
    socketStatus,
    activeCallStaff,
    activeCallPayment,
    activeLoyaltyRedeems,
    activeReadyOrders,
    newOrderNotify,
    clearOrderNotify,
    clearCallStaff,
    clearCallPayment,
    clearLoyaltyRedeem,
    clearReadyOrder,
  } = useMerchantSocket(shopId);

  const [isAudioUnlocked, setIsAudioUnlocked] = useState(() => {
    return localStorage.getItem('audio_unlocked') === 'true';
  });

  const unlockAudio = () => {
    setIsAudioUnlocked(true);
    localStorage.setItem('audio_unlocked', 'true');
    warmUpVietnameseSpeech();
    speakVietnamese(vi.tts.dashboardWarmup, {
      onMissingVietnameseVoice: () =>
        window.dispatchEvent(new CustomEvent('speech-vi-missing')),
    });
    // Dummy play to unlock AudioContext on iOS/Safari
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0;
    audio.play().catch(() => {});
  };

  // Collect active notifications for display
  const hasNotifications =
    activeCallStaff.length > 0 ||
    activeCallPayment.length > 0 ||
    activeLoyaltyRedeems.length > 0 ||
    activeReadyOrders.length > 0 ||
    newOrderNotify !== null;

  return (
    <div className="relative h-full">
      {/* Audio Unlock Modal */}
      {!isAudioUnlocked && <AudioUnlockModal onUnlock={unlockAudio} />}

      {/* Socket Status Indicator */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-1.5 bg-surface/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg">
        {socketStatus === 'connected' ? (
          <>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Live</span>
          </>
        ) : socketStatus === 'connecting' ? (
          <>
            <Loader2 size={12} className="text-amber-500 animate-spin" />
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Đang kết nối...</span>
          </>
        ) : (
          <>
            <WifiOff size={12} className="text-red-500" />
            <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Offline</span>
          </>
        )}
      </div>

      {isAudioUnlocked && (
        <div className="absolute top-[3.25rem] left-4 right-4 z-[35] max-w-xl pointer-events-auto">
          <VietnameseSpeechBanner />
        </div>
      )}

      {/* Notification Overlays — top of product grid */}
      {hasNotifications && (
        <div className="absolute top-16 left-4 right-4 z-30 flex flex-col gap-2">
          {/* New Order */}
          {newOrderNotify && (
            <div className="flex items-center gap-3 bg-violet-500 text-white rounded-2xl px-4 py-3 shadow-xl animate-in slide-in-from-top-2">
              <div className="w-10 h-10 bg-surface/20 rounded-xl flex items-center justify-center font-black text-lg">
                {newOrderNotify.tableNumber}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm leading-none">Đơn mới vừa tới!</p>
                <p className="text-[10px] font-bold text-white/70 mt-0.5">
                  {Intl.NumberFormat('vi-VN').format(+newOrderNotify.totalPrice)}đ
                </p>
              </div>
              <button onClick={clearOrderNotify} className="w-8 h-8 rounded-full bg-surface/20 flex items-center justify-center hover:bg-surface/30 transition-colors">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Staff Call */}
          {activeCallStaff.map((call, idx) => (
            <div key={`staff-${idx}`} className="flex items-center gap-3 bg-red-500 text-white rounded-2xl px-4 py-3 shadow-xl animate-in slide-in-from-top-2">
              <div className="w-10 h-10 bg-surface/20 rounded-xl flex items-center justify-center font-black text-lg">
                {call.tableNumber}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm leading-none">CẦN HỖ TRỢ</p>
                <p className="text-[10px] font-bold text-white/70 mt-0.5">GỌI NHÂN VIÊN</p>
              </div>
              <button
                onClick={() => clearCallStaff(call.tableNumber)}
                className="px-3 h-8 rounded-xl bg-surface/20 font-black text-[10px] uppercase tracking-widest hover:bg-surface/30 transition-colors"
              >
                Đã xử lý
              </button>
            </div>
          ))}

          {/* Payment Request */}
          {activeCallPayment.map((call, idx) => {
            const tier = call.loyaltyPaymentMethod
              ? 'loyalty'
              : call.paymentPreference
                ? 'pref'
                : 'bill';
            const bg =
              tier === 'loyalty'
                ? 'bg-violet-600'
                : tier === 'pref'
                  ? 'bg-sky-600'
                  : 'bg-emerald-500';
            const line1 =
              tier === 'loyalty'
                ? 'TÍCH ĐIỂM'
                : tier === 'pref'
                  ? 'GỌI TT'
                  : 'THANH TOÁN';
            const line2 =
              call.loyaltyPaymentMethod === 'bank_qr'
                ? 'QR NGÂN HÀNG'
                : call.loyaltyPaymentMethod === 'at_table'
                  ? 'THU NGÂN TẠI BÀN'
                  : call.paymentPreference === 'bank_qr'
                    ? 'QR NGÂN HÀNG'
                    : call.paymentPreference === 'at_table'
                      ? 'THU NGÂN TẠI BÀN'
                      : 'YÊU CẦU BILL';
            return (
            <div
              key={`pay-${idx}`}
              className={`flex items-center gap-3 text-white rounded-2xl px-4 py-3 shadow-xl animate-in slide-in-from-top-2 ${bg}`}
            >
              <div className="w-10 h-10 bg-surface/20 rounded-xl flex items-center justify-center font-black text-lg">
                {call.tableNumber}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm leading-none">
                  {line1}
                </p>
                <p className="text-[10px] font-bold text-white/70 mt-0.5">
                  {line2}
                </p>
              </div>
              <button
                onClick={() => clearCallPayment(call.tableNumber)}
                className="px-3 h-8 rounded-xl bg-surface/20 font-black text-[10px] uppercase tracking-widest hover:bg-surface/30 transition-colors"
              >
                Xác nhận
              </button>
            </div>
            );
          })}

          {activeLoyaltyRedeems.map((r) => (
            <div
              key={`loyre-${r.transactionId}`}
              className="flex items-center gap-3 bg-amber-600 text-white rounded-2xl px-4 py-3 shadow-xl animate-in slide-in-from-top-2"
            >
              <div className="w-10 h-10 bg-surface/20 rounded-xl flex items-center justify-center">
                <Gift size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm leading-none">ĐỔI QUÀ</p>
                <p className="text-[10px] font-bold text-white/80 mt-0.5 truncate">
                  {r.tableNumber !== '—' ? `Bàn ${r.tableNumber} · ` : ''}
                  {r.rewardTitle} (−{r.pointsCost} điểm) · *{r.customerPhoneLast4}
                </p>
              </div>
              <button
                type="button"
                onClick={() => clearLoyaltyRedeem(r.transactionId)}
                className="px-3 h-8 rounded-xl bg-surface/20 font-black text-[10px] uppercase tracking-widest hover:bg-surface/30 transition-colors shrink-0"
              >
                Đã giao
              </button>
            </div>
          ))}

          {/* Ready to Serve */}
          {activeReadyOrders.map((order, idx) => (
            <div key={`ready-${idx}`} className="flex items-center gap-3 bg-amber-500 text-white rounded-2xl px-4 py-3 shadow-xl animate-in slide-in-from-top-2">
              <div className="w-10 h-10 bg-surface/20 rounded-xl flex items-center justify-center font-black text-lg">
                {order.tableNumber}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm leading-none">MANG ĐƠN RA!</p>
                <p className="text-[10px] font-bold text-white/70 mt-0.5">Món đã nấu xong</p>
              </div>
              <button
                onClick={() => clearReadyOrder(order.tableNumber)}
                className="px-3 h-8 rounded-xl bg-surface/20 font-black text-[10px] uppercase tracking-widest hover:bg-surface/30 transition-colors"
              >
                OK
              </button>
            </div>
          ))}
        </div>
      )}

      {/* POS Tab */}
      <PosTab
        merchantId={shopId}
        merchantName={`${user?.name || 'Nhân Viên'}`}
        backUrl="/employee"
      />
    </div>
  );
}