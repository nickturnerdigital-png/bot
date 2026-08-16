"use client";

import { usePlannerStore } from "@/lib/store";
import { StopCard } from "./StopCard";

export function StopList() {
  const stops = usePlannerStore((s) => s.stops);
  const route = usePlannerStore((s) => s.route);

  const activeStops = stops.filter((s) => s.status !== "done");
  const doneStops = stops.filter((s) => s.status === "done");

  if (stops.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
        No stops yet. Add your first pickup above.
      </p>
    );
  }

  const routeResultByStopId = new Map((route?.stopResults ?? []).map((r) => [r.stopId, r]));
  const orderIndexByStopId = new Map((route?.orderedStopIds ?? []).map((id, i) => [id, i]));

  const ordered = route
    ? [...activeStops].sort((a, b) => {
        const ai = orderIndexByStopId.get(a.id);
        const bi = orderIndexByStopId.get(b.id);
        if (ai == null && bi == null) return a.earliestTime - b.earliestTime;
        if (ai == null) return 1;
        if (bi == null) return -1;
        return ai - bi;
      })
    : [...activeStops].sort((a, b) => a.earliestTime - b.earliestTime);

  return (
    <div className="space-y-3">
      {ordered.map((stop) => (
        <StopCard
          key={stop.id}
          stop={stop}
          routeInfo={routeResultByStopId.get(stop.id)}
          orderIndex={orderIndexByStopId.get(stop.id)}
        />
      ))}
      {doneStops.length > 0 && (
        <details className="rounded-2xl bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium text-gray-500">
            {doneStops.length} completed
          </summary>
          <div className="mt-3 space-y-3">
            {doneStops.map((stop) => (
              <StopCard key={stop.id} stop={stop} routeInfo={routeResultByStopId.get(stop.id)} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
