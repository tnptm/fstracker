"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** True after hydration. Server/prerender renders the fallback. */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * Renders children only in the browser. Views that depend on "now" (today's
 * date, running timers) or the user's locale/time zone go inside, which
 * avoids prerender errors and hydration mismatches.
 */
export default function ClientOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return useHydrated() ? children : fallback;
}
