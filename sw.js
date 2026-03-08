/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'shangdaren-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './about.html',
    './how-to.html',
    './versions.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './src/css/style.css',
    './src/js/main.js',
    './src/js/game.js',
    './src/js/card.js',
    './src/js/deck.js',
    './src/js/player.js',
    './src/js/rules.js',
    './src/js/translations.js',
    './src/js/utils.js',
    './src/js/constants.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
    );
});
