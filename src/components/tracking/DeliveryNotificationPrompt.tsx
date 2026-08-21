import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getOrderTracking } from "@/services/tracking";
import { enableDeliveryNotifications, isIos, isPushSupported, isStandalonePwa } from "@/services/pushNotifications";

type State = "hidden" | "ready" | "working" | "enabled" | "error";

export function DeliveryNotificationPrompt() {
  const location = useLocation();
  const reference = location.pathname.match(/^\/track\/([^/]+)$/)?.[1] ?? "";
  const [state, setState] = useState<State>("hidden");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!reference || !isPushSupported()) { setState("hidden"); return; }
    getOrderTracking(reference).then((order) => {
      if (cancelled || !order || order.status !== "out_for_delivery") return;
      if (Notification.permission === "granted") setState("enabled");
      else setState("ready");
    }).catch(() => { if (!cancelled) setState("hidden"); });
    return () => { cancelled = true; };
  }, [reference]);

  if (!reference || state === "hidden") return null;

  const enable = async () => {
    setState("working");
    setMessage("");
    try {
      await enableDeliveryNotifications(reference);
      setState("enabled");
    } catch (error) {
      setState("error");
      setMessage((error as Error).message);
    }
  };

  return <div className="fixed inset-x-0 bottom-4 z-[1100] px-4">
    <Card className="mx-auto max-w-2xl border-border bg-background/95 shadow-lg backdrop-blur">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {state === "enabled" ? <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : state === "error" ? <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" /> : <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
          <div>
            {state === "enabled" ? <p className="font-medium">Delivery notifications are enabled.</p> : <p className="font-medium">Get a notification when your order is nearby</p>}
            {state === "error" ? <p className="mt-1 text-xs text-muted-foreground">{message}</p> : state === "enabled" ? <p className="mt-1 text-xs text-muted-foreground">We'll alert you when the driver enters the 200 m arrival area.</p> : isIos() && !isStandalonePwa() ? <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Smartphone className="h-3 w-3" /> Add this site to your Home Screen first on iPhone/iPad.</p> : <p className="mt-1 text-xs text-muted-foreground">You can keep tracking normally even if you don't enable notifications.</p>}
          </div>
        </div>
        {state !== "enabled" && <Button onClick={enable} disabled={state === "working"}>{state === "working" ? "Enabling…" : "ENABLE NOTIFICATIONS"}</Button>}
      </CardContent>
    </Card>
  </div>;
}
