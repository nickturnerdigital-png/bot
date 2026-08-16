"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";
import { usePlannerStore } from "@/lib/store";
import type { Stop } from "@/lib/types";

const STATUS_COLOR: Record<Stop["status"], string> = {
  pending: "#6b7280",
  confirmed_in_route: "#16a34a",
  at_risk: "#d97706",
  missed: "#dc2626",
  done: "#6b7280",
};

/** Tooltip content built as a DOM node (not an HTML string) so user-entered labels/addresses can't inject markup. */
function textTooltip(text: string): HTMLSpanElement {
  const el = document.createElement("span");
  el.textContent = text;
  return el;
}

export function RouteMap() {
  const route = usePlannerStore((s) => s.route);
  const stops = usePlannerStore((s) => s.stops);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!route || !containerRef.current) return;
    if (route.startLat == null || route.startLng == null) return;

    const startLat = route.startLat;
    const startLng = route.startLng;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      mapRef.current?.remove();
      const map = L.map(containerRef.current).setView([startLat, startLng], 11);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const bounds = L.latLngBounds([[startLat, startLng]]);

      function numberedIcon(label: string, color: string) {
        return L.divIcon({
          className: "",
          html: `<div style="background:${color};color:#fff;border:2px solid #fff;border-radius:9999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.4)">${label}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
      }

      L.marker([startLat, startLng], { icon: numberedIcon("S", "#111827") })
        .addTo(map)
        .bindTooltip(textTooltip("Start"));

      const stopById = new Map(stops.map((s) => [s.id, s]));
      route.orderedStopIds.forEach((id, i) => {
        const stop = stopById.get(id);
        if (!stop || stop.lat == null || stop.lng == null) return;
        L.marker([stop.lat, stop.lng], { icon: numberedIcon(String(i + 1), STATUS_COLOR[stop.status]) })
          .addTo(map)
          .bindTooltip(textTooltip(stop.label || stop.address));
        bounds.extend([stop.lat, stop.lng]);
      });

      if (route.routeGeometry.length > 1) {
        L.polyline(route.routeGeometry, { color: "#2563eb", weight: 4, opacity: 0.8 }).addTo(map);
        route.routeGeometry.forEach((p) => bounds.extend(p));
      }

      map.fitBounds(bounds, { padding: [24, 24] });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [route, stops]);

  if (!route) return null;

  return <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-2xl shadow-sm" />;
}
