// CoachConnect Pro - Push Notification Service Worker

self.addEventListener('push', function(event) {
  let data = { title: 'CoachConnect Pro', body: 'You have a new notification', icon: '/icon-192x192.png' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch(e) {
    console.error('Push data parse error:', e);
  }

  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: data.tag || 'default',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'CoachConnect Pro', options)
  );
});

// Handle notification click - open the app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('coachconnectpro.net') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow(url);
    })
  );
});

// Service worker install
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Service worker activate
self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
