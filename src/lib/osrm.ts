/**
 * Real driving distance/duration via OSRM (Open Source Routing Machine) —
 * free, no API key. Defaults to the public demo server, which OSRM
 * explicitly documents as demo-only (no uptime/rate guarantees, not for
 * production load). Point OSRM_BASE_URL at a self-hosted instance for
 * anything beyond light personal use.
 */

import type { DistanceMatrix, LatLng } from "./types";

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

function formatCoords(points: LatLng[]): string {
  return points.map((p) => `${p.lng},${p.lat}`).join(";");
}

interface OsrmTableResponse {
  code: string;
  message?: string;
  durations: (number | null)[][];
  distances: (number | null)[][];
}

/**
 * Build a full NxN travel-time/distance matrix for a list of points using
 * OSRM's Table service (one request covers the whole matrix — no chunking
 * needed like Google's Distance Matrix element limits).
 */
export async function fetchDistanceMatrix(points: LatLng[]): Promise<DistanceMatrix> {
  if (points.length < 2) {
    return points.map(() => points.map(() => ({ durationMinutes: 0, distanceMiles: 0 })));
  }

  const url = new URL(`${OSRM_BASE_URL}/table/v1/driving/${formatCoords(points)}`);
  url.searchParams.set("annotations", "duration,distance");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Routing request failed: ${res.status}`);
  }

  const data = (await res.json()) as OsrmTableResponse;
  if (data.code !== "Ok") {
    throw new Error(`Routing error: ${data.code}${data.message ? ` — ${data.message}` : ""}`);
  }

  return data.durations.map((row, i) =>
    row.map((durationSeconds, j) => {
      const distanceMeters = data.distances[i]?.[j];
      if (durationSeconds == null || distanceMeters == null) {
        // No driving route found between this pair (e.g. across water) — treat as
        // unreachable so the router avoids it rather than crashing.
        return { durationMinutes: Number.POSITIVE_INFINITY, distanceMiles: Number.POSITIVE_INFINITY };
      }
      return {
        durationMinutes: durationSeconds / 60,
        distanceMiles: distanceMeters / 1609.344,
      };
    })
  );
}

interface OsrmRouteResponse {
  code: string;
  routes?: Array<{ geometry: { coordinates: [number, number][] } }>;
}

/** Fetch the actual driving route geometry through an ordered list of points, for map display. */
export async function fetchRouteGeometry(orderedPoints: LatLng[]): Promise<[number, number][]> {
  if (orderedPoints.length < 2) return [];

  const url = new URL(`${OSRM_BASE_URL}/route/v1/driving/${formatCoords(orderedPoints)}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = (await res.json()) as OsrmRouteResponse;
  const coordinates = data.routes?.[0]?.geometry.coordinates;
  if (data.code !== "Ok" || !coordinates) return [];

  // GeoJSON coordinates are [lng, lat]; Leaflet wants [lat, lng].
  return coordinates.map(([lng, lat]) => [lat, lng]);
}
