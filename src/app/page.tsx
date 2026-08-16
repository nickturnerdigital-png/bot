"use client";

import { RouteActions } from "@/components/RouteActions";
import { RouteMap } from "@/components/RouteMap";
import { StartLocationInput } from "@/components/StartLocationInput";
import { StopForm } from "@/components/StopForm";
import { StopList } from "@/components/StopList";
import { useMounted } from "@/lib/useMounted";

export default function Home() {
  const mounted = useMounted();

  return (
    <main className="mx-auto max-w-lg px-4 pb-10 pt-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Pickup Route Planner</h1>
        <p className="text-sm text-gray-500">Marketplace sourcing runs, time-window aware.</p>
      </header>

      {!mounted ? (
        <p className="text-center text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-5">
          <StartLocationInput />
          <StopForm />
          <RouteActions />
          <RouteMap />
          <StopList />
        </div>
      )}
    </main>
  );
}
