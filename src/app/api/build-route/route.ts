import { NextRequest, NextResponse } from "next/server";
import { buildAppleMapsUrl, buildGoogleMapsUrls } from "@/lib/mapsUrl";
import { geocodeAddress } from "@/lib/nominatim";
import { fetchDistanceMatrix, fetchRouteGeometry } from "@/lib/osrm";
import { buildOptimalOrder } from "@/lib/routing";
import { todayDateString } from "@/lib/time";
import type { RouteResult, RouteStopResult, Stop } from "@/lib/types";

interface BuildRouteRequestBody {
  startAddress?: string;
  startLat?: number | null;
  startLng?: number | null;
  startTime: number; // minutes since midnight
  stops: Stop[];
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as BuildRouteRequestBody | null;

  if (!body || !Array.isArray(body.stops)) {
    return NextResponse.json({ error: "stops must be an array" }, { status: 400 });
  }
  if (typeof body.startTime !== "number") {
    return NextResponse.json({ error: "startTime (minutes since midnight) is required" }, { status: 400 });
  }

  try {
    let startLat = body.startLat ?? null;
    let startLng = body.startLng ?? null;
    let startAddress = body.startAddress?.trim() ?? "";

    if ((startLat == null || startLng == null) && startAddress) {
      const geocoded = await geocodeAddress(startAddress);
      startLat = geocoded.lat;
      startLng = geocoded.lng;
      startAddress = geocoded.formattedAddress;
    }

    if (startLat == null || startLng == null) {
      return NextResponse.json(
        { error: "A start location (address, or current location coordinates) is required." },
        { status: 400 }
      );
    }

    // Stops are normally geocoded client-side when added; this is a fallback
    // for any that slipped through without coordinates.
    const resolvedStops: Stop[] = [];
    const unresolvedStopIds: string[] = [];
    for (const stop of body.stops) {
      if (stop.lat != null && stop.lng != null) {
        resolvedStops.push(stop);
        continue;
      }
      try {
        const geocoded = await geocodeAddress(stop.address);
        resolvedStops.push({ ...stop, lat: geocoded.lat, lng: geocoded.lng });
      } catch {
        unresolvedStopIds.push(stop.id);
      }
    }

    const builtAt = new Date().toISOString();

    if (resolvedStops.length === 0) {
      const emptyResult: RouteResult = {
        id: crypto.randomUUID(),
        date: todayDateString(),
        startAddress,
        startLat,
        startLng,
        startTime: body.startTime,
        orderedStopIds: [],
        stopResults: [],
        unresolvedStopIds,
        totalDriveMinutes: 0,
        totalDriveMiles: 0,
        missedCount: 0,
        atRiskCount: 0,
        builtAt,
        mapsUrls: [],
        appleMapsUrl: "",
        routeGeometry: [],
      };
      return NextResponse.json(emptyResult);
    }

    const points = [
      { lat: startLat, lng: startLng },
      ...resolvedStops.map((s) => ({ lat: s.lat as number, lng: s.lng as number })),
    ];

    const matrix = await fetchDistanceMatrix(points);
    const { order, simulation } = buildOptimalOrder(resolvedStops, matrix, body.startTime);

    const stopResults: RouteStopResult[] = simulation.stops.map((s, i) => ({
      stopId: resolvedStops[s.index]!.id,
      order: i,
      arrivalTime: s.arrivalTime,
      departureTime: s.departureTime,
      driveMinutesFromPrev: s.driveMinutesFromPrev,
      driveMilesFromPrev: s.driveMilesFromPrev,
      slackMinutes: s.slackMinutes,
      windowStatus: s.windowStatus,
    }));

    const orderedStopIds = order.map((idx) => resolvedStops[idx]!.id);
    const routePoints = [
      points[0]!,
      ...order.map((idx) => ({
        lat: resolvedStops[idx]!.lat as number,
        lng: resolvedStops[idx]!.lng as number,
      })),
    ];

    const routeGeometry = await fetchRouteGeometry(routePoints).catch(() => []);

    const result: RouteResult = {
      id: crypto.randomUUID(),
      date: todayDateString(),
      startAddress,
      startLat,
      startLng,
      startTime: body.startTime,
      orderedStopIds,
      stopResults,
      unresolvedStopIds,
      totalDriveMinutes: simulation.totalDriveMinutes,
      totalDriveMiles: simulation.totalDriveMiles,
      missedCount: simulation.missedCount,
      atRiskCount: stopResults.filter((s) => s.windowStatus === "tight").length,
      builtAt,
      mapsUrls: buildGoogleMapsUrls(routePoints),
      appleMapsUrl: buildAppleMapsUrl(routePoints),
      routeGeometry,
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build route" },
      { status: 502 }
    );
  }
}
