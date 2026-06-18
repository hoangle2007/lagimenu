/**
 * Firebase Cloud Messaging Service Worker
 * Handles background push notifications when no browser tab is open.
 *
 * Load order in index.html:
 *   <script src="/firebase-messaging-init.js"></script>   ← config
 *   <script src="/firebase-messaging-sw.js"></script>    ← SW registration
 */
(function () {
  'use strict';

  importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');
  // Read Firebase config injected by firebase-messaging-init.js
  // FALLBACK: If the script fails to load or the variable is not set, we use hardcoded config
  const fallbackConfig = {
    apiKey: "AIzaSyAjEwZdp6EPjFDRlvuFbkTeiRLb3sV0VQ0",
    authDomain: "kivo-menu01.firebaseapp.com",
    projectId: "kivo-menu01",
    storageBucket: "kivo-menu01.firebasestorage.app",
    messagingSenderId: "941924534443",
    appId: "1:941924534443:web:d9de481a1a8fa94c150fee"
  };

  const config = self.__FCM_CONFIG__ || fallbackConfig;

  if (!config.apiKey || !config.projectId) {
    console.error('[SW] Firebase config not found even with fallback. Push disabled.');
    return;
  }

  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  // ─── Background message handler ───────────────────────────────────────
  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification ?? {};
    const data = payload.data ?? {};

    const notificationOptions = {
      body: body ?? '',
      icon: '/logo.png',
      tag: data.type ?? 'kivomenu-notification',
      // Hiện cho đến khi user tương tác
      requireInteraction: data.type === 'new_order',
      vibrate: [200, 100, 200],
      priority: 'high',
      data,
      actions: data.type === 'new_order'
        ? [
            { action: 'view',    title: '📋 Xem đơn' },
            { action: 'dismiss', title: 'Bỏ qua' },
          ]
        : [],
    };

    return self.registration.showNotification(title ?? 'KivoMenu — Đơn hàng mới', notificationOptions);
  });

  // ─── Notification click ──────────────────────────────────────────────
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data ?? {};

    if (event.action === 'dismiss') return;

    const targetUrl = data.type === 'new_order'
      ? '/admin'
      : data.type === 'call_staff'
      ? '/admin?tab=call'
      : '/admin';

    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/admin') && 'focus' in client) {
            client.focus();
            client.postMessage({ type: 'PUSH_NOTIFICATION_CLICK', payload: data });
            return;
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
    );
  });
})();
