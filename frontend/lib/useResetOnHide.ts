"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Run `reset` when the component is hidden by Next's <Activity> route
 * preservation (cacheComponents) or unmounted. Hidden routes keep their React
 * and DOM state, so transient state like `pending` flags or typed passwords
 * would otherwise still be there when the user comes back to the page.
 */
export function useResetOnHide(reset: () => void) {
  const resetRef = useRef(reset);
  useLayoutEffect(() => {
    resetRef.current = reset;
  });
  useLayoutEffect(() => () => resetRef.current(), []);
}
