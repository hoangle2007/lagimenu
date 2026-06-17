import React, { useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from './ui';
import { Copy, X, Wifi, QrCode, Keyboard } from 'lucide-react';

const POPUP_KEY = 'wifi_popup_shown';

type Props = {
  wifiSsid: string | null | undefined;
  wifiPassword: string | null | undefined;
};

export const WifiWelcomeModal: React.FC<Props> = ({ wifiSsid, wifiPassword }) => {
  const [dismissed, setDismissed] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(POPUP_KEY) === '1',
  );
  const [tab, setTab] = useState<'qr' | 'manual'>('qr');
  const [copied, setCopied] = useState<'ssid' | 'pass' | null>(null);

  const open = !!wifiSsid?.trim() && !dismissed;

  const dismiss = () => {
    sessionStorage.setItem(POPUP_KEY, '1');
    setDismissed(true);
  };

  const copy = (text: string, kind: 'ssid' | 'pass') => {
    void navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  };

  if (!wifiSsid?.trim()) return null;

  const ssid = wifiSsid.trim();
  const pass = wifiPassword?.trim() ?? '';
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
    `WIFI:T:WPA;S:${ssid};P:${pass};;`,
  )}&size=280x280&margin=10&color=0f172a`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden border-0 shadow-2xl shadow-slate-900/25 rounded-[1.75rem] bg-[#fff7ed]">
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 px-6 pt-6 pb-16 text-white">
          <button
            type="button"
            aria-label="Đóng"
            className="absolute right-4 top-4 rounded-full p-2 text-white/80 hover:bg-surface/10 hover:text-white transition-colors"
            onClick={dismiss}
          >
            <X size={20} />
          </button>
          <DialogHeader className="space-y-1 text-left pr-10">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface/15 ring-1 ring-white/20 mb-3">
              <Wifi size={22} className="text-emerald-300" strokeWidth={2} />
            </div>
            <DialogTitle className="text-xl font-black tracking-tight text-white leading-tight">
              Kết nối WiFi miễn phí
            </DialogTitle>
            <p className="text-sm text-slate-300 font-medium leading-snug">
              Quét mã hoặc nhập thủ công để vào mạng quán.
            </p>
          </DialogHeader>
        </div>

        <div className="-mt-10 mx-4 mb-4 rounded-2xl bg-[#fff7ed] p-1.5 shadow-lg shadow-slate-900/10 ring-1 ring-[#fed7aa]/70">
          <div className="flex rounded-xl bg-[#ffedd5]/55 p-1">
            <button
              type="button"
              onClick={() => setTab('qr')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all ${
                tab === 'qr'
                  ? 'bg-[#fff7ed] text-slate-900 shadow-sm ring-1 ring-[#fed7aa]/70'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <QrCode size={18} strokeWidth={2} />
              Quét mã QR
            </button>
            <button
              type="button"
              onClick={() => setTab('manual')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all ${
                tab === 'manual'
                  ? 'bg-[#fff7ed] text-slate-900 shadow-sm ring-1 ring-[#fed7aa]/70'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Keyboard size={18} strokeWidth={2} />
              Nhập thủ công
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 pt-0">
          {tab === 'qr' ? (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-3xl bg-gradient-to-b from-[#fff7ed] to-[#ffedd5] p-5 ring-1 ring-[#fed7aa]/70 shadow-inner">
                <div className="rounded-2xl bg-[#fff7ed] p-3 shadow-md ring-1 ring-[#fed7aa]/60">
                  <img src={qrSrc} alt="Mã QR WiFi" width={240} height={240} className="rounded-xl" />
                </div>
              </div>
              <p className="text-center text-xs text-slate-500 font-medium max-w-[280px] leading-relaxed">
                Mở <strong className="text-slate-700">Camera</strong> hoặc{' '}
                <strong className="text-slate-700">Cài đặt → Wi‑Fi</strong> trên điện thoại và quét mã.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#fed7aa]/60 bg-[#ffedd5]/40 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Tên mạng (SSID)</p>
                <div className="flex gap-2 items-stretch">
                  <code className="flex-1 text-sm font-mono font-semibold text-slate-800 break-all self-center py-1">
                    {ssid}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 rounded-xl border-[#fed7aa]/70"
                    onClick={() => copy(ssid, 'ssid')}
                  >
                    <Copy size={14} className="mr-1" />
                    {copied === 'ssid' ? 'Đã chép' : 'Sao chép'}
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border border-[#fed7aa]/60 bg-[#ffedd5]/40 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Mật khẩu</p>
                <div className="flex gap-2 items-stretch">
                  <code className="flex-1 text-sm font-mono font-semibold text-slate-800 break-all self-center py-1">
                    {pass || '—'}
                  </code>
                  {pass ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 rounded-xl border-[#fed7aa]/70"
                      onClick={() => copy(pass, 'pass')}
                    >
                      <Copy size={14} className="mr-1" />
                      {copied === 'pass' ? 'Đã chép' : 'Sao chép'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            className="w-full mt-6 h-11 rounded-xl font-bold text-slate-600"
            onClick={dismiss}
          >
            Đã hiểu, đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
