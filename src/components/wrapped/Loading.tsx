"use client";

import { useEffect, useState } from "react";
import { LinearLogo } from "@/components/retro/LinearLogo";
import { LOADING_COPY, LOADING_DELAY_MS } from "@/lib/loading";

/**
 * Suspense fallback for `/wrapped` while stats are computed. It is part of the
 * streamed HTML, so it is on screen from the first byte, but for the first
 * `LOADING_DELAY_MS` it is just the empty dark desk (same full-height box, so
 * nothing shifts when it fills in). Fast loads replace it with the recap and the
 * timer is cleared on unmount; slow loads get the Linear mark and one line of
 * copy. The server render and first client render are both the empty state, so
 * hydration can't flicker. The mark's sweep plays once and is static under
 * reduced motion; the status region is always mounted so its text is announced
 * when it appears.
 */
export function WrappedLoading() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="desk flex min-h-dvh items-center justify-center px-2 py-4 sm:px-6">
      <div role="status" className={show ? "crt relative flex flex-col items-center gap-6 overflow-hidden rounded-[2.5%/3.5%] border-4 border-[#0d0c08] px-10 py-12 text-ph phosphor sm:px-16" : "sr-only"}>
        {show && (
          <>
            <LinearLogo clipId="loading-logo-clip" className="text-[min(4vw,1.5rem)]" />
            <p className="text-lg lowercase sm:text-2xl">{LOADING_COPY}</p>
          </>
        )}
      </div>
    </main>
  );
}
