"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MIN_SCALE, chooseScale, type Fit as FitResult } from "@/lib/retro/fit";

/** Widest the card content gets before it is scaled; wider screens centre it instead of stretching charts. */
const MAX_WIDTH = 704;
/** Multi-column flow (short, wide screens): the widest layout for 2 and 3 columns, and the narrowest screen worth trying it on. */
const MAX_WIDTH_BY_COLS = { 1: MAX_WIDTH, 2: 1200, 3: 1500 } as const;
const MIN_WIDTH_COLUMNS = 560;
/** Below this scale the current layout is judged too small and the next column count is tried. */
const TRY_MORE_BELOW = 0.8;

type Cols = 1 | 2 | 3;

/**
 * Lays a card's content out so all of it is visible in the space it's given.
 * It tries the designed size first and, if the content is taller than the
 * space, steps the scale down (`lib/retro/fit.ts`), widening the layout box as
 * it shrinks so text reflows into fewer lines. Nothing is clipped. Only when
 * even the smallest legible scale doesn't fit (extreme zoom, tiny windows) does
 * the card scroll; that is the one documented accessibility fallback.
 */
export function Fit({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<FitResult & { width: number; height: number; cols: Cols }>({ scale: 1, overflow: false, width: MAX_WIDTH, height: 0, cols: 1 });

  const measure = useCallback(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const available = o.clientHeight;
    const run = (cols: Cols) => {
      const max = MAX_WIDTH_BY_COLS[cols];
      const width = (s: number) => Math.min(o.clientWidth / s, max);
      i.dataset.cols = String(cols);
      const res = chooseScale(available, (s) => {
        i.style.width = `${width(s)}px`;
        return i.offsetHeight;
      });
      return { res, cols, w: width(res.scale) };
    };
    // One column first; a short, wide screen (landscape phone) gets more columns when that makes the type bigger.
    let best = run(1);
    for (const cols of [2, 3] as const) {
      if (best.res.scale >= TRY_MORE_BELOW || o.clientWidth < MIN_WIDTH_COLUMNS) break;
      const more = run(cols);
      if (more.res.scale > best.res.scale) best = more;
    }
    // The last trial may have left the DOM in another layout; settle on the winner below.
    i.style.width = `${best.w}px`;
    i.dataset.cols = String(best.cols);
    const next = { ...best.res, width: best.w, height: i.offsetHeight, cols: best.cols };
    setFit((prev) => (prev.scale === next.scale && prev.overflow === next.overflow && prev.width === next.width && prev.height === next.height && prev.cols === next.cols ? prev : next));
  }, []);

  useLayoutEffect(() => {
    measure();
    const o = outer.current;
    const ro = o && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (o) ro?.observe(o);
    // Webfont metrics and expandable sections change the content's height after first paint.
    void document.fonts?.ready.then(measure);
    const i = inner.current;
    i?.addEventListener("toggle", measure, true);
    return () => {
      ro?.disconnect();
      i?.removeEventListener("toggle", measure, true);
    };
  }, [measure]);

  const { scale, overflow, width, height } = fit;
  return (
    <div ref={outer} data-fit-scale={scale} data-fit-overflow={overflow || undefined} className={`absolute inset-0 ${overflow ? "overflow-y-auto" : "overflow-hidden"}`}>
      <div className="relative w-full" style={{ height: overflow ? height * scale : "100%" }}>
        <div
          ref={inner}
          className="absolute left-1/2 px-2 py-3"
          style={{
            width,
            top: overflow ? 0 : "50%",
            transform: `translate(-50%, ${overflow ? "0" : "-50%"}) scale(${scale})`,
            transformOrigin: overflow ? "top center" : "center",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export { MIN_SCALE };
