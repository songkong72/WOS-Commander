// Minimal Service Worker for PWA Installability
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    // Pass-through strategy
    event.respondWith(fetch(event.request));
});
