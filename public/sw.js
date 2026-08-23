// Deliberately minimal: this only exists for two things — installability
// (PWA requires a service worker to exist at all) and a friendly offline
// screen instead of the browser's default error page. It does NOT cache
// or intercept API responses, auth routes, or the dashboard's live data —
// streak data must always be fresh, and messing with /api/auth/* via a
// service worker is a good way to break OAuth in confusing ways.

const CACHE = "streakline-shell-v1";
const SHELL_ASSETS = ["/manifest.json", "/icon-192.png", "/icon-512.png", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  // Only handle top-level page navigations (offline fallback). Everything
  // else — API calls, RSC data, auth — passes straight through untouched.
  if (req.mode !== "navigate") return;

  event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
});
