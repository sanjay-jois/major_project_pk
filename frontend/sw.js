const CACHE_NAME = "pk-ml-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/static/css/styles.css",
  "/static/js/api.js",
  "/static/js/app.js",
  "/static/js/dashboard.js",
  "/static/js/dataset.js",
  "/static/js/trajectory.js",
  "/static/js/leaderboard.js",
  "/static/js/validation.js",
  "/static/js/greybox.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.url.includes("/api/")) {
    // API calls always go over network
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
