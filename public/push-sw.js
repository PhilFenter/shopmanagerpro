/* Push notifications service worker — handles incoming push events */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Shop Manager", body: "", link: "/", data: {} };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) {
    payload.body = event.data ? event.data.text() : "";
  }

  const options = {
    body: payload.body || "",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    vibrate: [200, 100, 200],
    tag: payload.data?.handoff_id || payload.data?.notification_id || "shop-notif",
    renotify: true,
    requireInteraction: false,
    data: { link: payload.link || "/", ...payload.data },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});
