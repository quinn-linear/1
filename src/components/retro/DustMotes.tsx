"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import { BEAM_POLYGON } from "@/lib/retro/art";
import { makeMotes, moteAt, staticFrame, type Frame } from "@/lib/retro/dust";

/**
 * A few dust motes in the lamp's beam. One small canvas laid exactly over the beam's box
 * on the picture (`.pet-beam-zone` in globals.css, from the same fractions as the
 * terminal), so it follows the image's crop and size. It never takes pointer events or
 * a place in the accessibility tree, sits under the cassette and the screen, and does no
 * work while it is off screen (including when the crop hides the lamp, as on phones) or
 * the tab is hidden. Under reduced motion it draws one still, dimmer frame.
 */
export function DustMotes() {
  const reduce = !!useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const motes = useMemo(() => makeMotes(BEAM_POLYGON), []);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;

    let raf = 0;
    let visible = false;
    let width = 0;
    let height = 0;

    const draw = (frames: Frame[]) => {
      ctx.clearRect(0, 0, width, height);
      for (const f of frames) {
        if (f.a <= 0.004) continue;
        const x = f.x * width;
        const y = f.y * height;
        // A soft warm halo, then the speck itself.
        ctx.fillStyle = `rgba(255, 214, 150, ${(f.a * 0.18).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, f.r * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 232, 190, ${f.a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const t0 = performance.now();
    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      draw(motes.map((m) => moteAt(m, (now - t0) / 1000)));
      raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (reduce) draw(motes.map(staticFrame));
      else if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(el.clientWidth * dpr));
      height = Math.max(1, Math.round(el.clientHeight * dpr));
      el.width = width;
      el.height = height;
      // Sizes are in CSS px: scale the context so radii stay the same on dense screens.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      width = el.clientWidth;
      height = el.clientHeight;
      sync();
    };

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(el);
    // The observer accounts for ancestors' clipping, so a beam cropped out of view counts as off screen.
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      sync();
    }) : null;
    if (io) io.observe(el);
    else visible = true;
    document.addEventListener("visibilitychange", sync);
    resize();

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [motes, reduce]);

  return <canvas ref={canvas} aria-hidden data-dust className="pet-beam-zone pointer-events-none absolute" style={{ mixBlendMode: "screen" }} />;
}
