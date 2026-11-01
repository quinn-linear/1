"use client";

import { useEffect, useRef } from "react";

/**
 * The one screen between sign-in and the story. Going full screen needs a
 * real click on this page (the sign-in redirect can't carry that permission
 * over), so the primary button asks for it. The other choice, Esc and a browser
 * that can't do full screen all just continue in the window; nothing is lost.
 * The recap already fills the viewport either way.
 */
export function EnterRecap({ year, canFullscreen, onEnter }: { year: number; canFullscreen: boolean; onEnter: (fullscreen: boolean) => void }) {
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEnter(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnter]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="enter-recap-title" className="absolute inset-0 z-40 flex items-center justify-center bg-[#0a0912] px-4 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <p className="text-base uppercase tracking-[0.18em] text-ph/70">
          <span aria-hidden className="accent-text">
            &gt;{" "}
          </span>
          Linear Wrapped {year}
        </p>
        <h2 id="enter-recap-title" className="text-[min(10vw,7dvh)] font-semibold uppercase leading-none accent-text sm:text-5xl">
          Your recap is ready
        </h2>
        <div className="flex flex-col items-center gap-1">
          <button ref={primary} type="button" onClick={() => onEnter(canFullscreen)} className="enter-btn">
            {canFullscreen ? "Enter recap in full screen" : "Enter recap"}
          </button>
          {canFullscreen && (
            <button type="button" onClick={() => onEnter(false)} className="enter-link">
              Continue in this window
            </button>
          )}
        </div>
        {canFullscreen && <p className="text-sm text-ph/60">Press Esc any time to leave full screen.</p>}
      </div>
    </div>
  );
}
