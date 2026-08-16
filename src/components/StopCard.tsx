"use client";

import { useState } from "react";
import { usePlannerStore } from "@/lib/store";
import { formatMinutes, parseTimeToMinutes } from "@/lib/time";
import type { RouteStopResult, Stop } from "@/lib/types";

function minutesToTimeInputValue(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

const STATUS_META: Record<Stop["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-gray-100 text-gray-600" },
  confirmed_in_route: { label: "On time", className: "bg-green-100 text-risk-ok" },
  at_risk: { label: "Tight", className: "bg-amber-100 text-risk-tight" },
  missed: { label: "Will miss", className: "bg-red-100 text-risk-missed" },
  done: { label: "Done", className: "bg-gray-200 text-gray-500" },
};

export function StopCard({
  stop,
  routeInfo,
  orderIndex,
}: {
  stop: Stop;
  routeInfo?: RouteStopResult;
  orderIndex?: number;
}) {
  const updateStop = usePlannerStore((s) => s.updateStop);
  const removeStop = usePlannerStore((s) => s.removeStop);
  const markDone = usePlannerStore((s) => s.markDone);
  const [editing, setEditing] = useState(false);

  const meta = STATUS_META[stop.status];

  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ${stop.status === "done" ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {orderIndex != null && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                {orderIndex + 1}
              </span>
            )}
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
              {meta.label}
            </span>
          </div>
          {stop.label && <p className="mt-1 truncate font-semibold text-gray-900">{stop.label}</p>}
          <p className="truncate text-sm text-gray-600">{stop.address}</p>
          <p className="mt-1 text-xs text-gray-500">
            Window {formatMinutes(stop.earliestTime)}–{formatMinutes(stop.latestTime)} ·{" "}
            {stop.durationMinutes}m stop
          </p>

          {routeInfo && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="font-medium text-gray-900">
                Arrive {formatMinutes(routeInfo.arrivalTime)}
              </span>
              <span className="text-gray-500">
                {Math.round(routeInfo.driveMinutesFromPrev)}m drive
                {orderIndex === 0 ? " from start" : " from prev stop"}
              </span>
              <span
                className={
                  routeInfo.slackMinutes < 0
                    ? "text-risk-missed"
                    : routeInfo.slackMinutes <= 10
                      ? "text-risk-tight"
                      : "text-gray-500"
                }
              >
                {routeInfo.slackMinutes < 0
                  ? `${Math.abs(Math.round(routeInfo.slackMinutes))}m late`
                  : `${Math.round(routeInfo.slackMinutes)}m buffer`}
              </span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs font-medium text-gray-500 underline"
          >
            {editing ? "Close" : "Edit"}
          </button>
          {stop.status !== "done" && (
            <button
              type="button"
              onClick={() => markDone(stop.id)}
              className="text-xs font-medium text-gray-500 underline"
            >
              Done
            </button>
          )}
          <button
            type="button"
            onClick={() => removeStop(stop.id)}
            className="text-xs font-medium text-risk-missed underline"
          >
            Remove
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
          <div>
            <label className="block text-xs font-medium text-gray-500">Earliest</label>
            <input
              type="time"
              value={minutesToTimeInputValue(stop.earliestTime)}
              onChange={(e) => updateStop(stop.id, { earliestTime: parseTimeToMinutes(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Latest</label>
            <input
              type="time"
              value={minutesToTimeInputValue(stop.latestTime)}
              onChange={(e) => updateStop(stop.id, { latestTime: parseTimeToMinutes(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500">Duration (minutes)</label>
            <input
              type="number"
              min={1}
              value={stop.durationMinutes}
              onChange={(e) => updateStop(stop.id, { durationMinutes: Number(e.target.value) || 1 })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
