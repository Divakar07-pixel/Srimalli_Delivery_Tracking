self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || "Srimalli Delivery";
  const options = {
    body: data.body || "Your delivery is nearby.",
    icon: data.icon || "https://kxelijflylhzjfzpynhg.supabase.co/storage/v1/object/public/branding/logo-1785863913557.webp",
    badge: data.badge || "https://kxelijflylhzjfzpynhg.supabase.co/storage/v1/object/public/branding/logo-1785863913557.webp",
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
