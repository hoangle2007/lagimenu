import React, { useState } from 'react';
import { Star, X, Send, Heart } from 'lucide-react';
import api from '../lib/api';

interface ReviewModalProps {
  merchantId: string;
  tableId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ merchantId, tableId, isOpen, onClose }) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await api.post('/reviews', {
        merchantId,
        tableNumber: tableId,
        rating,
        comment
      });
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        // Reset after close animation
        setTimeout(() => {
          setSubmitted(false);
          setRating(0);
          setComment('');
        }, 3000);
      }, 2000);
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-sm bg-surface rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-500">
        <div className="absolute top-4 right-4">
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-low text-slate-400 hover:bg-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="p-10 text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart size={40} className="text-green-600 fill-green-600 animate-pulse" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">Cảm ơn bạn!</h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Những đóng góp của bạn giúp chúng tôi hoàn thiện dịch vụ mỗi ngày.
            </p>
          </div>
        ) : (
          <div className="p-8 pt-10">
            <h2 className="text-2xl font-black text-slate-800 text-center mb-1">Đánh giá trải nghiệm</h2>
            <p className="text-sm font-bold text-slate-400 text-center mb-8 uppercase tracking-widest">Bàn {tableId}</p>

            <div className="flex justify-center gap-2 mb-10">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                  className="transition-all duration-200 active:scale-90"
                >
                  <Star 
                    size={42} 
                    className={`transition-all duration-300 ${
                      (hoveredRating || rating) >= star 
                      ? 'fill-yellow-400 text-yellow-400 scale-110 drop-shadow-md' 
                      : 'text-slate-200 fill-slate-50'
                    }`}
                  />
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="relative">
                <textarea
                  placeholder="Để lại lời nhắn cho quán (không bắt buộc)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full h-32 px-5 py-4 bg-surface-container-low rounded-2xl text-sm font-medium placeholder:text-slate-400 border border-transparent focus:border-primary/20 focus:ring-4 focus:ring-primary/5 outline-none transition-all resize-none"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className={`w-full h-14 rounded-2xl flex items-center justify-center gap-3 font-black text-sm transition-all duration-300 ${
                  rating > 0 
                  ? 'bg-primary text-white shadow-xl shadow-primary/20' 
                  : 'bg-surface-container-low text-slate-400 cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={18} />
                    Gửi đánh giá
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
