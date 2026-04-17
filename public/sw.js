// Service Worker para Push Notifications GFI®
self.addEventListener('push', function(event) {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || '',
    icon: '/Logo.jpg',
    badge: '/Logo.jpg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/eventos',
      dateOfArrival: Date.now(),
    },
    actions: [
      { action: 'ver', title: 'Ver evento' },
      { action: 'cerrar', title: 'Cerrar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'GFI® Grupo Foro Inmobiliario', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'cerrar') return;

  const url = event.notification.data?.url || '/eventos';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
