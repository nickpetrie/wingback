// Service worker. Deliberately minimal: it exists so the browser has somewhere
// to deliver a push, not to cache anything. Adding offline caching here would
// mean shipping a cache-invalidation strategy too, and a sweepstake that shows
// a stale gameweek is worse than one that says "no connection".

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // A push with an unparseable body is still worth showing — iOS in
    // particular drops the subscription if a push resolves to no notification.
    data = {};
  }

  const title = data.title || "Wingback";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Collapses an older notification of the same kind rather than stacking
      // three "you haven't picked yet"s.
      tag: data.tag || "wingback",
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  // Focus the app if it's already open instead of piling up tabs.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
