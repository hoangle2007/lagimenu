import React from 'react';
import { Printer, UtensilsCrossed, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from '../../components/ui';

interface QRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchantId: string;
  merchantName: string;
  merchantSlogan?: string;
  merchantLogo?: string;
  tableCount: number;
  tableTokens?: Record<string, string>;
}

const QR_API = (url: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&margin=10&color=006d37`;

export const QRPrintModal: React.FC<QRPrintModalProps> = ({
  isOpen, onClose, merchantId, merchantName, merchantSlogan, merchantLogo, tableCount, tableTokens
}) => {
  const baseUrl = window.location.origin;
  const tableUrl = (t: number) => {
    const tableNum = String(t).padStart(2, '0');
    const token = tableTokens?.[tableNum];
    return `${baseUrl}/m/${merchantId}/t/${tableNum}${token ? `?token=${token}` : ''}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none rounded-[2.5rem] shadow-2xl bg-surface-container-low flex flex-col h-[90vh]">
        <DialogHeader className="p-8 bg-surface border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-2xl font-black text-on-surface tracking-tight">Thiết kế mã QR đặt món</DialogTitle>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Xuất bản ấn phẩm chuyên nghiệp cho từng bàn</p>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" className="rounded-xl h-12 px-6 border-slate-200 text-slate-500 font-bold" onClick={onClose}>Huỷ bỏ</Button>
             <Button className="rounded-xl h-12 px-8 shadow-xl shadow-primary/20 font-black flex items-center gap-2" onClick={handlePrint}>
                <Printer size={18} /> In tất cả
             </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-12 no-scrollbar bg-[#f8fafc]">
          <div id="qr-print-container" className="grid grid-cols-1 sm:grid-cols-2 gap-12 max-w-4xl mx-auto items-center">
            {Array.from({ length: tableCount }, (_, i) => i + 1).map(t => (
              <div 
                key={t} 
                className="qr-card relative bg-surface w-full max-w-[320px] mx-auto aspect-[3/4.5] rounded-[3rem] shadow-2xl border-[12px] border-white ring-1 ring-slate-100 flex flex-col overflow-hidden"
              >
                {/* Decorative Head */}
                <div className="h-24 bg-primary flex items-center justify-center relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                   <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -ml-12 -mb-12" />
                   
                   <div className="flex flex-col items-center">
                      <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mb-1">STT BÀN</p>
                      <h4 className="text-4xl font-black text-white tracking-tighter leading-none">{String(t).padStart(2, '0')}</h4>
                   </div>
                </div>

                {/* QR Section */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-white to-slate-50/30">
                  {/* QR Frame */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-primary/10 rounded-[2.5rem] blur-xl group-hover:blur-2xl transition-all" />
                    <div className="relative bg-surface p-5 rounded-[2.5rem] shadow-premium-sm border border-slate-100 flex items-center justify-center">
                       <img 
                         src={QR_API(tableUrl(t))} 
                         alt={`QR Bàn ${t}`} 
                         className="w-40 h-40" 
                       />
                       
                       {/* Icon Center */}
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-10 h-10 bg-surface rounded-xl shadow-lg border border-slate-100 flex items-center justify-center p-1">
                             <div className="w-full h-full bg-primary rounded-lg flex items-center justify-center text-white">
                                <UtensilsCrossed size={16} />
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>

                  <div className="mt-8 text-center space-y-2">
                     <div className="flex items-center justify-center gap-2 text-primary font-black text-[11px] uppercase tracking-widest">
                        <Smartphone size={14} /> Quét để gọi món
                     </div>
                     <p className="text-[10px] text-slate-400 font-medium leading-relaxed max-w-[180px] mx-auto">
                        Mở camera hoặc Zalo quét mã để xem thực đơn & đặt hàng
                     </p>
                  </div>
                </div>

                {/* Merchant Brand Section */}
                <div className="p-8 pt-0 flex flex-col items-center text-center">
                   <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent mb-6" />
                   
                   {merchantLogo && (
                     <img src={merchantLogo} className="w-10 h-10 rounded-full mb-3 border border-slate-100 object-cover" alt="Merchant Logo" />
                   )}
                   
                   <p className="text-xs font-black text-slate-800 tracking-tight mb-0.5 line-clamp-1">{merchantName}</p>
                   {merchantSlogan && (
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest line-clamp-1">{merchantSlogan}</p>
                   )}
                   
                   <div className="mt-4 flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">Kivo Menu Service</p>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CSS for print mode */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #qr-print-container, #qr-print-container * {
              visibility: visible;
            }
            #qr-print-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              display: block !important;
              background: white !important;
            }
            .qr-card {
              break-inside: avoid;
              margin-bottom: 2rem;
              page-break-inside: avoid;
              box-shadow: none !important;
              border: 1px solid #eee !important;
              max-width: 100% !important;
              width: 4.5in !important;
              height: 6.5in !important;
              margin-left: auto;
              margin-right: auto;
            }
            /* Hide UI components during print */
            button, .fixed, .DialogHeader {
               display: none !important;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};
