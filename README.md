# Pickup Route Planner

A mobile-first route planner for Facebook Marketplace sourcing pickups. Add
stops with a time window as you line them up, hit **Build Route**, and get a
time-window-aware visiting order with realistic drive times and a one-tap
Google Maps handoff for navigation.

## ⚠️ Before you start: this requires a billed Google Cloud project

This app calls the Google Maps Platform APIs for geocoding and drive times.
Those APIs require a Google Cloud project **with billing enabled** — Google
Maps Platform has a monthly free usage credit, but a live API key will not
work at all without a billing account attached, even if you stay under the
free tier.

### 1. Create/select a Google Cloud project

Go to [console.cloud.google.com](https://console.cloud.google.com/), create a
project (or pick an existing one), and enable billing on it under
**Billing**.

### 2. Enable these APIs

In **APIs & Services → Library**, enable:

- **Geocoding API** — turns addresses into lat/lng.
- **Distance Matrix API** — real drive time + distance between every pair of
  stops (this is what makes the route time-window-aware instead of a
  straight-line guess).
- **Maps JavaScript API** — only needed if you want the visual map preview
  (optional; the core add-stops/build-route/navigate loop works without it).

### 3. Create two API keys with separate restrictions

Create these under **APIs & Services → Credentials → Create credentials → API key**.
Keeping them separate limits the blast radius if either one leaks.

**Server key** (`GOOGLE_MAPS_SERVER_KEY`) — used only inside this app's API
routes, never sent to the browser:
- API restrictions: Geocoding API, Distance Matrix API.
- Application restrictions: **IP addresses**, restricted to your server's/
  hosting provider's IP(s) if you know them ahead of time (e.g. a static
  Vercel IP range or your own server). If you can't pin an IP yet, leave this
  open initially and lock it down once deployed — never leave a key
  completely unrestricted long-term.

**Browser key** (`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, optional) — used
client-side to render the map preview:
- API restrictions: Maps JavaScript API only.
- Application restrictions: **HTTP referrers**, restricted to your domain(s)
  (e.g. `https://yourapp.vercel.app/*`, `http://localhost:3000/*` for local
  dev).

### 4. Set environment variables

```bash
cp .env.example .env.local
```

Fill in:

```
GOOGLE_MAPS_SERVER_KEY=your-server-key
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=your-browser-key   # optional, map view only
```

`.env.local` is gitignored — never commit real keys.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. It's built mobile-first — use your browser's
device toolbar (or just open it on your phone) to see it as intended.

## How it works

1. **Add a stop**: address, optional item/contact label, earliest/latest
   time, and how long you expect to be there (default 10 min). The address is
   geocoded immediately via `/api/geocode` and cached on the stop, so
   rebuilding the route later doesn't re-geocode anything.
2. **Build Route**: `/api/build-route` fetches a real drive-time/distance
   matrix between your start location and every stop (Distance Matrix API,
   traffic-aware), then runs the ordering algorithm in `src/lib/routing.ts`.
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
(single-user, no backend database needed). The two API routes exist purely
to keep the Google Maps server key off the client.

## Testing

```bash
npm test
```

Unit tests cover the routing algorithm's simulation and ordering logic
directly against synthetic distance matrices — no network calls, no API key
needed.

## Deploying

Any Next.js host works (Vercel, etc.). Set `GOOGLE_MAPS_SERVER_KEY` (and
optionally `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`) as environment variables on
the hosting platform, then update your key restrictions (IP for the server
key, HTTP referrer for the browser key) to match the deployed domain.
