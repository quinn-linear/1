"use client";

import { useSyncExternalStore } from "react";

/** Wide enough to lay the final card's print-out and numbers side by side. */
export const WIDE_QUERY = "(min-width: 900px)";

const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Server and first client render say "narrow", so hydration matches; it updates right after mount. */
export const useWide = () => useSyncExternalStore(subscribe, () => window.matchMedia(WIDE_QUERY).matches, () => false);
