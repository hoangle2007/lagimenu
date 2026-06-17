/**
 * Firebase Cloud Messaging — LagiMenu merchant push notifications.
 *
 * Supports: Web (Chrome/Safari) + Flutter Web.
 *
 * Setup:
 * 1. Create Firebase project: https://console.firebase.google.com
 * 2. Enable Cloud Messaging
 * 3. Add Web app → copy config to .env (see .env.example)
 * 4. npm install firebase
 */

import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function isConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

// ─── App init (singleton) ────────────────────────────────────────────
function getFirebaseApp() {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;
  return initializeApp(firebaseConfig);
}

// ─── Messaging instance ────────────────────────────────────────────────
let _messaging: ReturnType<typeof getMessaging> | null = null;

async function getMessagingInstance(): Promise<ReturnType<typeof getMessaging> | null> {
  if (!isConfigured()) {
    console.warn('[Firebase] Not configured — set VITE_FIREBASE_* env vars.');
    return null;
  }
  if (_messaging) return _messaging;

  const supported = await isSupported();
  if (!supported) {
    console.warn('[Firebase] FCM not supported in this browser.');
    return null;
  }

  try {
    const app = getFirebaseApp();
    _messaging = getMessaging(app);
    return _messaging;
  } catch (e) {
    console.error('[Firebase] Init failed:', e);
    return null;
  }
}

// ─── Request FCM push token ───────────────────────────────────────────
export async function requestFcmToken(): Promise<string | null> {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  try {
    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') {
        console.warn('[Firebase] Notification permission denied.');
        return null;
      }
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[Firebase] VITE_FIREBASE_VAPID_KEY not set. Add it to .env.');
      return null;
    }

    // Wait for service worker to be registered and ready
    if ('serviceWorker' in navigator) {
      try {
        // First register the SW if not already registered
        await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      } catch (swErr) {
        // SW may already be registered, that's fine
        console.log('[Firebase] SW registration skipped (may already exist):', swErr);
      }

      // Wait for SW to be ready (with retries)
      let swReady = false;
      for (let i = 0; i < 3; i++) {
        try {
          const reg = await navigator.serviceWorker.ready;
          if (reg.active) {
            swReady = true;
            console.log('[Firebase] Service worker ready');
            break;
          }
        } catch {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      if (!swReady) {
        console.warn('[Firebase] Service worker not ready after retries — continuing anyway');
      }
    }

    const token = await getToken(messaging, { vapidKey });
    return token ?? null;
  } catch (e: any) {
    // AbortError means SW not ready — non-fatal, silently ignore
    if (e?.name === 'AbortError' || e?.message?.includes('ServiceWorker')) {
      console.warn('[Firebase] Service worker not ready yet, skipping FCM token for now.');
      return null;
    }
    console.error('[Firebase] Error getting token:', e);
    return null;
  }
}

// ─── Foreground notification handler ──────────────────────────────────
export function onForegroundMessage(
  callback: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void,
): () => void {
  let unsub: (() => void) | null = null;

  getMessagingInstance().then((messaging) => {
    if (!messaging) return;
    unsub = onMessage(messaging, (payload) => {
      // Browser notification
      if (Notification.permission === 'granted') {
        new Notification(payload.notification?.title ?? 'LagiMenu', {
          body: payload.notification?.body,
          icon: '/logo.png',
          tag: 'lagimenu-order',
          requireInteraction: true,
        });
      }
      callback({
        title: payload.notification?.title ?? undefined,
        body: payload.notification?.body ?? undefined,
        data: payload.data as Record<string, string> | undefined,
      });
    });
  });

  return () => { unsub?.(); };
}
