import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { MapPin, Navigation, Power, ShieldCheck, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDeliveryAssignment, startDeliveryTracking, stopDeliveryTracking, updateDeliveryPartnerLocation, type DeliveryAssignment } from "@/services/tracking";

type TrackingState = "idle" | "starting" | "sharing" | "stopping" | "error";
type Theme = "light" | "dark";
type CurrentLocation = { latitude: number; longitude: number; accuracy: number | null };

const timelineSteps = [
  { key: "arrived_at_hub", label: "Arrived at Hub" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
] as const;

// Fresh, high-accuracy GPS. Browser/device accuracy is reported instead of being hidden.
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
  // Light is the default on every phone/browser. Dark mode is only enabled
  // when the driver explicitly selects it with the theme control.
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem("delivery-driver-theme") === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  });
  const [showCompletedPrompt, setShowCompletedPrompt] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastSentAt = useRef(0);
  const lastSentLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const sendInFlight = useRef(false);
  const lastPositionAt = useRef(0);
  const latestPosition = useRef<GeolocationPosition | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const previousDark = root.classList.contains("dark");
    const previousColorScheme = root.style.colorScheme;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    try { localStorage.setItem("delivery-driver-theme", theme); } catch { /* localStorage may be unavailable */ }
    return () => {
      root.classList.toggle("dark", previousDark);
      root.style.colorScheme = previousColorScheme;
    };
  }, [theme]);

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

  // Keep the "X seconds ago" text live even when the GPS provider is temporarily quiet.
  useEffect(() => {
    const interval = window.setInterval(() => setClock((value) => value + 1), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator && !wakeLock.current) {