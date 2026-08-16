# Pickup Route Planner

A mobile-first route planner for Facebook Marketplace sourcing pickups. Add
stops with a time window as you line them up, hit **Build Route**, and get a
time-window-aware visiting order with realistic drive times and a one-tap
Google Maps handoff for navigation.

## No API key required

This app runs entirely on free, keyless services:

- **Geocoding**: [Nominatim](https://nominatim.org/) (OpenStreetMap) — turns
  addresses into coordinates.
- **Driving distance/duration**: [OSRM](https://project-osrm.org/) (Open
  Source Routing Machine) — real road-network drive times and distances
  between every pair of stops, not straight-line estimates.
- **Map preview**: [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles.
- **Navigation handoff**: a plain `https://www.google.com/maps/dir/?...` URL
  deep link that opens turn-by-turn navigation in the Google Maps app — this
  is just a link, not an API call, so it needs no key either. A best-effort
  Apple Maps link is included too.

Both defaults point at the public Nominatim and OSRM servers, which is fine
to get started, but **both explicitly say in their own usage policies that
the public instances are for light/demo use, not production traffic**:

- Nominatim: max 1 request/second, and requires an identifying User-Agent
  (this app throttles to that automatically, but set `NOMINATIM_USER_AGENT`
  to your own app name + contact info — see `.env.example`).
- OSRM's public demo server: no uptime or rate guarantees, and asks that
  heavier usage be self-hosted instead.

If you outgrow the public servers — using this daily for real sourcing runs
will likely get there — self-host Nominatim and/or OSRM (both are
open-source and dockerized; see their docs) and point `NOMINATIM_BASE_URL` /
`OSRM_BASE_URL` at your own instance. No code changes needed.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. It's built mobile-first — use your browser's
device toolbar (or just open it on your phone) to see it as intended.

Optionally copy `.env.example` to `.env.local` and set `NOMINATIM_USER_AGENT`
(and `NOMINATIM_BASE_URL` / `OSRM_BASE_URL` if self-hosting) — everything
else works out of the box with no configuration.

## How it works

1. **Add a stop**: address, optional item/contact label, earliest/latest
   time, and how long you expect to be there (default 10 min). The address is
   geocoded immediately via `/api/geocode` (Nominatim) and cached on the
   stop, so rebuilding the route later doesn't re-geocode anything.
2. **Build Route**: `/api/build-route` fetches a real drive-time/distance
   matrix between your start location and every stop in one request (OSRM's
   Table service), then runs the ordering algorithm in `src/lib/routing.ts`.
3. **Ordering algorithm** (`src/lib/routing.ts`, unit-tested in
   `routing.test.ts`): this is **not** a shortest-distance TSP solver. It
   seeds a candidate order two ways — nearest-neighbor-by-drive-time and
   earliest-deadline-first — picks whichever scores better, then runs a
   2-opt + or-opt local search on top. The cost function it optimizes ranks,
   in order: (1) fewest missed time windows, (2) least total lateness in
   minutes, (3) least total drive time. So it will happily accept a longer
   drive if that's what it takes to hit more pickup windows.
4. Each stop is flagged **on time**, **tight** (≤10 min buffer before the
   window closes), or **will miss**, based on the simulated arrival time.
   Note: OSRM's drive times reflect typical road speeds from the map data,
   not live traffic — build times a little slack into windows if traffic is
   a wildcard for your route.
5. **Navigate**: the ordered stops become a Google Maps multi-stop
   directions URL (`src/lib/mapsUrl.ts`). Google Maps' own app UI caps a
   single multi-stop route at 10 points (origin + 9 stops), so routes longer
   than that are split into consecutive legs, each picking up where the last
   one left off. A best-effort Apple Maps link (origin → final stop only —
   Apple's URL scheme doesn't reliably support multi-stop waypoints) is also
   provided.
6. **Rebuild anytime**: adding, editing, or removing a stop just updates
   local state; hitting Build Route re-fetches the matrix and re-runs the
   (fast, local) ordering algorithm — safe to do repeatedly through the day
   as new pickups come in.

Stops and the last built route are persisted to the browser's `localStorage`
(single-user, no backend database needed). The two API routes exist so
geocoding/routing requests come from the server, not the browser, and so
Nominatim's 1-req/sec throttling is enforced in one place.

## Testing

```bash
npm test
```

Unit tests cover the routing algorithm's simulation and ordering logic
directly against synthetic distance matrices — no network calls needed.

## Deploying

Any Next.js host works (Vercel, etc.). No environment variables are required
to deploy; set `NOMINATIM_BASE_URL` / `OSRM_BASE_URL` / `NOMINATIM_USER_AGENT`
if self-hosting either service.
