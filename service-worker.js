const CACHE = "que-te-falta-v38";
const ASSETS = ["./", "./index.html", "./styles.css?v=38", "./app.mjs?v=38", "./core.mjs?v=38", "./family-sync.mjs?v=38", "./secure-sharing.mjs?v=38", "./account-sharing.mjs?v=38", "./account-state-writer.mjs?v=38", "./activity.mjs?v=38", "./fonts/Lora-Variable.ttf", "./icon.svg", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./manifest.webmanifest?v=38"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows[0];
      if (existing) return existing.focus();
      return clients.openWindow(event.notification.data?.url || "./");
    })
  );
});

