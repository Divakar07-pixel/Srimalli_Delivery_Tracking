import { lazy, Suspense, useState } from "react";
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
}

/**
 * A text field for capturing a Google Maps share/pin link.
 * Live-parses the @lat,lng pair, shows a validation hint, and (when a shop is
 * supplied) a small inline distance + map preview.
 */
export function MapLinkInput({ value, onChange, shop, placeholder }: MapLinkInputProps) {
  const coords = parseCoordinates(value);
  const distance = coords && shop ? haversineKm(shop, coords) : null;
  const [dirty, setDirty] = useState(false);

  const isGoogleMapsUrl = isGoogleMapsLink(value);
  const isInvalidInput = value.trim().length > 0 && !coords && !isGoogleMapsUrl;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value, parseCoordinates(e.target.value));
            setDirty(true);
          }}
          placeholder={placeholder ?? "https://maps.app.goo.gl/... or paste Google Maps link"}
          className="pl-9"
        />
      </div>

      {dirty && isInvalidInput && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <XCircle className="h-3.5 w-3.5" />
          We couldn't detect coordinates. Use a Google Maps share/pin link.
        </p>
      )}

      {dirty && isGoogleMapsUrl && !coords && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          Google Maps link accepted. This shortened link does not expose coordinates for a route preview.
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
