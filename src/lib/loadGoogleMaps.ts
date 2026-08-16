"use client";

let loadPromise: Promise<void> | null = null;

/** Dynamically loads the Maps JavaScript API script once, reusing the same promise on re-renders. */
export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps JavaScript API"));
    document.head.appendChild(script);
  });

  return loadPromise;
}
