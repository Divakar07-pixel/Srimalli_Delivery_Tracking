/**
 * Map helpers — coordinate parsing, distance and ETA estimation.
 * Pure functions (no Leaflet dependency) so they can be used anywhere.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Returns whether a URL points to Google Maps, including its shortened share links. */
export function isGoogleMapsLink(input: string | null | undefined): boolean {
  if (!input?.trim()) return false;

  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase();
    const isGoogleDomain = host === "google.com" || host.endsWith(".google.com");

    return (
      host === "maps.app.goo.gl" ||
      (host === "goo.gl" && url.pathname.startsWith("/maps")) ||
      (isGoogleDomain && (host === "maps.google.com" || url.pathname.startsWith("/maps")))
    );
  } catch {
    return false;
  }
}

/** Extracts a latitude/longitude pair from a Google Maps URL or a bare "lat,lng" string. */
export function parseCoordinates(input: string | null | undefined): LatLng | null {
  if (!input?.trim()) return null;
  const text = input.trim();

  // Pattern: https://maps.app.goo.gl/...@12.9716,77.5945,17z  or ...!3d12.9716!4d77.5945
  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValid(lat, lng)) return { lat, lng };
  }

  // Pattern: ...!3d12.9716!4d77.5945
  const queryMatch = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (isValid(lat, lng)) return { lat, lng };
  }

  // Pattern: /place/12.9716,77.5946 or /dir/.../12.9716,77.5946
  const pathMatch = text.match(/\/(?:place|dir)\/(?:[^/]+\/)?(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (pathMatch) {
    const lat = parseFloat(pathMatch[1]);
    const lng = parseFloat(pathMatch[2]);
    if (isValid(lat, lng)) return { lat, lng };
  }

  // Pattern: https://www.google.com/maps/search/?api=1&query=12.9716,77.5945
  // Also supports links using q= or ll= as the coordinate query parameter.
  try {
    const url = new URL(text);
    const query = url.searchParams.get("query") ?? url.searchParams.get("q") ?? url.searchParams.get("ll");
    const coordinateMatch = query?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordinateMatch) {
      const lat = parseFloat(coordinateMatch[1]);
      const lng = parseFloat(coordinateMatch[2]);
      if (isValid(lat, lng)) return { lat, lng };
    }
  } catch {
    // A non-URL input may still be a valid bare coordinate pair below.
  }

  // Plain "lat,lng"
  const bareMatch = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (bareMatch) {
    const lat = parseFloat(bareMatch[1]);
    const lng = parseFloat(bareMatch[2]);
    if (isValid(lat, lng)) return { lat, lng };
  }

  return null;
}

function isValid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** Builds a Google Maps "directions" URL between two points. */
export function buildDirectionsUrl(origin: LatLng | null, destination: LatLng | null): string | null {
  if (!origin || !destination) return null;
  const o = `${origin.lat},${origin.lng}`;
  const d = `${destination.lat},${destination.lng}`;
  return `https://www.google.com/maps/dir/${o}/${d}`;
}

/** Builds a Google Maps "place pin" URL for a single coordinate. */
export function buildMapsPinUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/** Great-circle (Haversine) distance in kilometres between two coordinates. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Formats a kilometre distance into a friendly label (e.g. "1.2 km", "850 m"). */
export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Rough travel-time estimate in minutes for a straight-line distance.
 * Uses an average effective speed that accounts for roads (roughly 1.4x the
 * straight line). This is an estimate only — Zomato-style, not turn-by-turn.
 */
export function estimateMinutes(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return 0;
  const roadKm = km * 1.4;
  const speedKmh = 30; // average urban speed
  return Math.max(Math.round((roadKm / speedKmh) * 60), 1);
}

/** Formats a number of minutes into "X min" or "X hr Y min". */
export function formatDuration(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "—";
  if (min < 60) return `${min} min`;
  const hrs = Math.floor(min / 60);
  const rem = min % 60;
  return rem ? `${hrs} hr ${rem} min` : `${hrs} hr`;
}
