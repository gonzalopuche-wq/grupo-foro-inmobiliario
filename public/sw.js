// GFI® Service Worker — PWA + Push Notifications
const CACHE = "gfi-v2";
const OFFLINE_URLS = ["/", "/dashboard", "/offline", "/crm/cartera", "/crm", "/mir", "/logo_gfi.png", "/manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS).catch(() => {})));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener("message", e => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match("/offline")))
  );
});

// Push notifications
self.addEventListener("push", e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || "GFI® Grupo Foro Inmobiliario", {
      body: data.body || "",
      icon: "/logo_gfi.png",
      badge: "/logo_gfi.png",
      vibrate: [100, 50, 100],
      data: { url: data.url || "/dashboard" },
      actions: [{ action: "ver", title: "Ver" }, { action: "cerrar", title: "Cerrar" }],
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  if (e.action === "cerrar") return;
  const url = e.notification.data?.url || "/dashboard";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && "focus" in c) { c.focus(); c.navigate(url); return; }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
