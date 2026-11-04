/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'shangdaren-v21';
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
    './src/js/constants.js',
    './src/js/voice.js',
    './src/js/voice_lines.js',
    './src/audio/xiaoxiao/4e03.mp3',
    './src/audio/xiaoxiao/4e09.mp3',
    './src/audio/xiaoxiao/4e0a.mp3',
    './src/audio/xiaoxiao/4e18.mp3',
    './src/audio/xiaoxiao/4e59.mp3',
    './src/audio/xiaoxiao/4e5d.mp3',
    './src/audio/xiaoxiao/4eba.mp3',
    './src/audio/xiaoxiao/4ec1.mp3',
    './src/audio/xiaoxiao/4f5c.mp3',
    './src/audio/xiaoxiao/4f73.mp3',
    './src/audio/xiaoxiao/516b.mp3',
    './src/audio/xiaoxiao/51e0.mp3',
    './src/audio/xiaoxiao/5316.mp3',
    './src/audio/xiaoxiao/5341.mp3',
    './src/audio/xiaoxiao/5343.mp3',
    './src/audio/xiaoxiao/53ef.mp3',
    './src/audio/xiaoxiao/571f.mp3',
    './src/audio/xiaoxiao/5927.mp3',
    './src/audio/xiaoxiao/5b50.mp3',
    './src/audio/xiaoxiao/5c0f.mp3',
    './src/audio/xiaoxiao/5c14.mp3',
    './src/audio/xiaoxiao/751f.mp3',
    './src/audio/xiaoxiao/77e5.mp3',
    './src/audio/xiaoxiao/793c.mp3',
    './src/audio/xiaoxiao/ban-long.mp3',
    './src/audio/xiaoxiao/ban-she.mp3',
    './src/audio/xiaoxiao/bu-yao.mp3',
    './src/audio/xiaoxiao/chi.mp3',
    './src/audio/xiaoxiao/hu-le.mp3',
    './src/audio/xiaoxiao/kai-zhao.mp3',
    './src/audio/xiaoxiao/kou.mp3',
    './src/audio/xiaoxiao/long.mp3',
    './src/audio/xiaoxiao/peng.mp3',
    './src/audio/xiaoxiao/shao.mp3',
    './src/audio/xiaoxiao/she.mp3',
    './src/audio/xiaoxiao/shuang-long-bao-zhu.mp3',
    './src/audio/xiaoxiao/xia-che.mp3',
    './src/audio/xiaoxuan/4e03.mp3',
    './src/audio/xiaoxuan/4e09.mp3',
    './src/audio/xiaoxuan/4e0a.mp3',
    './src/audio/xiaoxuan/4e18.mp3',
    './src/audio/xiaoxuan/4e59.mp3',
    './src/audio/xiaoxuan/4e5d.mp3',
    './src/audio/xiaoxuan/4eba.mp3',
    './src/audio/xiaoxuan/4ec1.mp3',
    './src/audio/xiaoxuan/4f5c.mp3',
    './src/audio/xiaoxuan/4f73.mp3',
    './src/audio/xiaoxuan/516b.mp3',
    './src/audio/xiaoxuan/51e0.mp3',
    './src/audio/xiaoxuan/5316.mp3',
    './src/audio/xiaoxuan/5341.mp3',
    './src/audio/xiaoxuan/5343.mp3',
    './src/audio/xiaoxuan/53ef.mp3',
    './src/audio/xiaoxuan/571f.mp3',
    './src/audio/xiaoxuan/5927.mp3',
    './src/audio/xiaoxuan/5b50.mp3',
    './src/audio/xiaoxuan/5c0f.mp3',
    './src/audio/xiaoxuan/5c14.mp3',
    './src/audio/xiaoxuan/751f.mp3',
    './src/audio/xiaoxuan/77e5.mp3',
    './src/audio/xiaoxuan/793c.mp3',
    './src/audio/xiaoxuan/ban-long.mp3',
    './src/audio/xiaoxuan/ban-she.mp3',
    './src/audio/xiaoxuan/bu-yao.mp3',
    './src/audio/xiaoxuan/chi.mp3',
    './src/audio/xiaoxuan/hu-le.mp3',
    './src/audio/xiaoxuan/kai-zhao.mp3',
    './src/audio/xiaoxuan/kou.mp3',
    './src/audio/xiaoxuan/long.mp3',
    './src/audio/xiaoxuan/peng.mp3',
    './src/audio/xiaoxuan/shao.mp3',
    './src/audio/xiaoxuan/she.mp3',
    './src/audio/xiaoxuan/shuang-long-bao-zhu.mp3',
    './src/audio/xiaoxuan/xia-che.mp3',
    './src/audio/yunyang/4e03.mp3',
    './src/audio/yunyang/4e09.mp3',
    './src/audio/yunyang/4e0a.mp3',
    './src/audio/yunyang/4e18.mp3',
    './src/audio/yunyang/4e59.mp3',
    './src/audio/yunyang/4e5d.mp3',
    './src/audio/yunyang/4eba.mp3',
    './src/audio/yunyang/4ec1.mp3',
    './src/audio/yunyang/4f5c.mp3',
    './src/audio/yunyang/4f73.mp3',
    './src/audio/yunyang/516b.mp3',
    './src/audio/yunyang/51e0.mp3',
    './src/audio/yunyang/5316.mp3',
    './src/audio/yunyang/5341.mp3',
    './src/audio/yunyang/5343.mp3',
    './src/audio/yunyang/53ef.mp3',
    './src/audio/yunyang/571f.mp3',
    './src/audio/yunyang/5927.mp3',
    './src/audio/yunyang/5b50.mp3',
    './src/audio/yunyang/5c0f.mp3',
    './src/audio/yunyang/5c14.mp3',
    './src/audio/yunyang/751f.mp3',
    './src/audio/yunyang/77e5.mp3',
    './src/audio/yunyang/793c.mp3',
    './src/audio/yunyang/ban-long.mp3',
    './src/audio/yunyang/ban-she.mp3',
    './src/audio/yunyang/bu-yao.mp3',
    './src/audio/yunyang/chi.mp3',
    './src/audio/yunyang/hu-le.mp3',
    './src/audio/yunyang/kai-zhao.mp3',
    './src/audio/yunyang/kou.mp3',
    './src/audio/yunyang/long.mp3',
    './src/audio/yunyang/peng.mp3',
    './src/audio/yunyang/shao.mp3',
    './src/audio/yunyang/she.mp3',
    './src/audio/yunyang/shuang-long-bao-zhu.mp3',
    './src/audio/yunyang/xia-che.mp3'
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
