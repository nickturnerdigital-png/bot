"use client";

import { useState, type FormEvent } from "react";
import { geocode } from "@/lib/api";
import { usePlannerStore } from "@/lib/store";
import { nowMinutes, parseTimeToMinutes } from "@/lib/time";

function minutesToTimeInputValue(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function defaultTimes() {
  const roundedNow = Math.ceil(nowMinutes() / 5) * 5;
  return {
    earliest: minutesToTimeInputValue(roundedNow),
    latest: minutesToTimeInputValue(roundedNow + 30),
  };
}

const DURATION_OPTIONS = [5, 10, 15, 20, 30];

export function StopForm() {
  const addStop = usePlannerStore((s) => s.addStop);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [times, setTimes] = useState(defaultTimes);
  const [duration, setDuration] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const geo = await geocode(address.trim());
      addStop({
        address: geo.formattedAddress,
        label: label.trim() || undefined,
        earliestTime: parseTimeToMinutes(times.earliest),
        latestTime: parseTimeToMinutes(times.latest),
        durationMinutes: duration,
        lat: geo.lat,
        lng: geo.lng,
      });
      setAddress("");
      setLabel("");
      setTimes(defaultTimes());
      setDuration(10);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find that address");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <div>
        <label className="block text-sm font-medium text-gray-700">Address</label>
        <input
          type="text"
          inputMode="text"
          autoComplete="street-address"
          required
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Main St, Springfield"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Item / contact (optional)</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Couch — Mike"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Earliest</label>
          <input
            type="time"
            required
            value={times.earliest}
            onChange={(e) => setTimes((t) => ({ ...t, earliest: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Latest</label>
          <input
            type="time"
            required
            value={times.latest}
            onChange={(e) => setTimes((t) => ({ ...t, latest: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Duration at stop</label>
        <div className="mt-1 flex gap-2">
          {DURATION_OPTIONS.map((mins) => (
            <button
              type="button"
              key={mins}
              onClick={() => setDuration(mins)}
              className={`flex-1 rounded-lg border px-2 py-2 text-sm font-medium ${
                duration === mins
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 bg-white text-gray-700"
              }`}
            >
              {mins}m
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-risk-missed">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-gray-900 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Adding…" : "+ Add stop"}
      </button>
    </form>
  );
}
