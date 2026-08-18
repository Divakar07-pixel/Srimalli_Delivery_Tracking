import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { MapPin, Navigation, Phone, Power, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeliveryRouteMap } from "@/components/map/DeliveryRouteMap";
import { getDeliveryAssignment, startDeliveryTracking, stopDeliveryTracking, updateDeliveryPartnerLocation, type DeliveryAssignment } from "@/services/tracking";

type TrackingState = "idle" | "starting" | "sharing" | "stopping" | "error";
type CurrentLocation = { latitude: number; longitude: number; accuracy: number | null };

const timelineSteps = [
  { key: "arrived_at_hub", label: "Arrived at Hub" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
] as const;

const gpsOptions: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 };
const MIN_SEND_DISTANCE_M = 5;
const MAX_SEND_INTERVAL_MS = 10_000;
const POOR_ACCURACY_M = 50;

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371000;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function DeliveryShare() {
  const { token = "" } = useParams();
  const [assignment, setAssignment] = useState<DeliveryAssignment | null | undefined>(undefined);
  const [state, setState] = useState<TrackingState>("idle");
  const [message, setMessage] = useState("Start tracking when you begin the delivery.");
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [, setClock] = useState(0);
  const [showCompletedPrompt, setShowCompletedPrompt] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastSentAt = useRef(0);
  const lastSentLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const sendInFlight = useRef(false);
  const lastPositionAt = useRef(0);
  const latestPosition = useRef<GeolocationPosition | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    getDeliveryAssignment(token)
      .then((data) => {
        setAssignment(data);
        if (data?.status === "delivered" && data.tracking_active) setShowCompletedPrompt(true);
        if (data?.tracking_active) setState("sharing");
      })
      .catch(() => setAssignment(null));
    return () => {
      if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
      if (wakeLock.current) void wakeLock.current.release().catch(() => {});
    };
  }, [token]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock((value) => value + 1), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator && !wakeLock.current) {
        wakeLock.current = await navigator.wakeLock.request("screen");
        wakeLock.current.addEventListener("release", () => { wakeLock.current = null; });
      }
    } catch { /* optional */ }
  };

  const sendPosition = async (position: GeolocationPosition) => {
    latestPosition.current = position;
    lastPositionAt.current = Date.now();
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null;
    const now = Date.now();
    setCurrentLocation({ latitude, longitude, accuracy });

    const previous = lastSentLocation.current;
    const moved = previous ? distanceMeters(previous, { latitude, longitude }) : Number.POSITIVE_INFINITY;
    const dueByTime = now - lastSentAt.current >= MAX_SEND_INTERVAL_MS;
    const dueByMovement = moved >= MIN_SEND_DISTANCE_M;
    if (sendInFlight.current || (!dueByMovement && !dueByTime && previous)) return;

    sendInFlight.current = true;
    try {
      await updateDeliveryPartnerLocation(token, latitude, longitude, accuracy ?? undefined);
      lastSentAt.current = Date.now();
      lastSentLocation.current = { latitude, longitude };
      setLastUpdate(Date.now());
      setMessage(accuracy != null && accuracy > POOR_ACCURACY_M
        ? "GPS connected. Accuracy is currently low; the device is reporting its best available location."
        : "GPS connected. Location is sharing.");
    } catch (error) {
      setState("error");
      setMessage((error as Error).message);
    } finally {
      sendInFlight.current = false;
    }
  };

  const startGpsWatch = () => {
    if (!navigator.geolocation) return;
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = navigator.geolocation.watchPosition(
      (position) => void sendPosition(position),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setState("error");
          setMessage("Location access is required to share your live delivery location.");
        } else if (error.code === error.TIMEOUT) {
          setMessage("GPS took too long to respond. Reconnecting GPS…");
        } else {
          setMessage("GPS is temporarily unavailable. Reconnecting GPS…");
        }
      },
      gpsOptions
    );
  };

  useEffect(() => {
    if (state !== "sharing") return;
    const recoverGps = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (position) => void sendPosition(position),
        () => { if (Date.now() - lastPositionAt.current > 10_000) startGpsWatch(); },
        gpsOptions
      );
      if (Date.now() - lastPositionAt.current > 10_000) startGpsWatch();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") recoverGps();
    };
    window.addEventListener("pageshow", recoverGps);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(recoverGps, 5_000);
    recoverGps();
    return () => {
      window.removeEventListener("pageshow", recoverGps);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const startSharing = async () => {
    if (!navigator.geolocation) {
      setState("error");
      setMessage("Location services are not supported by this browser.");
      return;
    }
    setState("starting");
    setMessage("Requesting GPS permission…");
    try {
      const started = await startDeliveryTracking(token);
      if (!started) throw new Error("This delivery link is no longer active.");
      setAssignment(started);
      await requestWakeLock();
      lastSentAt.current = 0;
      lastSentLocation.current = null;
      lastPositionAt.current = 0;
      startGpsWatch();
      setState("sharing");
      setMessage("GPS connected. Location is sharing.");
    } catch (error) {
      setState("error");
      setMessage((error as Error).message);
    }
  };

  const stopSharing = async () => {
    setState("stopping");
    try {
      const position = latestPosition.current;
      await stopDeliveryTracking(token, position?.coords.latitude, position?.coords.longitude);
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      if (wakeLock.current) await wakeLock.current.release().catch(() => {});
      setState("idle");
      setMessage("Location sharing stopped.");
      setAssignment((current) => current ? { ...current, tracking_active: false } : current);
      setShowCompletedPrompt(false);
    } catch (error) {
      setState("error");
      setMessage((error as Error).message);
    }
  };

  const activeTimelineIndex = useMemo(() => {
    const status = assignment?.status;
    const index = timelineSteps.findIndex((step) => step.key === status);
    return index >= 0 ? index : status === "out_for_delivery" ? 1 : status === "delivered" ? 2 : 0;
  }, [assignment?.status]);

  if (assignment === undefined) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!assignment) return <div className="mx-auto max-w-md bg-background px-4 py-20 text-center text-foreground"><h1 className="text-xl font-semibold">Delivery link unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Ask the shop to send a current delivery link.</p></div>;

  const isBusy = state === "starting" || state === "stopping";
  const hasCustomerLocation = assignment.customer_latitude != null && assignment.customer_longitude != null;
  const gpsAccuracy = currentLocation?.accuracy;
  const poorAccuracy = gpsAccuracy != null && gpsAccuracy > POOR_ACCURACY_M;
  const driverPoint = currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null;
  const customerPoint = hasCustomerLocation ? { lat: assignment.customer_latitude!, lng: assignment.customer_longitude! } : null;
  const phone = assignment.customer_mobile?.replace(/[^\d+]/g, "") || null;
  const isSharing = state === "sharing";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-md px-4 py-6 sm:py-10">
        <div className="mb-4 text-sm font-medium text-muted-foreground">Driver delivery</div>

        <Card className="border-border bg-card text-card-foreground">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Navigation className="h-5 w-5 text-primary" /> 🛵 Delivery Tracking</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">GPS Status</p>
              <p className="mt-1 flex items-center gap-2 font-medium"><span className={`h-2.5 w-2.5 rounded-full ${isSharing ? "bg-green-500" : "bg-muted-foreground"}`} />{isSharing ? "GPS Connected" : "GPS Disconnected"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Location: {isSharing ? "Sharing" : "Not sharing"}</p>
              {currentLocation && <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs"><p className="font-medium text-foreground">Current location</p><p className="mt-1 text-muted-foreground">Latitude: {currentLocation.latitude.toFixed(6)}</p><p className="text-muted-foreground">Longitude: {currentLocation.longitude.toFixed(6)}</p><p className={poorAccuracy ? "mt-1 font-medium text-warning" : "mt-1 text-muted-foreground"}>GPS accuracy: {gpsAccuracy != null ? `±${Math.round(gpsAccuracy)} m` : "unknown"}</p>{poorAccuracy && <p className="mt-1 text-warning">Accuracy is low. Keep GPS/location services enabled and move outdoors for a better fix.</p>}</div>}
              {lastUpdate && <p className="mt-2 text-xs text-muted-foreground">Last Update: {formatAge(lastUpdate)}</p>}
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <p className="mb-4 text-sm font-semibold">Delivery Timeline</p>
              <div className="grid grid-cols-3 gap-2">
                {timelineSteps.map((step, index) => {
                  const complete = index <= activeTimelineIndex;
                  const current = index === activeTimelineIndex;
                  return <div key={step.key} className="relative text-center">{index < timelineSteps.length - 1 && <span className={`absolute left-1/2 top-3 h-0.5 w-full ${index < activeTimelineIndex ? "bg-primary" : "bg-border"}`} aria-hidden="true" />}<span className={`relative z-10 mx-auto flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${complete ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"} ${current ? "ring-4 ring-primary/20" : ""}`}>{index + 1}</span><span className={`mt-2 block text-[11px] leading-4 ${current ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{step.label}</span></div>;
                })}
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-semibold">{assignment.customer_name}</p>
              {phone ? <a href={`tel:${phone}`} className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"><Phone className="h-4 w-4" />{assignment.customer_mobile}</a> : <p className="mt-1 text-sm text-muted-foreground">Phone number unavailable</p>}
              <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{assignment.customer_address || "Saved delivery location"}</p>
            </div>

            {!isSharing && <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground"><p className="font-medium text-foreground">Start the delivery first</p><p className="mt-1">After GPS starts, this page will show your live position against the saved customer location.</p></div>}

            {isSharing && <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-between bg-muted/40 px-3 py-2 text-xs"><span className="font-medium">Customer location & live route</span><span className="text-muted-foreground">Leaflet · live GPS</span></div>
              {hasCustomerLocation ? <DeliveryRouteMap shop={null} customer={customerPoint} driver={driverPoint} height={280} /> : <div className="p-4 text-sm text-muted-foreground">No exact customer coordinates were saved for this order. Confirm the customer's location before navigating.</div>}
            </div>}

            <div className="grid gap-2">
              {!isSharing ? <Button className="h-12 w-full" onClick={startSharing} disabled={isBusy}><Power className="h-4 w-4" />{state === "starting" ? "Starting GPS…" : "START TRACKING"}</Button> : <Button variant="destructive" className="h-12 w-full" onClick={stopSharing} disabled={isBusy}><Power className="h-4 w-4" />STOP TRACKING</Button>}
              {phone && <Button variant="outline" className="h-12 w-full" asChild><a href={`tel:${phone}`}><Phone className="h-4 w-4" /> CALL CUSTOMER</a></Button>}
              {isSharing && hasCustomerLocation && <Button className="h-12 w-full" onClick={() => openMaps(assignment.customer_latitude!, assignment.customer_longitude!, true)}><Navigation className="h-4 w-4" /> NAVIGATE WITH GOOGLE MAPS</Button>}
            </div>

            <p className="text-center text-xs text-muted-foreground">Flow: Start GPS → verify customer location → call customer if needed → open Google Maps → navigate → reach customer → stop tracking.</p>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground"><ShieldCheck className="mb-1 h-4 w-4" /> Your location is shared only for the active delivery session.</div>
            <p className="text-center text-xs text-muted-foreground">{message}</p>
            {state === "error" && <Button variant="outline" className="w-full" onClick={startSharing}>Try Again</Button>}
          </CardContent>
        </Card>

        {showCompletedPrompt && <Card className="mt-4"><CardContent className="space-y-3 pt-6"><p className="font-semibold">Delivery completed.</p><p className="text-sm text-muted-foreground">Stop sharing your location?</p><div className="flex gap-2"><Button className="flex-1" onClick={stopSharing}>STOP TRACKING</Button><Button variant="outline" className="flex-1" onClick={() => setShowCompletedPrompt(false)}>CONTINUE</Button></div></CardContent></Card>}
      </div>
    </main>
  );
}

function openMaps(lat: number, lng: number, navigation: boolean) {
  const url = navigation
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=two-wheeler&dir_action=navigate`
    : `https://www.google.com/maps?q=${lat},${lng}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function formatAge(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}