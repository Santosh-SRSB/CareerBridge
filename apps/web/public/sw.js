/* SRSB Career Bridge — installability service worker.
 * Network-only: never caches HTML/API/auth so login, register, and live data stay unaffected.
 * Firebase push continues to use /firebase-messaging-sw.js separately.
 */
/* eslint-disable no-restricted-globals */
self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key.indexOf('careerbridge-pwa-') === 0;
          })
          .map(function (key) {
            return caches.delete(key);
          }),
      );
    }).then(function () {
      return self.clients.claim();
    }),
  );
});

self.addEventListener('fetch', function (event) {
  // Do not intercept — browser default network path for every request.
  // Presence of this listener satisfies PWA install checks without offline caching.
});
