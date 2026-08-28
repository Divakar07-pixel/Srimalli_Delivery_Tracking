import { lazy, Suspense, useEffect, useState } from "react";
import { MapPin, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { isGoogleMapsLink, parseCoordinates, formatDistanceKm, haversineKm } from "@/lib/map";
import type { LatLng } from "@/lib/map";

const LeafletMiniMap = lazy(() => import("./LeafletMiniMap").then((m) => ({ default: m.LeafletMiniMap })));

interface MapLinkInputProps {
  value: string;
  onChange: (value: string, coords: LatLng | null) => void;
  shop?: LatLng | null;
  placeholder?: string;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Customer location can be supplied by Google Maps link OR by manual latitude
 * and longitude. Manual coordinates are used when the link cannot be resolved.
 */
export function MapLinkInput({ value, onChange, shop, placeholder, latitude, longitude }: MapLinkInputProps) {
  const parsedCoords = parseCoordinates(value);
  const initialManualLat = latitude != null ? String(latitude) : "";
  const initialManualLng = longitude != null ? String(longitude) : "";
  const [manualLatitude, setManualLatitude] = useState(initialManualLat);
  const [manualLongitude, setManualLongitude] = useState(initialManualLng);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setManualLatitude(latitude != null ? String(latitude) : "");
    setManualLongitude(longitude != null ? String(longitude) : "");
  }, [latitude, longitude]);

  const manualLat = Number.parseFloat(manualLatitude);
  const manualLng = Number.parseFloat(manualLongitude);
  const manualCoords = Number.isFinite(manualLat) && Number.isFinite(manualLng)
    && manualLat >= -90 && manualLat <= 90 && manualLng >= -180 && manualLng <= 180
    ? { lat: manualLat, lng: manualLng }
    : null;
  const coords = parsedCoords ?? manualCoords;
  const distance = coords && shop ? haversineKm(shop, coords) : null;

  const isGoogleMapsUrl = isGoogleMapsLink(value);
  const isInvalidInput = value.trim().length > 0 && !parsedCoords && !isGoogleMapsUrl && !manualCoords;

  const handleManualCoordinateChange = (nextLat: string, nextLng: string) => {
    setManualLatitude(nextLat);
    setManualLongitude(nextLng);
    setDirty(true);
    const lat = Number.parseFloat(nextLat);
    const lng = Number.parseFloat(nextLng);
    const valid = Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    onChange(value, valid ? { lat, lng } : parsedCoords);
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => {
            const nextValue = e.target.value;
            const nextCoords = parseCoordinates(nextValue);
            onChange(nextValue, nextCoords ?? manualCoords);
            setDirty(true);
          }}
          placeholder={placeholder ?? "https://maps.app.goo.gl/... or paste Google Maps link"}
          className="pl-9"
        />
      </div>

      <p className="text-xs text-muted-foreground">Use a Google Maps link, or enter coordinates below if the link cannot be resolved.</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Latitude</label>
          <Input
            type="number"
            step="any"
            min="-90"
            max="90"
            value={manualLatitude}
            onChange={(e) => handleManualCoordinateChange(e.target.value, manualLongitude)}
            placeholder="e.g. 12.9249"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Longitude</label>
          <Input
            type="number"
            step="any"
            min="-180"
            max="180"
            value={manualLongitude}
            onChange={(e) => handleManualCoordinateChange(manualLatitude, e.target.value)}
            placeholder="e.g. 80.1000"
          />
        </div>
      </div>

      {dirty && isInvalidInput && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <XCircle className="h-3.5 w-3.5" />
          We couldn't detect coordinates. Use a Google Maps link or valid latitude and longitude.
        </p>
      )}

      {dirty && isGoogleMapsUrl && !parsedCoords && !manualCoords && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          Google Maps link accepted. If it cannot be resolved, use the latitude and longitude fields above.
        </p>
      )}

      {coords && (
        <p className="flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Location found: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          {distance !== null && <span className="text-muted-foreground"> · {formatDistanceKm(distance)} from shop</span>}
        </p>
      )}

      {coords && shop && (
        <Card className="border-green-200">
          <CardContent className="pt-4">
            <div className="overflow-hidden rounded-md border" style={{ height: 180 }}>
              <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
                <LeafletMiniMap origin={shop} destination={coords} />
              </Suspense>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
