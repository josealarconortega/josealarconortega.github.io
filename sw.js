// Auto-Unregister Service Worker for Static Website Deployment
self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(function(clients) {
      for (let client of clients) {
        client.navigate(client.url);
      }
      return self.registration.unregister();
    })
  );
});
