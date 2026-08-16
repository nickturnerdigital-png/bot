"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMapsScript } from "@/lib/loadGoogleMaps";
import { usePlannerStore } from "@/lib/store";
import type { Stop } from "@/lib/types";

const BROWSER_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
// Directions API (JS client) allows up to 25 total points (origin + up to 23 waypoints + destination).
const MAX_JS_WAYPOINTS = 23;

const STATUS_COLOR: Record<Stop["status"], string> = {
  pending: "#6b7280",
  confirmed_in_route: "#16a34a",
  at_risk: "#d97706",
  missed: "#dc2626",
  done: "#6b7280",
};

export function RouteMap() {
  const route = usePlannerStore((s) => s.route);
  const stops = usePlannerStore((s) => s.stops);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!BROWSER_KEY) return;
    loadGoogleMapsScript(BROWSER_KEY)
      .then(() => setReady(true))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load map"));
  }, []);

  useEffect(() => {
    if (!ready || !route || !mapDivRef.current) return;
    if (route.startLat == null || route.startLng == null) return;

    const startPosition = { lat: route.startLat, lng: route.startLng };
    const map = new google.maps.Map(mapDivRef.current, {
      center: startPosition,
      zoom: 11,
      disableDefaultUI: true,
      zoomControl: true,
    });

    const stopById = new Map(stops.map((s) => [s.id, s]));
    const orderedStops = route.orderedStopIds
      .map((id) => stopById.get(id))
      .filter((s): s is Stop => !!s && s.lat != null && s.lng != null);

    new google.maps.Marker({
      position: startPosition,
      map,
      label: "S",
      title: "Start",
    });

    orderedStops.forEach((stop, i) => {
      new google.maps.Marker({
        position: { lat: stop.lat as number, lng: stop.lng as number },
        map,
        label: { text: String(i + 1), color: "#fff" },
        title: stop.label || stop.address,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: STATUS_COLOR[stop.status],
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: "#fff",
          scale: 14,
        },
      });
    });

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(startPosition);
    orderedStops.forEach((s) => bounds.extend({ lat: s.lat as number, lng: s.lng as number }));

    if (orderedStops.length > 0 && orderedStops.length <= MAX_JS_WAYPOINTS) {
      const directionsService = new google.maps.DirectionsService();
      const directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true, map });
      const last = orderedStops[orderedStops.length - 1]!;
      const waypoints = orderedStops.slice(0, -1).map((s) => ({
        location: { lat: s.lat as number, lng: s.lng as number },
        stopover: true,
      }));

      directionsService.route(
        {
          origin: startPosition,
          destination: { lat: last.lat as number, lng: last.lng as number },
          waypoints,
          optimizeWaypoints: false,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRenderer.setDirections(result);
          } else {
            map.fitBounds(bounds);
          }
        }
      );
    } else {
      map.fitBounds(bounds);
    }
  }, [ready, route, stops]);

  if (!BROWSER_KEY || !route) return null;

  if (error) {
    return <p className="rounded-2xl bg-white p-4 text-sm text-risk-missed shadow-sm">{error}</p>;
  }

  return <div ref={mapDivRef} className="h-72 w-full overflow-hidden rounded-2xl shadow-sm" />;
}
