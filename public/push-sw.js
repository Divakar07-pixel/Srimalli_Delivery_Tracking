self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || "Srimalli Delivery";
  const options = {
    body: data.body || "Your delivery is nearby.",
    icon: data.icon || "./icons/icon-192.png",
    badge: data.badge || "./icons/icon-192.png",
    tag: data.tag || "srimalli-delivery-arrival",
    renotify: false,
    data: { trackingId: data.trackingId || "" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const base = new URL(self.registration.scope);
    const trackingId = event.notification.data?.trackingId;
    if (trackingId) base.pathname = `${base.pathname.replace(/\/$/, "")}/track/${encodeURIComponent(trackingId)}`;
    const targetUrl = base.href;
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
