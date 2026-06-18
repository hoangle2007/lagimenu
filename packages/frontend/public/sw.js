 
self.addEventListener('push', (event) => {
  let title = 'Kivo Menu';
  let body = '';
  try {
    const data = event.data ? event.data.json() : {};
    title = data.title || title;
    body = data.body || '';
  } catch {
    body = event.data ? event.data.text() : '';
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(self.location.origin + '/merchant'));
});
