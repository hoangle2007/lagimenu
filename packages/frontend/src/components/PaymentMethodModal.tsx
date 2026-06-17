import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { buildVietQrUrl, type PaymentInfo } from '../lib/vietqr';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from './ui';
import { normalizeVnCustomerPhone } from '../lib/phoneUtils';

export type PaymentOrder = {
  id: number;
  tableNumber: string;
  totalPrice: string | number;
  customerPhone?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  merchantId: string;
  order: PaymentOrder | null;
};

export const PaymentMethodModal: React.FC<Props> = ({ open, onClose, merchantId, order }) => {
  const [tab, setTab] = useState<'cash' | 'qr'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [loyaltyInfo, setLoyaltyInfo] = useState<{
    points: number;
    earnRuleLabel?: string | null;
  } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const total = order ? Number(order.totalPrice) || 0 : 0;
  const receivedNum = parseFloat(String(cashReceived).replace(/[^\d.]/g, '')) || 0;
  const change = receivedNum - total;

  useEffect(() => {
    if (!open || !merchantId) return;
    void (async () => {
      try {
        const { data } = await api.get<PaymentInfo>(`/merchants/${merchantId}/payment-info`);
        setPaymentInfo(data);
      } catch {
        setPaymentInfo(null);
      }
    })();
  }, [open, merchantId]);

  useEffect(() => {
    if (!open || !merchantId || !order?.customerPhone) {
      setLoyaltyInfo(null);
      return;
    }
    void (async () => {
      try {
        const q =
          normalizeVnCustomerPhone(order.customerPhone) ??
          String(order.customerPhone).replace(/\D/g, '');
        if (!q || q.length < 8) {
          setLoyaltyInfo(null);
          return;
        }
        const { data } = await api.get(
          `/public/loyalty/${encodeURIComponent(merchantId)}/account`,
          { params: { phone: q } },
        );
        setLoyaltyInfo({
          points: Number(data?.points || 0),
          earnRuleLabel:
            typeof data?.earnRuleLabel === 'string' ? data.earnRuleLabel : null,
        });
      } catch {
        setLoyaltyInfo(null);
      }
    })();
  }, [open, merchantId, order?.customerPhone]);

  useEffect(() => {
    if (!open) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }
    let socketUrl = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || window.location.origin;
    if (socketUrl.endsWith('/api')) socketUrl = socketUrl.replace(/\/api$/, '');
    const token = localStorage.getItem('token');
    if (!token) return;
    const s = io(socketUrl, { auth: { token }, transports: ['websocket'] });
    socketRef.current = s;
    s.on('connect', () => {
      s.emit('joinMerchant', { merchantId });
    });
    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [open, merchantId]);

  const qrUrl = useMemo(() => {
    if (!order || !paymentInfo) return null;
    const addInfo = String(order.id);
    return buildVietQrUrl(paymentInfo, total, addInfo);
  }, [order, paymentInfo, total]);

  const confirmCash = async () => {
    if (!order) return;
    if (receivedNum < total) {
      toast.error('Số tiền nhận phải ≥ tổng đơn');
      return;
    }
    try {
      await api.patch(`/orders/${order.id}`, { status: 'paid', paymentMethod: 'cash' });
      toast.success('Đã xác nhận thanh toán tiền mặt');
      onClose();
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(m || 'Lỗi cập nhật đơn');
    }
  };

  const notifyTransfer = () => {
    if (!order || !socketRef.current?.connected) {
      toast.error('Chưa kết nối realtime');
      return;
    }
    socketRef.current.emit('paymentPendingVerification', {
      merchantId,
      orderId: order.id,
      tableNumber: order.tableNumber,
      amount: total,
    });
    toast(
      `💳 Khách bàn ${order.tableNumber} báo đã chuyển ${new Intl.NumberFormat('vi-VN').format(total)}₫ — Xác nhận?`,
      { duration: 12000 },
    );
  };

  const confirmTransferPaid = async () => {
    if (!order) return;
    try {
      await api.patch(`/orders/${order.id}`, { status: 'paid', paymentMethod: 'transfer' });
      toast.success('Đã xác nhận đã nhận tiền chuyển khoản');
      onClose();
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(m || 'Lỗi cập nhật đơn');
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thanh toán đơn #{order.id}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-4">
          <Button
            type="button"
            variant={tab === 'cash' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setTab('cash')}
          >
            Tại bàn (tiền mặt)
          </Button>
          <Button
            type="button"
            variant={tab === 'qr' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setTab('qr')}
          >
            Online (QR)
          </Button>
        </div>

        {tab === 'cash' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Tổng phải thu:{' '}
              <strong>{new Intl.NumberFormat('vi-VN').format(total)}₫</strong>
            </p>
            <p className="text-xs text-slate-500">
              Điểm dự kiến cộng: <strong>+{Math.floor(total / 10000)}</strong>
              {order.customerPhone && loyaltyInfo ? (
                <> (hiện có: {loyaltyInfo.points})</>
              ) : null}
            </p>
            {loyaltyInfo?.earnRuleLabel ? (
              <p className="text-[10px] text-slate-400 leading-snug">{loyaltyInfo.earnRuleLabel}</p>
            ) : null}
            <label className="block text-xs font-bold text-slate-500 uppercase">Tiền khách đưa</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-lg font-black"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              placeholder="0"
            />
            <p className="text-sm">
              Tiền thừa:{' '}
              <strong className={change >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {new Intl.NumberFormat('vi-VN').format(Math.max(0, change))}₫
              </strong>
            </p>
            <Button className="w-full" onClick={() => void confirmCash()}>
              Xác nhận
            </Button>
          </div>
        )}

        {tab === 'qr' && (
          <div className="space-y-3">
            {!paymentInfo?.bankAccount ? (
              <p className="text-rose-600 font-medium">Chưa cài đặt thông tin thanh toán</p>
            ) : (
              <>
                {qrUrl ? (
                  <img src={qrUrl} alt="VietQR" className="w-full max-w-xs mx-auto rounded-lg border" />
                ) : null}
                <div className="text-sm space-y-1 bg-surface-container-low rounded-lg p-3">
                  <p>
                    <span className="text-slate-500">Ngân hàng:</span>{' '}
                    <strong>{paymentInfo.bankName}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Số TK:</span>{' '}
                    <strong>{paymentInfo.bankAccount}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Chủ TK:</span>{' '}
                    <strong>{paymentInfo.bankOwner}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Số tiền:</span>{' '}
                    <strong>{new Intl.NumberFormat('vi-VN').format(total)}₫</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Nội dung CK:</span>{' '}
                    <strong>{order.id}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500">Điểm dự kiến:</span>{' '}
                    <strong>+{Math.floor(total / 10000)}</strong>
                  </p>
                </div>
                <Button variant="outline" className="w-full" onClick={notifyTransfer}>
                  Đã chuyển khoản
                </Button>
                <Button className="w-full" onClick={() => void confirmTransferPaid()}>
                  Xác nhận đã nhận tiền
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
