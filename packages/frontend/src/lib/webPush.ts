import api from './api';

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

let registered = false;

/** Register SW, subscribe with VAPID, POST subscription to API. Safe to call multiple times. */
export async function registerMerchantWebPush(): Promise<void> {
  if (registered) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await reg.update();

    const { data } = await api.get<{ publicKey: string | null }>('/push-subscriptions/vapid-public-key');
    const publicKey = data?.publicKey;
    if (!publicKey) return;

    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await api.post('/push-subscriptions', existing.toJSON());
      registered = true;
      return;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await api.post('/push-subscriptions', sub.toJSON());
    registered = true;
  } catch {
    // VAPID missing or permission denied — ignore
  }
}
