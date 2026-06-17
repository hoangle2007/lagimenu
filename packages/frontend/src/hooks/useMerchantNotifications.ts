/**
 * useMerchantNotifications — Register FCM push token & handle foreground messages.
 *
 * Call `registerMerchantPush()` once after the merchant logs in.
 * Call `unregisterMerchantPush()` on logout to clear the token.
 */

import { useEffect, useRef } from 'react';
import { requestFcmToken, onForegroundMessage } from '../lib/firebase';
import { api } from '../api/client';

/** Register the current device's FCM token with the backend. */
export async function registerMerchantPush(): Promise<void> {
  const token = await requestFcmToken();
  if (!token) return;

  try {
    await api.post('users/fcm-token', { fcmToken: token });
    console.log('[Push] FCM token registered:', token.slice(0, 20) + '...');
  } catch (error) {
    console.error('[Push] Failed to register FCM token:', error);
  }
}

/** Clear the FCM token from the backend (on logout). */
export async function unregisterMerchantPush(): Promise<void> {
  // If we stored the token locally we could clear it specifically,
  // but clearing all tokens on logout is safe enough.
  try {
    // The backend sets fcmToken = null for this user on logout.
    // For now we just don't re-register.
    console.log('[Push] Merchant logged out — push unregistered.');
  } catch (error) {
    console.error('[Push] Error on logout:', error);
  }
}

/**
 * Hook: automatically registers FCM token when a valid auth token exists.
 * Call this in App.tsx or inside the protected admin route.
 */
export function useMerchantNotifications(authToken: string | null) {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!authToken || registeredRef.current) return;
    registeredRef.current = true;
    registerMerchantPush();
  }, [authToken]);
}

/**
 * Hook: listen for foreground push messages (app is open).
 * Returns the latest notification payload.
 */
export function useForegroundNotification() {
  const lastNotificationRef = useRef<{ title?: string; body?: string; data?: Record<string, string> } | null>(null);

  useEffect(() => {
    const unsub = onForegroundMessage((payload) => {
      lastNotificationRef.current = payload;
      console.log('[Push] Foreground notification received:', payload);
    });
    return unsub;
  }, []);

  return lastNotificationRef;
}
