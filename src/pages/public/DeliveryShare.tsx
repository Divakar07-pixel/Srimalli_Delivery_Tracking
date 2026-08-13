import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDeliveryAssignment, updateDeliveryPartnerLocation, type DeliveryAssignment } from "@/services/tracking";

export function DeliveryShare() {
  const { token = "" } = useParams();
  const [assignment, setAssignment] = useState<DeliveryAssignment | null | undefined>(undefined);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState("Open this page and start sharing while you deliver.");
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    getDeliveryAssignment(token).then(setAssignment).catch(() => setAssignment(null));
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [token]);

  const startSharing = () => {
    if (!navigator.geolocation) {
      setMessage("Location sharing is not supported by this browser.");
      return;
    }
    setSharing(true);
    setMessage("Waiting for your GPS location…");
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        updateDeliveryPartnerLocation(token, coords.latitude, coords.longitude)
          .then(() => setMessage(`Live location shared at ${new Date().toLocaleTimeString()}. Keep this page open.`))
          .catch((error) => setMessage((error as Error).message));
      },
      () => {
        setSharing(false);
        setMessage("Allow location permission, then try again.");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
    );
  };

  if (assignment === undefined) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!assignment) return <div className="mx-auto max-w-md px-4 py-20 text-center"><h1 className="text-xl font-semibold">Delivery link unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Ask the shop to send a current delivery link.</p></div>;

  return <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-10"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Navigation className="h-5 w-5 text-primary" /> Start delivery tracking</CardTitle></CardHeader><CardContent className="space-y-5"><div><p className="text-sm text-muted-foreground">Invoice</p><p className="font-semibold">#{assignment.invoice_number}</p></div><p className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4" /> Your live location is shared only while this order is out for delivery.</p><Button className="w-full" onClick={startSharing} disabled={sharing}>{sharing ? "Sharing live location" : "Start sharing location"}</Button><p className="text-center text-xs text-muted-foreground">{message}</p></CardContent></Card></main>;
}
