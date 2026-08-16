import type { LatLng } from "./types";

// Google Maps' own app UI caps a single multi-stop driving route at 10 stops
// (1 origin + up to 9 waypoints/destination). We chunk longer routes into
// consecutive legs, each ending where the next one starts, so every stop is
// still reachable via one-tap navigation.
const MAX_POINTS_PER_LEG = 10;

function formatPoint(p: LatLng): string {
  return `${p.lat},${p.lng}`;
}

/** Build one or more Google Maps multi-stop directions URLs covering every point in order. */
export function buildGoogleMapsUrls(points: LatLng[]): string[] {
  if (points.length < 2) return [];

  const legs: LatLng[][] = [];
  let i = 0;
  while (i < points.length - 1) {
    const legPoints = points.slice(i, i + MAX_POINTS_PER_LEG);
    legs.push(legPoints);
    i += MAX_POINTS_PER_LEG - 1; // next leg starts where this one ends
  }

  return legs.map((legPoints) => {
    const origin = legPoints[0]!;
    const destination = legPoints[legPoints.length - 1]!;
    const waypoints = legPoints.slice(1, -1);

    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("origin", formatPoint(origin));
    url.searchParams.set("destination", formatPoint(destination));
    if (waypoints.length > 0) {
      url.searchParams.set("waypoints", waypoints.map(formatPoint).join("|"));
    }
    url.searchParams.set("travelmode", "driving");
    return url.toString();
  });
}

/**
 * Apple Maps' URL scheme doesn't reliably support multi-stop waypoints, so
 * this links only the first-to-last leg (origin -> final stop). Prefer the
 * Google Maps links for the full ordered route.
 */
export function buildAppleMapsUrl(points: LatLng[]): string {
  if (points.length < 2) return "";
  const origin = points[0]!;
  const destination = points[points.length - 1]!;
  const url = new URL("https://maps.apple.com/");
  url.searchParams.set("saddr", formatPoint(origin));
  url.searchParams.set("daddr", formatPoint(destination));
  url.searchParams.set("dirflg", "d");
  return url.toString();
}
