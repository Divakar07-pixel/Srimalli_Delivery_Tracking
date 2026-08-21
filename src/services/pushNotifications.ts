import { supabase } from "@/lib/supabase";

const VAPID_PUBLIC_KEY = "BEm3VbCZsnUomev-O3rpEcWjmigIKPsYKlgSw0scoysM596661VdmiVgaQQ6RyICWmCBOJ2FjKzhUOaFHa2sWfg";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
}

export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalonePwa() {
  return window.matchMedia?.("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export async function enableDeliveryNotifications(reference: string) {
  if (!isPushSupported()) throw new Error("Push notifications are not supported in this browser.");
  if (isIos() && !isStandalonePwa()) throw new Error("On iPhone/iPad, add this tracking site to your Home Screen first, then open it and enable notifications.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted. You can still track your order normally.");

  const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}push-sw.js`, { scope: import.meta.env.BASE_URL });
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  }

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) throw new Error("Unable to create the device notification subscription.");

  const { error } = await supabase.rpc("save_push_subscription", {
    p_reference: reference.trim(),
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw new Error("Unable to save notification settings. Please try again.");
  return true;
}

export async function checkDeliveryArrival(token: string, latitude: number, longitude: number) {
  const { error } = await supabase.functions.invoke("check-delivery-arrival", {
    body: { token, latitude, longitude },
  });
  if (error) throw error;
}
