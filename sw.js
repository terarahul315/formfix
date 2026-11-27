const CACHE_NAME = "formfix-v2";
const ASSETS = [
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.json",
  "/favicon.png",
  "/privacy.html",
  "/terms.html"
];

/* INSTALL: precache — har file alag, ek fail ho toh baaki na ruke */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          cache.add(url).catch(() => null)
        )
      )
    )
  );
});

/* ACTIVATE: purane caches delete */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* FETCH: network-first, sirf same-origin cache, navigation fallback */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* Third-party (ads, analytics) ko bilkul touch na karein */
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        /* Sirf successful, non-opaque responses cache karein */
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, copy).catch(() => null);
          });
        }
        return res;
      })
      .catch(() => {
        /* Offline fallback */
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          /* Navigation request hai par cache miss — index.html dikhayein */
          if (req.mode === "navigate") {
            return caches.match("/index.html");
          }
          return new Response("Offline", {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/plain" }
          });
        });
      })
  );
});
