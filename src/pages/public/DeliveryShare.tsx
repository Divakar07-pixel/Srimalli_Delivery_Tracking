import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { MapPin, Navigation, Power, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDeliveryAssignment, startDeliveryTracking, stopDeliveryTracking, updateDeliveryPartnerLocation, type DeliveryAssignment } from "@/services/tracking";

type TrackingState = "idle" | "starting" | "sharing" | "stopping" | "error";

export function DeliveryShare() {
  const { token = "" } = useParams();
  const [assignment, setAssignment] = useState<DeliveryAssignment | null | undefined>(undefined);
  const [state, setState] = useState<TrackingState>("idle");
  const [message, setMessage] = useState("Start tracking when you begin the delivery.");
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [showCompletedPrompt, setShowCompletedPrompt] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastSentAt = useRef(0);
  const latestPosition = useRef<GeolocationPosition | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    getDeliveryAssignment(token).then((data) => {
      setAssignment(data);
      if (data?.status === "delivered" && data.tracking_active) setShowCompletedPrompt(true);
      if (data?.tracking_active) setState("sharing");
    }).catch(() => setAssignment(null));
    return () => {
      if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
      if (wakeLock.current) void wakeLock.current.release().catch(() => {});
    };
  }, [token]);

  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator && !wakeLock.current) {
        wakeLock.current = await navigator.wakeLock.request("screen");
        wakeLock.current.addEventListener("release", () => { wakeLock.current = null; });
      }
    } catch { /* optional API; GPS continues */ }
  };

  const sendPosition = async (position: GeolocationPosition) => {
    latestPosition.current = position;
    const now = Date.now();
    setLastUpdate(now);
    if (now - lastSentAt.current < 15_000) return;
    lastSentAt.current = now;
    try {
      await updateDeliveryPartnerLocation(token, position.coords.latitude, position.coords.longitude);
      setMessage("GPS connected. Location is sharing.");
    } catch (error) {
      setState("error"); setMessage((error as Error).message);
    }
  };

  const startSharing = async () => {
    if (!navigator.geolocation) { setState("error"); setMessage("Location services are not supported by this browser."); return; }
    setState("starting"); setMessage("Requesting GPS permission…");
    try {
      const started = await startDeliveryTracking(token);
      if (!started) throw new Error("This delivery link is no longer active.");
      setAssignment(started);
      await requestWakeLock();
      watchId.current = navigator.geolocation.watchPosition(
        (position) => void sendPosition(position),
        (error) => {
          setState("error");
          if (error.code === error.PERMISSION_DENIED) setMessage("Location access is required to share your live delivery location.");
          else if (error.code === error.TIMEOUT) setMessage("GPS took too long to respond. Keep trying or move to an area with a clearer signal.");
          else setMessage("GPS is temporarily unavailable. Please try again.");
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
      );
      setState("sharing"); setMessage("GPS connected. Location is sharing.");
    } catch (error) { setState("error"); setMessage((error as Error).message); }
  };

  const stopSharing = async () => {
    setState("stopping");
    try {
      const position = latestPosition.current;
      await stopDeliveryTracking(token, position?.coords.latitude, position?.coords.longitude);
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      if (wakeLock.current) await wakeLock.current.release().catch(() => {});
      setState("idle"); setMessage("Location sharing stopped.");
      setAssignment((current) => current ? { ...current, tracking_active: false } : current);
      setShowCompletedPrompt(false);
    } catch (error) { setState("error"); setMessage((error as Error).message); }
  };

  if (assignment === undefined) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!assignment) return <div className="mx-auto max-w-md px-4 py-20 text-center"><h1 className="text-xl font-semibold">Delivery link unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Ask the shop to send a current delivery link.</p></div>;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 sm:py-10">
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Navigation className="h-5 w-5 text-primary" /> 🛵 Delivery Tracking</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">GPS Status</p><p className="mt-1 flex items-center gap-2 font-medium"><span className={`h-2.5 w-2.5 rounded-full ${state === "sharing" ? "bg-green-500" : "bg-muted-foreground"}`} />{state === "sharing" ? "GPS Connected" : "Location not started"}</p>{state === "sharing" && <p className="mt-1 text-xs text-muted-foreground">Location: Sharing</p>}{lastUpdate && <p className="mt-2 text-xs text-muted-foreground">Last Update: {formatAge(lastUpdate)}</p>}</div>
          <div><p className="text-sm text-muted-foreground">Customer</p><p className="font-semibold">{assignment.customer_name}</p><p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{assignment.customer_address || "Saved delivery location"}</p></div>
          <div className="grid gap-2">
            {assignment.customer_latitude != null && assignment.customer_longitude != null && <><Button className="h-12 w-full" onClick={() => openMaps(assignment.customer_latitude!, assignment.customer_longitude!, false)}><MapPin className="h-4 w-4" /> Open Google Maps</Button><Button variant="outline" className="h-12 w-full" onClick={() => openMaps(assignment.customer_latitude!, assignment.customer_longitude!, true)}><Navigation className="h-4 w-4" /> Open Navigation</Button></>}
            {state !== "sharing" ? <Button className="h-12 w-full" onClick={startSharing} disabled={state === "starting" || state === "stopping"}><Power className="h-4 w-4" />{state === "starting" ? "Starting GPS…" : "START TRACKING"}</Button> : <Button variant="destructive" className="h-12 w-full" onClick={stopSharing} disabled={state === "stopping"}><Power className="h-4 w-4" />{state === "stopping" ? "Stopping…" : "STOP TRACKING"}</Button>}
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground"><ShieldCheck className="mb-1 h-4 w-4" /> Your location is shared only for the active delivery session.</div><p className="text-center text-xs text-muted-foreground">{message}</p>
          {state === "error" && <Button variant="outline" className="w-full" onClick={startSharing}>Try Again</Button>}
        </CardContent>
      </Card>
      {showCompletedPrompt && <Card className="mt-4"><CardContent className="space-y-3 pt-6"><p className="font-semibold">Delivery completed.</p><p className="text-sm text-muted-foreground">Stop sharing your location?</p><div className="flex gap-2"><Button className="flex-1" onClick={stopSharing}>STOP TRACKING</Button><Button variant="outline" className="flex-1" onClick={() => setShowCompletedPrompt(false)}>CONTINUE</Button></div></CardContent></Card>}
    </main>
  );
}

function openMaps(lat: number, lng: number, navigation: boolean) { const url = navigation ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving` : `https://www.google.com/maps?q=${lat},${lng}`; window.open(url, "_blank", "noopener,noreferrer"); }
function formatAge(timestamp: number) { const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000)); if (seconds < 60) return `${seconds} seconds ago`; const minutes = Math.floor(seconds / 60); return `${minutes} minute${minutes === 1 ? "" : "s"} ago`; }
