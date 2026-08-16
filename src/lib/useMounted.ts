"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True only after client hydration — avoids SSR/localStorage hydration mismatches. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
