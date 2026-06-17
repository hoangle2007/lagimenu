import React, { useState } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, 
  Button 
} from '../ui';
import { 
  Rocket, Coffee, ShoppingCart, QrCode, ArrowRight, ArrowLeft, 
  CheckCircle2, Sparkles, LayoutDashboard
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const steps = [
  {
    title: 'Chào mừng bạn đến với Lagi Menu! 🚀',
    description: 'Giải pháp quản lý quán chuyên nghiệp, giúp bạn tự động hóa quy trình bán hàng và phục vụ khách hàng tốt hơn.',
    icon: Rocket,
    image: '/onboarding-hero.png',
    color: 'text-primary',
    bg: 'bg-primary/5',
  },
  {
    title: 'Bước 1: Thiết lập Thực đơn 🍱',
    description: 'Bắt đầu bằng việc tạo các Danh mục (như Cà phê, Trà sữa) và thêm các món ngon của quán bạn trong tab Thực đơn.',
    icon: Coffee,
    tab: 'pos', // Guide them to Menu (which is inside PosTab or MenuTab)
    tabName: 'Thực đơn',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    title: 'Bước 2: Bán hàng tại quầy (POS) 🛒',
    description: 'Sử dụng màn hình Bán hàng để nhận đơn, in hóa đơn nhanh chóng và hỗ trợ thanh toán VietQR tiện lợi cho khách.',
    icon: ShoppingCart,
    tab: 'pos',
    tabName: 'Bán hàng',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    title: 'Bước 3: In mã QR dán tại bàn 📱',
    description: 'Vào phần Cài đặt để thiết lập số bàn và in mã QR. Khách chỉ cần quét mã để xem menu và gọi món ngay tại chỗ.',
    icon: QrCode,
    tab: 'settings',
    tabName: 'Cài đặt QR',
    color: 'text-purple-500',
    bg: 'bg-purple-50',
  },
  {
    title: 'Mọi thứ đã sẵn sàng! 🎉',
    description: 'Bạn đã nắm vững các bước cơ bản. Hãy bắt đầu hành trình kinh doanh thành công cùng Lagi Menu ngay bây giờ!',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
  }
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const step = steps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-premium bg-surface rounded-[2rem]">
        {/* Header Illustration/Icon */}
        <div className={cn("h-48 w-full flex items-center justify-center relative overflow-hidden transition-colors duration-500", step.bg)}>
          {step.image ? (
            <img src={step.image} alt="Welcome" className="w-full h-full object-cover" />
          ) : (
            <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center shadow-premium bg-surface animate-in zoom-in-50 duration-500", step.color)}>
              <step.icon size={40} strokeWidth={2.5} />
            </div>
          )}
          
          {/* Bubbles for extra aesthetics */}
          {!step.image && (
            <>
              <div className="absolute top-10 left-10 w-4 h-4 rounded-full bg-current opacity-20 blur-sm animate-pulse" />
              <div className="absolute bottom-10 right-20 w-6 h-6 rounded-full bg-current opacity-10 blur-sm animate-bounce" />
            </>
          )}
        </div>

        <div className="p-8">
          <div className="flex items-center gap-1.5 mb-6">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300", 
                  i === currentStep ? "w-8 bg-primary" : "w-1.5 bg-surface-container-low"
                )} 
              />
            ))}
          </div>

          <DialogHeader className="p-0 border-none">
            <DialogTitle className="text-xl font-black text-slate-800 tracking-tight leading-tight">
              {step.title}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500 leading-relaxed mt-3">
              {step.description}
            </DialogDescription>
          </DialogHeader>

          {step.tab && (
            <div className="mt-6 flex items-center gap-2 p-3 bg-surface-container-low rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-primary shadow-sm">
                <LayoutDashboard size={14} />
              </div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Tính năng nằm tại tab <span className="text-primary">{step.tabName}</span>
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mt-10 gap-4">
            <Button
              variant="ghost"
              size="lg"
              onClick={handleBack}
              disabled={currentStep === 0}
              className={cn("rounded-2xl transition-all", currentStep === 0 && "opacity-0")}
            >
              <ArrowLeft size={18} className="mr-2" />
              Quay lại
            </Button>

            <Button
              size="lg"
              onClick={handleNext}
              className="rounded-2xl px-8 font-black uppercase tracking-widest text-xs h-12 shadow-xl shadow-primary/20 flex-1 sm:flex-none"
            >
              {currentStep === steps.length - 1 ? (
                <>
                  Khám phá ngay
                  <Sparkles size={16} className="ml-2" />
                </>
              ) : (
                <>
                  Tiếp theo
                  <ArrowRight size={18} className="ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
