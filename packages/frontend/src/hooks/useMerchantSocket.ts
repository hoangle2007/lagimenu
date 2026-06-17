import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { newOrderPushBody } from '../lib/orderPushCopy';
import { speakVietnamese } from '../lib/speechVi';
import { vi } from '../locales/vi';
import type { StaffPresence, StaffPresenceBroadcast } from '../lib/staffPresence';

export interface Order {
  id: number;
  tableNumber: string;
  totalPrice: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'paid' | 'cancelled';
  items: any[];
  type?: string;
  createdAt?: string;
}

export type ActiveCallPaymentEntry = {
  tableNumber: string;
  createdAt: string;
  loyaltyPaymentMethod?: 'at_table' | 'bank_qr';
  /** Yêu cầu thanh toán bill (call_payment) kèm gợi ý */
  paymentPreference?: 'at_table' | 'bank_qr';
};

export type ActiveLoyaltyRedeemEntry = {
  transactionId: number;
  tableNumber: string;
  rewardTitle: string;
  pointsCost: number;
  customerPhoneLast4: string;
  newBalance: number;
  rewardId: number;
  createdAt: string;
  sessionId?: string;
};

const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export type MerchantSocketOptions = {
  /** Ẩn giá trong toast / TTS đơn mới (ví dụ phục vụ). */
  hideOrderAmounts?: boolean;
};

export type { StaffPresence, StaffPresenceBroadcast };

let sharedMerchantSocket: any | null = null;
let sharedMerchantSocketKey = '';
let sharedMerchantSocketUsers = 0;
let sharedMerchantDisconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useMerchantSocket = (merchantId: string, options?: MerchantSocketOptions) => {
  const hideOrderAmountsRef = useRef(!!options?.hideOrderAmounts);
  hideOrderAmountsRef.current = !!options?.hideOrderAmounts;
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [activeCallStaff, setActiveCallStaff] = useState<{ tableNumber: string, createdAt: string }[]>([]);
  const [activeCallPayment, setActiveCallPayment] = useState<ActiveCallPaymentEntry[]>([]);
  const [activeLoyaltyRedeems, setActiveLoyaltyRedeems] = useState<ActiveLoyaltyRedeemEntry[]>([]);
  const [activeReadyOrders, setActiveReadyOrders] = useState<{ tableNumber: string, orderId: number, createdAt: string }[]>([]);
  const [newOrderNotify, setNewOrderNotify] = useState<Order | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [updatedOrder, setUpdatedOrder] = useState<any | null>(null);
  const [staffPresenceByEmployeeId, setStaffPresenceByEmployeeId] = useState<
    Record<string, StaffPresenceBroadcast>
  >({});

  const socketRef = useRef<any>(null);

  const emitStaffPresence = useCallback((data: { merchantId: string; presence: StaffPresence }) => {
    socketRef.current?.emit('staffPresenceUpdate', data);
  }, []);

  const playKitchenSound = useCallback(() => {
    [0, 600, 1200].forEach(delay => {
      setTimeout(() => {
        const audio = new Audio(NOTIFICATION_SOUND_URL);
        audio.volume = 0.6;
        audio.play().catch(() => { });
      }, delay);
    });
  }, []);

  const playStaffCallSound = useCallback(() => {
    [0, 800, 1600].forEach(delay => {
      setTimeout(() => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.8;
        audio.play().catch(() => { });
      }, delay);
    });
  }, []);

  const speak = useCallback((text: string) => {
    speakVietnamese(text, {
      onMissingVietnameseVoice: () =>
        window.dispatchEvent(new CustomEvent('speech-vi-missing')),
    });
  }, []);

  useEffect(() => {
    let socketUrl = (import.meta as any).env?.VITE_API_URL || window.location.origin;
    
    // Socket.IO client interprets trailing paths as namespaces. 
    // If VITE_API_URL is https://domain.com/api, io() will try to connect to the '/api' namespace.
    // We strip it to ensure it connects to the root namespace '/' which the backend uses.
    if (socketUrl.endsWith('/api')) {
      socketUrl = socketUrl.replace(/\/api$/, '');
    }
    
    // Migrations: if old keys exist but new ones don't, migrate them
    if (!localStorage.getItem('token') && localStorage.getItem('lagi_token')) {
      localStorage.setItem('token', localStorage.getItem('lagi_token')!);
      localStorage.setItem('user', localStorage.getItem('lagi_merchant')!);
    }

    // Use the specific key from authStorage
    const token = localStorage.getItem('token');
    
    // Ensure we have a valid merchantId from either props or storage
    let effectiveMerchantId = merchantId;
    if (!effectiveMerchantId || effectiveMerchantId === 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          effectiveMerchantId = userObj.shop?.id || userObj.shopId || userObj.id;
        } catch {
          console.error('[Socket] Failed to parse user state');
        }
      }
    }

    console.log('[Socket] Initializing connection to:', socketUrl);

    if (!token) {
      console.warn('[Socket] No token found in localStorage (token), cannot connect');
      setSocketStatus('error');
      return;
    }

    if (!effectiveMerchantId) {
      console.warn('[Socket] No merchantId provided or found, skipping connection');
      setSocketStatus('error');
      return;
    }

    const socketKey = `${socketUrl}|${token}|${effectiveMerchantId}`;
    if (sharedMerchantDisconnectTimer) {
      clearTimeout(sharedMerchantDisconnectTimer);
      sharedMerchantDisconnectTimer = null;
    }

    if (!sharedMerchantSocket || sharedMerchantSocketKey !== socketKey) {
      sharedMerchantSocket?.disconnect();
      sharedMerchantSocket = io(socketUrl, {
        auth: { token },
        transports: ['websocket'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });
      sharedMerchantSocketKey = socketKey;
    }
    sharedMerchantSocketUsers += 1;
    const socket = sharedMerchantSocket;
    socketRef.current = socket;

    const onConnect = () => {
      console.log('[Socket] Connected to server');
      setSocketStatus('connected');
      socket.emit('joinMerchant', { merchantId: effectiveMerchantId });
    };

    const onDisconnect = (reason: string) => {
      console.log('[Socket] Disconnected:', reason);
      setSocketStatus('disconnected');
    };

    const onConnectError = (error: any) => {
      console.error('[Socket] Connection error:', error);
      setSocketStatus('error');
    };

    const onNewOrder = (order: any) => {
      setNewOrderNotify(order);
      setRefreshTrigger(prev => prev + 1);
      playKitchenSound();
      const omitPrice = hideOrderAmountsRef.current;
      const { title, body } = newOrderPushBody(order, { omitPrice });
      const tableNum = order.tableNumber || order.table_number || '??';
      const price = order.totalPrice || order.total_price || '0';
      import('react-hot-toast').then((t) =>
        t.default.success(
          `${title}\n${body}`,
          { duration: 10000, icon: '🍽️', style: { whiteSpace: 'pre-line' } },
        ),
      );
      setTimeout(
        () =>
          speak(
            omitPrice
              ? vi.tts.newOrderNoAmount(String(tableNum))
              : vi.tts.newOrder(
                  String(tableNum),
                  Intl.NumberFormat('vi-VN').format(+price),
                ),
          ),
        1500,
      );
    };

    const onOrderStatusUpdated = (data: any) => {
      setRefreshTrigger(prev => prev + 1);
      // Also expose the updated order so screens can update in-place
      if (data && data.id) {
        setUpdatedOrder(data);
      }
    };

    const onStaffPresenceUpdate = (payload: StaffPresenceBroadcast) => {
      if (!payload?.employeeId) return;
      setStaffPresenceByEmployeeId((prev) => ({
        ...prev,
        [payload.employeeId]: {
          employeeId: String(payload.employeeId),
          name: String(payload.name ?? ''),
          presence: payload.presence,
          at: payload.at ?? new Date().toISOString(),
        },
      }));
    };

    const onPaymentPendingVerification = (data: {
      tableNumber?: string;
      amount?: number;
      orderId?: number;
    }) => {
      const t = data?.tableNumber ?? '?';
      const a = data?.amount ?? 0;
      import('react-hot-toast').then((mod) =>
        mod.default(
          `💳 Khách bàn ${t} báo đã chuyển ${new Intl.NumberFormat('vi-VN').format(a)}₫ — Xác nhận?`,
          { duration: 15000, icon: '💳' },
        ),
      );
    };

    const onCallStaff = (data: { tableNumber: string }) => {
      const createdAt = new Date().toISOString();
      setActiveCallStaff(prev => [...prev.filter(c => c.tableNumber !== data.tableNumber), { ...data, createdAt }]);
      playStaffCallSound();
      const message = `Bàn ${data.tableNumber} GỌI NHÂN VIÊN`;
      import('react-hot-toast').then(t => t.default.error(message, { duration: 10000, icon: '🆘' }));
      setTimeout(() => speak(vi.tts.callStaff(String(data.tableNumber))), 1500);
    };

    const onCallPayment = (data: {
      tableNumber: string;
      paymentPreference?: 'at_table' | 'bank_qr';
    }) => {
      const createdAt = new Date().toISOString();
      const pref =
        data.paymentPreference === 'bank_qr' || data.paymentPreference === 'at_table'
          ? data.paymentPreference
          : undefined;
      setActiveCallPayment(prev => [...prev.filter(c => c.tableNumber !== data.tableNumber), {
        tableNumber: String(data.tableNumber),
        createdAt,
        paymentPreference: pref,
      }]);
      playStaffCallSound();
      const prefLabel =
        pref === 'bank_qr'
          ? ' — QR ngân hàng'
          : pref === 'at_table'
            ? ' — Tại bàn'
            : '';
      const message = `Bàn ${data.tableNumber} GỌI THANH TOÁN${prefLabel}`;
      import('react-hot-toast').then(t => t.default.success(message, { duration: 10000, icon: '💰' }));
      setTimeout(
        () =>
          speak(
            pref
              ? vi.tts.callPaymentPreference(String(data.tableNumber), pref)
              : vi.tts.callPayment(String(data.tableNumber)),
          ),
        1500,
      );
    };

    const onLoyaltyPayRequest = (data: {
      tableNumber: string;
      loyaltyPaymentMethod?: 'at_table' | 'bank_qr';
    }) => {
      const createdAt = new Date().toISOString();
      const method =
        data.loyaltyPaymentMethod === 'bank_qr' ? 'bank_qr' : 'at_table';
      setActiveCallPayment(prev => [...prev.filter(c => c.tableNumber !== data.tableNumber), {
        tableNumber: String(data.tableNumber),
        createdAt,
        loyaltyPaymentMethod: method,
        paymentPreference: undefined,
      }]);
      playStaffCallSound();
      const methodLabel =
        method === 'bank_qr' ? 'QR ngân hàng' : 'thanh toán tại bàn';
      const message = `Bàn ${data.tableNumber} — THANH TOÁN TÍCH ĐIỂM (${methodLabel})`;
      import('react-hot-toast').then(t => t.default.success(message, { duration: 12000, icon: '⭐' }));
      setTimeout(
        () => speak(vi.tts.loyaltyPayRequest(String(data.tableNumber), method)),
        1500,
      );
    };

    const onLoyaltyRedeem = (data: {
      transactionId?: number;
      tableNumber?: string;
      rewardTitle?: string;
      pointsCost?: number;
      customerPhoneLast4?: string;
      newBalance?: number;
      rewardId?: number;
      sessionId?: string;
    }) => {
      const tid = Number(data?.transactionId ?? 0);
      if (!Number.isFinite(tid) || tid <= 0) return;
      const createdAt = new Date().toISOString();
      const entry: ActiveLoyaltyRedeemEntry = {
        transactionId: tid,
        tableNumber: String(data.tableNumber ?? '—'),
        rewardTitle: String(data.rewardTitle ?? 'Quà'),
        pointsCost: Number(data.pointsCost ?? 0),
        customerPhoneLast4: String(data.customerPhoneLast4 ?? ''),
        newBalance: Number(data.newBalance ?? 0),
        rewardId: Number(data.rewardId ?? 0),
        createdAt,
        ...(data.sessionId ? { sessionId: String(data.sessionId) } : {}),
      };
      setActiveLoyaltyRedeems((prev) => [
        ...prev.filter((e) => e.transactionId !== tid),
        entry,
      ]);
      setRefreshTrigger((prev) => prev + 1);
      playStaffCallSound();
      const tbl = entry.tableNumber;
      const phone4 = entry.customerPhoneLast4;
      const msg =
        tbl !== '—'
          ? `Bàn ${tbl} — ĐỔI QUÀ: ${entry.rewardTitle} (−${entry.pointsCost} điểm) · *${phone4}`
          : `ĐỔI QUÀ: ${entry.rewardTitle} (−${entry.pointsCost} điểm) · *${phone4}`;
      import('react-hot-toast').then((t) =>
        t.default.success(msg, { duration: 14000, icon: '🎁' }),
      );
      setTimeout(
        () =>
          speak(
            vi.tts.loyaltyRedeem(tbl, entry.rewardTitle, entry.pointsCost, phone4),
          ),
        1500,
      );
    };

    // Thông báo món đã nấu xong, cần mang ra bàn
    const onReadyToServe = (data: { tableNumber: string; orderId: number }) => {
      const createdAt = new Date().toISOString();
      setActiveReadyOrders(prev => [...prev.filter(c => c.tableNumber !== data.tableNumber), { ...data, createdAt }]);
      playStaffCallSound();
      const message = `🍽️ Bàn ${data.tableNumber} - MANG ĐƠN RA!`;
      import('react-hot-toast').then(t => t.default.success(message, { duration: 15000, icon: '🍽️' }));
      setTimeout(() => speak(vi.tts.readyToServe(String(data.tableNumber))), 1500);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('newOrder', onNewOrder);
    socket.on('orderStatusUpdated', onOrderStatusUpdated);
    socket.on('staffPresenceUpdate', onStaffPresenceUpdate);
    socket.on('paymentPendingVerification', onPaymentPendingVerification);
    socket.on('callStaff', onCallStaff);
    socket.on('callPayment', onCallPayment);
    socket.on('loyaltyPayRequest', onLoyaltyPayRequest);
    socket.on('loyaltyRedeem', onLoyaltyRedeem);
    socket.on('readyToServe', onReadyToServe);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('newOrder', onNewOrder);
      socket.off('orderStatusUpdated', onOrderStatusUpdated);
      socket.off('staffPresenceUpdate', onStaffPresenceUpdate);
      socket.off('paymentPendingVerification', onPaymentPendingVerification);
      socket.off('callStaff', onCallStaff);
      socket.off('callPayment', onCallPayment);
      socket.off('loyaltyPayRequest', onLoyaltyPayRequest);
      socket.off('loyaltyRedeem', onLoyaltyRedeem);
      socket.off('readyToServe', onReadyToServe);
      sharedMerchantSocketUsers = Math.max(0, sharedMerchantSocketUsers - 1);
      if (sharedMerchantSocketUsers === 0 && sharedMerchantSocket) {
        // Grace period avoids thrashing in React StrictMode / fast route transitions.
        sharedMerchantDisconnectTimer = setTimeout(() => {
          if (sharedMerchantSocketUsers === 0 && sharedMerchantSocket) {
            sharedMerchantSocket.disconnect();
            sharedMerchantSocket = null;
            sharedMerchantSocketKey = '';
          }
          sharedMerchantDisconnectTimer = null;
        }, 1500);
      }
    };
  }, [merchantId, playKitchenSound, playStaffCallSound, speak]);

  const clearOrderNotify = () => setNewOrderNotify(null);
  const clearCallStaff = (tableNumber: string) => setActiveCallStaff(prev => prev.filter(c => c.tableNumber !== tableNumber));
  const clearCallPayment = (tableNumber: string) => setActiveCallPayment(prev => prev.filter(c => c.tableNumber !== tableNumber));
  const clearLoyaltyRedeem = (transactionId: number) =>
    setActiveLoyaltyRedeems((prev) => prev.filter((e) => e.transactionId !== transactionId));
  const clearReadyOrder = (tableNumber: string) => setActiveReadyOrders(prev => prev.filter(c => c.tableNumber !== tableNumber));
  const clearUpdatedOrder = () => setUpdatedOrder(null);

  return {
    socketStatus,
    activeCallStaff,
    activeCallPayment,
    activeLoyaltyRedeems,
    activeReadyOrders,
    newOrderNotify,
    refreshTrigger,
    updatedOrder,
    clearOrderNotify,
    clearCallStaff,
    clearCallPayment,
    clearLoyaltyRedeem,
    clearReadyOrder,
    clearUpdatedOrder,
    speak,
    playKitchenSound,
    playStaffCallSound,
    connect: () => {
      if (socketRef.current) {
        setSocketStatus('connecting');
        socketRef.current.connect();
      }
    },
    emitStaffPresence,
    staffPresenceByEmployeeId,
  };
};
