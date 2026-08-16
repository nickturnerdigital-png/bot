"use client";

import { buildRoute } from "@/lib/api";
import { usePlannerStore } from "@/lib/store";

export function RouteActions() {
  const stops = usePlannerStore((s) => s.stops);
  const route = usePlannerStore((s) => s.route);
  const startAddress = usePlannerStore((s) => s.startAddress);
  const startLat = usePlannerStore((s) => s.startLat);
  const startLng = usePlannerStore((s) => s.startLng);
  const useCurrentLocation = usePlannerStore((s) => s.useCurrentLocation);
  const startTime = usePlannerStore((s) => s.startTime);
  const isBuilding = usePlannerStore((s) => s.isBuilding);
  const buildError = usePlannerStore((s) => s.buildError);
  const setBuilding = usePlannerStore((s) => s.setBuilding);
  const setBuildError = usePlannerStore((s) => s.setBuildError);
  const setRoute = usePlannerStore((s) => s.setRoute);

  const activeStops = stops.filter((s) => s.status !== "done");
  const hasStart = useCurrentLocation ? startLat != null && startLng != null : startAddress.trim().length > 0;
  const canBuild = activeStops.length > 0 && hasStart && !isBuilding;

  async function handleBuild() {
    setBuilding(true);
    setBuildError(null);
    try {
      const result = await buildRoute({
        startAddress: useCurrentLocation ? "Current location" : startAddress.trim(),
        startLat: useCurrentLocation ? startLat : null,
        startLng: useCurrentLocation ? startLng : null,
        startTime,
        stops: activeStops,
      });
      setRoute(result);
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : "Failed to build route");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleBuild}
        disabled={!canBuild}
        className="w-full rounded-xl bg-blue-600 px-4 py-4 text-base font-bold text-white shadow-md disabled:bg-gray-300"
      >
        {isBuilding ? "Building route…" : route ? "Rebuild route" : "Build Route"}
      </button>

      {!hasStart && (
        <p className="text-center text-xs text-gray-500">Set a start address or GPS location above.</p>
      )}
      {buildError && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-risk-missed">{buildError}</p>
      )}

      {route && (
        <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-gray-900">
              {Math.round(route.totalDriveMinutes)}m drive · {route.totalDriveMiles.toFixed(1)} mi
            </span>
            <span className="text-gray-500">
              Built {new Date(route.builtAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>

          {route.missedCount > 0 && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-risk-missed">
              {route.missedCount} stop{route.missedCount > 1 ? "s" : ""} will be missed at this pace.
            </p>
          )}
          {route.atRiskCount > 0 && (
            <p className="rounded-lg bg-amber-50 p-2 text-sm text-risk-tight">
              {route.atRiskCount} stop{route.atRiskCount > 1 ? "s are" : " is"} tight (under 10m buffer).
            </p>
          )}
          {route.unresolvedStopIds.length > 0 && (
            <p className="rounded-lg bg-gray-100 p-2 text-sm text-gray-600">
              {route.unresolvedStopIds.length} stop(s) couldn&apos;t be located and were left out of the
              route — check the address.
            </p>
          )}

          <div className="space-y-2">
            {route.mapsUrls.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-xl bg-green-600 px-4 py-3 text-center text-base font-semibold text-white"
              >
                {route.mapsUrls.length > 1 ? `Open leg ${i + 1} in Google Maps` : "Open in Google Maps"}
              </a>
            ))}
            {route.appleMapsUrl && (
              <a
                href={route.appleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700"
              >
                Open first→last leg in Apple Maps
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
