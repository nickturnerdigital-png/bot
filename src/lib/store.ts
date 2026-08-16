"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nowMinutes } from "./time";
import type { NewStopInput, RouteResult, Stop } from "./types";
import { windowStatusToStopStatus } from "./routing";

interface PlannerState {
  stops: Stop[];
  route: RouteResult | null;

  startAddress: string;
  startLat: number | null;
  startLng: number | null;
  useCurrentLocation: boolean;
  startTime: number; // minutes since midnight

  isBuilding: boolean;
  buildError: string | null;

  addStop: (input: NewStopInput) => void;
  updateStop: (id: string, patch: Partial<Stop>) => void;
  removeStop: (id: string) => void;
  markDone: (id: string) => void;
  setGeocodedStop: (id: string, lat: number, lng: number, formattedAddress?: string) => void;

  setStartAddress: (address: string) => void;
  setStartCoords: (lat: number | null, lng: number | null) => void;
  setUseCurrentLocation: (use: boolean) => void;
  setStartTime: (minutes: number) => void;

  setBuilding: (v: boolean) => void;
  setBuildError: (err: string | null) => void;
  setRoute: (route: RouteResult) => void;
}

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
      stops: [],
      route: null,

      startAddress: "",
      startLat: null,
      startLng: null,
      useCurrentLocation: false,
      startTime: nowMinutes(),

      isBuilding: false,
      buildError: null,

      addStop: (input) => {
        const stop: Stop = {
          id: crypto.randomUUID(),
          address: input.address,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          label: input.label,
          earliestTime: input.earliestTime,
          latestTime: input.latestTime,
          durationMinutes: input.durationMinutes,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        set({ stops: [...get().stops, stop] });
      },

      updateStop: (id, patch) => {
        set({
          stops: get().stops.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        });
      },

      removeStop: (id) => {
        set({ stops: get().stops.filter((s) => s.id !== id) });
      },

      markDone: (id) => {
        set({
          stops: get().stops.map((s) => (s.id === id ? { ...s, status: "done" } : s)),
        });
      },

      setGeocodedStop: (id, lat, lng, formattedAddress) => {
        set({
          stops: get().stops.map((s) =>
            s.id === id ? { ...s, lat, lng, address: formattedAddress ?? s.address } : s
          ),
        });
      },

      setStartAddress: (address) => set({ startAddress: address, useCurrentLocation: false }),
      setStartCoords: (lat, lng) => set({ startLat: lat, startLng: lng }),
      setUseCurrentLocation: (use) => set({ useCurrentLocation: use }),
      setStartTime: (minutes) => set({ startTime: minutes }),

      setBuilding: (v) => set({ isBuilding: v }),
      setBuildError: (err) => set({ buildError: err }),

      setRoute: (route) => {
        const statusByStopId = new Map(
          route.stopResults.map((r) => [r.stopId, windowStatusToStopStatus(r.windowStatus)])
        );
        set({
          route,
          stops: get().stops.map((s) => {
            if (s.status === "done") return s;
            const newStatus = statusByStopId.get(s.id);
            return newStatus ? { ...s, status: newStatus } : s;
          }),
        });
      },
    }),
    {
      name: "pickup-route-planner",
      partialize: (state) => ({
        stops: state.stops,
        route: state.route,
        startAddress: state.startAddress,
        startLat: state.startLat,
        startLng: state.startLng,
        useCurrentLocation: state.useCurrentLocation,
        startTime: state.startTime,
      }),
    }
  )
);
