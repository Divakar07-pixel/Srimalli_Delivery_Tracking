import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import { resolveDeliveryCoordinates } from "@/services/tracking";
import type { LatLng } from "@/lib/map";

import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

interface MarkerMeta {
  lat: number;
  lng: number;
  label: string;
  color?: string;
  emoji?: string;
}

interface DeliveryRouteMapProps {
  shop: LatLng | null;
  customer: LatLng | null;
  customerMapUrl?: string | null;
  driver?: LatLng | null;
  className?: string;
  height?: number;
  markers?: MarkerMeta[];
  onRefresh?: () => void | Promise<void>;
}

function fixIconDefaults() {
  L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
}

const SHOP_EMOJI = "🏪";
const CUSTOMER_EMOJI = "🏠";
const DRIVER_EMOJI = "🛵";

function makeIcon(emoji: string, color: string) {
  const html = `<div style="width:36px;height:36px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:19px;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35);">${emoji}</div>`;
  return L.divIcon({ html, className: "", iconSize: [36, 36], iconAnchor: [18, 18] });
}

export function DeliveryRouteMap({ shop, customer, customerMapUrl, driver, className, height = 280, markers = [], onRefresh }: DeliveryRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [resolvedCustomer, setResolvedCustomer] = useState<LatLng | null>(null);
  const [route, setRoute] = useState<LatLng[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolvedCustomer(null);
    if (customer || !customerMapUrl) return;
    resolveDeliveryCoordinates(customerMapUrl).then((coordinates) => {
      if (!cancelled && coordinates) setResolvedCustomer(coordinates);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [customer, customerMapUrl]);

  const effectiveCustomer = customer ?? resolvedCustomer;

  const points = useMemo(() => {
    const list: MarkerMeta[] = [];
    if (shop) list.push({ lat: shop.lat, lng: shop.lng, label: "Shop", emoji: SHOP_EMOJI, color: "#f59e0b" });
    if (effectiveCustomer) list.push({ lat: effectiveCustomer.lat, lng: effectiveCustomer.lng, label: "Customer", emoji: CUSTOMER_EMOJI, color: "#ef4444" });
    if (driver) list.push({ lat: driver.lat, lng: driver.lng, label: "Delivery driver", emoji: DRIVER_EMOJI, color: "#2563eb" });
    return list;
  }, [shop, effectiveCustomer, driver]);

  const routeStart = driver ?? shop;
  const routeStartKey = routeStart ? `${routeStart.lat},${routeStart.lng}` : "none";

  useEffect(() => {
    if (!routeStart || !effectiveCustomer) {
      setRoute(null);
      return;
    }

    const controller = new AbortController();
    const url = `https://router.project-osrm.org/route/v1/driving/${routeStart.lng},${routeStart.lat};${effectiveCustomer.lng},${effectiveCustomer.lat}?overview=full&geometries=geojson`;
    fetch(url, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Route unavailable"))))
      .then((data) => {
        const coordinates = data.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
        setRoute(coordinates?.length ? coordinates.map(([lng, lat]) => ({ lat, lng })) : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRoute(null);
      });

    return () => controller.abort();
  }, [routeStartKey, effectiveCustomer?.lat, effectiveCustomer?.lng]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    fixIconDefaults();
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = layerGroup;
    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    const allPoints = [...points, ...markers];
    if (allPoints.length === 0) return;

    allPoints.forEach((p) => {
      const icon = makeIcon(p.emoji ?? "📍", p.color ?? "#64748b");
      L.marker([p.lat, p.lng], { icon })
        .addTo(layerGroup)
        .bindPopup(`<strong>${p.label}</strong><br/>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`);
    });

    if (routeStart && effectiveCustomer) {
      const routePoints = route ?? [routeStart, effectiveCustomer];
      L.polyline(routePoints.map((point) => [point.lat, point.lng]), {
        color: "#ffffff",
        weight: 8,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(layerGroup);
      L.polyline(routePoints.map((point) => [point.lat, point.lng]), {
        color: driver ? "#10b981" : "#3b82f6",
        weight: 5,
        dashArray: route ? undefined : "8,7",
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(layerGroup);
    }

    const latLngs = allPoints.map((p) => L.latLng(p.lat, p.lng));
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [points, markers, route, routeStartKey, effectiveCustomer, driver]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh?.();
      mapRef.current?.invalidateSize();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-lg border", className)}
      style={{ height }}
      aria-label="Delivery route map"
    >
      <div ref={containerRef} className="absolute inset-0" />
      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={refreshing}
        aria-label="Refresh live delivery location"
        title="Refresh live delivery location"
        className="absolute left-[48px] top-2 z-[1000] flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/95 text-foreground shadow-md backdrop-blur-sm transition hover:bg-muted disabled:cursor-wait disabled:opacity-70"
      >
        <span className={refreshing ? "animate-spin" : ""}>↻</span>
      </button>
    </div>
  );
}
