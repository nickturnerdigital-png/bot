import type { DistanceMatrix, DistanceMatrixCell, LatLng } from "./types";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";

// Distance Matrix API caps elements (origins x destinations) per request.
// Chunking to 10x10 keeps every request well under that limit.
const MATRIX_CHUNK_SIZE = 10;

function getServerKey(): string {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_MAPS_SERVER_KEY is not set. Add it to your environment (see .env.example)."
    );
  }
  return key;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const key = getServerKey();
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Geocoding request failed: ${res.status}`);
  }
  const data = await res.json();

  if (data.status !== "OK" || !data.results?.length) {
    throw new Error(
      `Could not geocode "${address}": ${data.status ?? "unknown error"}${
        data.error_message ? ` — ${data.error_message}` : ""
      }`
    );
  }

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function formatLatLng(p: LatLng): string {
  return `${p.lat},${p.lng}`;
}

async function fetchMatrixChunk(
  origins: LatLng[],
  destinations: LatLng[]
): Promise<DistanceMatrixCell[][]> {
  const key = getServerKey();
  const url = new URL(DISTANCE_MATRIX_URL);
  url.searchParams.set("origins", origins.map(formatLatLng).join("|"));
  url.searchParams.set("destinations", destinations.map(formatLatLng).join("|"));
  url.searchParams.set("units", "imperial");
  url.searchParams.set("mode", "driving");
  url.searchParams.set("departure_time", "now"); // traffic-aware duration
  url.searchParams.set("traffic_model", "best_guess");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Distance Matrix request failed: ${res.status}`);
  }
  const data = await res.json();

  if (data.status !== "OK") {
    throw new Error(`Distance Matrix error: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`);
  }

  return data.rows.map((row: { elements: Array<Record<string, unknown>> }) =>
    row.elements.map((el) => {
      if (el.status !== "OK") {
        // Unreachable pair (e.g. across water, no driving route). Mark as
        // effectively unreachable so the router avoids it but doesn't crash.
        return { durationMinutes: Number.POSITIVE_INFINITY, distanceMiles: Number.POSITIVE_INFINITY };
      }
      const durationSeconds = ((el.duration_in_traffic ?? el.duration) as { value: number }).value;
      const distanceMeters = (el.distance as { value: number }).value;
      return {
        durationMinutes: durationSeconds / 60,
        distanceMiles: distanceMeters / 1609.344,
      };
    })
  );
}

/**
 * Build a full NxN travel-time/distance matrix for a list of points using
 * the Distance Matrix API, chunking requests to stay under the API's
 * per-request element limits.
 */
export async function fetchDistanceMatrix(points: LatLng[]): Promise<DistanceMatrix> {
  const n = points.length;
  const matrix: DistanceMatrixCell[][] = Array.from({ length: n }, () => new Array(n));

  const originChunks = chunk(
    points.map((p, i) => ({ point: p, i })),
    MATRIX_CHUNK_SIZE
  );
  const destChunks = chunk(
    points.map((p, j) => ({ point: p, j })),
    MATRIX_CHUNK_SIZE
  );

  const requests: Array<Promise<void>> = [];
  for (const originChunk of originChunks) {
    for (const destChunk of destChunks) {
      requests.push(
        fetchMatrixChunk(
          originChunk.map((o) => o.point),
          destChunk.map((d) => d.point)
        ).then((cells) => {
          cells.forEach((row, rowIdx) => {
            row.forEach((cell, colIdx) => {
              const originIdx = originChunk[rowIdx]!.i;
              const destIdx = destChunk[colIdx]!.j;
              matrix[originIdx]![destIdx] = cell;
            });
          });
        })
      );
    }
  }

  await Promise.all(requests);
  return matrix;
}
