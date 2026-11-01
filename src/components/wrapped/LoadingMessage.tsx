"use client";

import { useEffect, useState } from "react";
import { LOADING_MESSAGES, nextLoadingIndex } from "@/lib/sparse";

/**
 * Cycles playful lines while stats load. Purely decorative (`aria-hidden`; the
 * parent announces a single status), and it holds still for reduced motion.
 */
export function LoadingMessage() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setIndex((i) => nextLoadingIndex(i)), 2200);
    return () => clearInterval(timer);
  }, []);

  return (
    <p key={index} aria-hidden className="animate-rise min-h-8 text-lg font-semibold text-white/90 sm:text-2xl">
      {LOADING_MESSAGES[index]}…
    </p>
  );
}
