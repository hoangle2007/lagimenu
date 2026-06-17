import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { CustomerLoyaltyLookupPanel } from './CustomerLoyaltyLookupPanel';

type Props = {
  open: boolean;
  onClose: () => void;
  merchantId: string;
  /** Tăng mỗi lần mở modal để reset ô SĐT / kết quả tra cứu */
  panelKey: number;
  tableNumberHint?: string | null;
  sessionId?: string | null;
};

export const CustomerLoyaltyLookupModal: React.FC<Props> = ({
  open,
  onClose,
  merchantId,
  panelKey,
  tableNumberHint,
  sessionId,
}) => {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[340] flex items-end justify-center sm:items-center p-4 bg-black/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-loyalty-lookup-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] bg-surface shadow-2xl max-h-[85vh] overflow-y-auto sm:animate-in sm:fade-in-0 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-yellow-200 bg-yellow-50/90 px-5 py-4 rounded-t-[2rem] sm:rounded-t-[2rem]">
          <h2 id="customer-loyalty-lookup-title" className="text-base font-black text-yellow-950 pr-2">
            Tích điểm & đổi quà
          </h2>
          <button
            type="button"
            className="rounded-full p-2 text-stone-500 hover:bg-yellow-100 hover:text-stone-800"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5">
          <CustomerLoyaltyLookupPanel
            key={panelKey}
            merchantId={merchantId}
            tableNumberHint={tableNumberHint}
            sessionId={sessionId}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
};
