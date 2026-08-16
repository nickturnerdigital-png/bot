/**
 * Geocoding via Nominatim (OpenStreetMap) — free, no API key.
 *
 * Nominatim's public usage policy (https://operations.osmfoundation.org/policies/nominatim/)
 * requires a max of 1 request/second and an identifying User-Agent or Referer.
 * We throttle to that rate here. For heavier usage, self-host Nominatim (or
 * point NOMINATIM_BASE_URL at another instance) rather than hammering the
 * public one.
 */

const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  "pickup-route-planner/0.1 (set NOMINATIM_USER_AGENT env var to your app name + contact info)";

const MIN_INTERVAL_MS = 1100;
let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  await throttle();

  const url = new URL(`${NOMINATIM_BASE_URL}/search`);
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Geocoding request failed: ${res.status}`);
  }

  const results = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`Could not find an address matching "${address}"`);
  }

  const best = results[0]!;
  return {
    lat: parseFloat(best.lat),
    lng: parseFloat(best.lon),
    formattedAddress: best.display_name,
  };
}
