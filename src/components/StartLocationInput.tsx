"use client";

import { useState } from "react";
import { usePlannerStore } from "@/lib/store";
import { formatMinutes, parseTimeToMinutes } from "@/lib/time";

function minutesToTimeInputValue(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function StartLocationInput() {
  const startAddress = usePlannerStore((s) => s.startAddress);
  const startLat = usePlannerStore((s) => s.startLat);
  const startLng = usePlannerStore((s) => s.startLng);
  const useCurrentLocation = usePlannerStore((s) => s.useCurrentLocation);
  const startTime = usePlannerStore((s) => s.startTime);
  const setStartAddress = usePlannerStore((s) => s.setStartAddress);
  const setStartCoords = usePlannerStore((s) => s.setStartCoords);
  const setUseCurrentLocation = usePlannerStore((s) => s.setUseCurrentLocation);
  const setStartTime = usePlannerStore((s) => s.setStartTime);

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function handleUseCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation isn't available on this device/browser.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStartCoords(pos.coords.latitude, pos.coords.longitude);
        setUseCurrentLocation(true);
        setLocating(false);
      },
      (err) => {
        setLocationError(err.message || "Couldn't get your location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <div>
        <label className="block text-sm font-medium text-gray-700">Start from</label>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={useCurrentLocation ? "Current location" : startAddress}
            onChange={(e) => setStartAddress(e.target.value)}
            disabled={useCurrentLocation}
            placeholder="Starting address"
            className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base disabled:bg-gray-100"
          />
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="shrink-0 rounded-lg border border-gray-300 px-3 py-3 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            {locating ? "…" : "📍 Use GPS"}
          </button>
        </div>
        {useCurrentLocation && startLat != null && startLng != null && (
          <button
            type="button"
            onClick={() => setUseCurrentLocation(false)}
            className="mt-1 text-xs text-gray-500 underline"
          >
            Use a typed address instead
          </button>
        )}
        {locationError && <p className="mt-1 text-sm text-risk-missed">{locationError}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Departure time — {formatMinutes(startTime)}
        </label>
        <input
          type="time"
          value={minutesToTimeInputValue(startTime)}
          onChange={(e) => setStartTime(parseTimeToMinutes(e.target.value))}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
        />
      </div>
    </div>
  );
}
