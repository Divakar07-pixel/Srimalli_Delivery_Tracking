import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import type { LatLng } from "@/lib/map";

// Import Leaflet's bundled marker images so they resolve correctly under Vite.
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
  driver?: LatLng | null;
  className?: string;
  /** Optional map height in pixels; defaults to 280. */
  height?: number;
  markers?: MarkerMeta[];
}

// Fix Leaflet's default icon paths that break with bundlers.
function fixIconDefaults() {
  L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
  });
}

const SHOP_EMOJI = "🏪";
const CUSTOMER_EMOJI = "🏠";
const DRIVER_EMOJI = "🛵";

function makeIcon(emoji: string, color: string) {
  const html = `<div style="
    width:34px;height:34px;border-radius:50%;
    background:${color};color:#fff;
    display:flex;align-items:center;justify-content:center;
    font-size:18px;border:2px solid #fff;
    box-shadow:0 2px 6px rgba(0,0,0,.3);
  ">${emoji}</div>`;
  return L.divIcon({ html, className: "", iconSize: [34, 34], iconAnchor: [17, 17] });
}

export function DeliveryRouteMap({ shop, customer, driver, className, height = 280, markers = [] }: DeliveryRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [route, setRoute] = useState<LatLng[] | null>(null);

  // Build the list of points once.
  const points = useMemo(() => {
    const list: MarkerMeta[] = [];
    if (shop) list.push({ lat: shop.lat, lng: shop.lng, label: "Shop", emoji: SHOP_EMOJI, color: "#f59e0b" });
    if (customer) list.push({ lat: customer.lat, lng: customer.lng, label: "Customer", emoji: CUSTOMER_EMOJI, color: "#ef4444" });
    if (driver) list.push({ lat: driver.lat, lng: driver.lng, label: "Delivery", emoji: DRIVER_EMOJI, color: "#3b82f6" });
    return list;
  }, [shop, customer, driver]);

  // Use a road route when the routing service is reachable. The map still
  // works offline or when the service is unavailable by drawing a direct line.
  useEffect(() => {
    if (!shop || !customer) {
      setRoute(null);
      return;
    }

    const controller = new AbortController();
    const url = `https://router.project-osrm.org/route/v1/driving/${shop.lng},${shop.lat};${customer.lng},${customer.lat}?overview=full&geometries=geojson`;
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
  }, [shop, customer]);

  // Any extra markers (e.g. live GPS) get appended.
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

  // Redraw markers + fit bounds whenever points change.
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

    // Draw the driving route between shop and customer (or a direct fallback).
    if (shop && customer) {
      L.polyline((route ?? [shop, customer]).map((point) => [point.lat, point.lng]), {
        color: "#3b82f6",
        weight: 4,
        dashArray: route ? undefined : "6,4",
        opacity: 0.8,
      }).addTo(layerGroup);
    }
    if (driver && customer) {
      L.polyline([[driver.lat, driver.lng], [customer.lat, customer.lng]], {
        color: "#10b981",
        weight: 3,
        opacity: 0.8,
      }).addTo(layerGroup);
    }

    // Fit bounds to show all points.
    const latLngs = allPoints.map((p) => L.latLng(p.lat, p.lng));
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [points, markers, route, shop, customer, driver]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full overflow-hidden rounded-lg border", className)}
      style={{ height }}
      aria-label="Delivery route map"
    />
  );
}
