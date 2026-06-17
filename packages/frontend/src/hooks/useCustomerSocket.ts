import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let sharedCustomerSocket: any | null = null;
let sharedCustomerSocketKey = '';
let sharedCustomerSocketUsers = 0;
let sharedCustomerDisconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useCustomerSocket = (merchantId: string | undefined) => {
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [updatedOrder, setUpdatedOrder] = useState<any | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!merchantId) return;

    const socketUrl = (import.meta as any).env?.VITE_API_URL || window.location.origin;
    
    console.log('[CustomerSocket] Connecting to:', socketUrl);

    const socketKey = `${socketUrl}|${merchantId}`;
    if (sharedCustomerDisconnectTimer) {
      clearTimeout(sharedCustomerDisconnectTimer);
      sharedCustomerDisconnectTimer = null;
    }
    if (!sharedCustomerSocket || sharedCustomerSocketKey !== socketKey) {
      sharedCustomerSocket?.disconnect();
      sharedCustomerSocket = io(socketUrl, {
        transports: ['websocket'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });
      sharedCustomerSocketKey = socketKey;
    }
    sharedCustomerSocketUsers += 1;
    const socket = sharedCustomerSocket;
    socketRef.current = socket;

    const onConnect = () => {
      console.log('[CustomerSocket] Connected');
      setSocketStatus('connected');
      socket.emit('joinMerchant', { merchantId });
    };

    const onDisconnect = () => {
      setSocketStatus('disconnected');
    };

    const onConnectError = () => {
      setSocketStatus('error');
    };

    const onOrderStatusUpdated = (data: any) => {
      console.log('[CustomerSocket] Order status updated:', data);
      setUpdatedOrder(data);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('orderStatusUpdated', onOrderStatusUpdated);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('orderStatusUpdated', onOrderStatusUpdated);
      sharedCustomerSocketUsers = Math.max(0, sharedCustomerSocketUsers - 1);
      if (sharedCustomerSocketUsers === 0 && sharedCustomerSocket) {
        sharedCustomerDisconnectTimer = setTimeout(() => {
          if (sharedCustomerSocketUsers === 0 && sharedCustomerSocket) {
            sharedCustomerSocket.disconnect();
            sharedCustomerSocket = null;
            sharedCustomerSocketKey = '';
          }
          sharedCustomerDisconnectTimer = null;
        }, 1500);
      }
    };
  }, [merchantId]);

  return { socketStatus, updatedOrder, clearUpdatedOrder: () => setUpdatedOrder(null) };
};
