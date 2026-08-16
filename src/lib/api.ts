"use client";

import type { RouteResult, Stop } from "./types";

export interface GeocodeResponse {
  lat: number;
  lng: number;
  formattedAddress: string;
}

async function parseJsonOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }
  return data;
}

export async function geocode(address: string): Promise<GeocodeResponse> {
  const res = await fetch("/api/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  return parseJsonOrThrow(res);
}

export interface BuildRouteRequest {
  startAddress: string;
  startLat: number | null;
  startLng: number | null;
  startTime: number;
  stops: Stop[];
}

export async function buildRoute(payload: BuildRouteRequest): Promise<RouteResult> {
  const res = await fetch("/api/build-route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}
