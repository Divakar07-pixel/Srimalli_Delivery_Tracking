import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/map";

import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

interface LeafletMiniMapProps {
  origin: LatLng;
  destination: LatLng;
}

function makeDotIcon(color: string) {
  const html = `<div style="
    width:26px;height:26px;border-radius:50%;
    background:${color};border:2px solid #fff;
    box-shadow:0 1px 4px rgba(0,0,0,.3);
  "></div>`;
  return L.divIcon({ html, className: "", iconSize: [26, 26], iconAnchor: [13, 13] });
}

export function LeafletMiniMap({ origin, destination }: LeafletMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    const a = L.latLng(origin.lat, origin.lng);
    const b = L.latLng(destination.lat, destination.lng);

    L.marker(a, { icon: makeDotIcon("#f59e0b") }).addTo(map).bindPopup("Shop");
    L.marker(b, { icon: makeDotIcon("#ef4444") }).addTo(map).bindPopup("Customer");
    L.polyline([a, b], { color: "#3b82f6", weight: 3, dashArray: "6,4", opacity: 0.8 }).addTo(map);

    map.fitBounds(L.latLngBounds([a, b]), { padding: [30, 30], maxZoom: 16 });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [origin, destination]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Route preview map" />;
}
