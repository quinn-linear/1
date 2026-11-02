"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import { PET_ART, PET_STEAM } from "@/lib/retro/art";
import { makePuffs, puffAt, staticPuffs, type PuffFrame } from "@/lib/retro/steam";

/**
 * Faint steam curling up from the coffee cup. A small canvas laid over the steam box on the
 * picture (`.pet-steam-zone` in globals.css, from the same fractions as the terminal and the
 * dust), so the rim stays on the cup's opening at any size or crop. It never takes pointer
 * events or a place in the accessibility tree, sits under the cassette and the screen, and draws
 * nothing while the tab is hidden, the box is off screen, or the crop has lost the cup's rim.
 * Under reduced motion it draws one still, fainter wisp. Only a requestAnimationFrame handle
 * and observers are held, all released on unmount.
 */
export function Steam() {
  const reduce = !!useReducedMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const puffs = useMemo(() => makePuffs(), []);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;

    let raf = 0;
    let visible = false;
    let width = 0;
    let height = 0;

    // The canvas is the steam box, so puff radii (picture px) scale with its width.
    const draw = (frames: PuffFrame[]) => {
      ctx.clearRect(0, 0, width, height);
      const k = width / (PET_STEAM.w * PET_ART.width);
      for (const f of frames) {
        if (f.a <= 0.004) continue;
        const x = f.x * width;
        const y = f.y * height;
        const r = f.r * k;
        // Taller than wide: a soft warm column of vapour, never a hard edge.
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, 1.35);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, `rgba(255, 232, 190, ${f.a.toFixed(3)})`);
        g.addColorStop(0.55, `rgba(240, 205, 160, ${(f.a * 0.45).toFixed(3)})`);
        g.addColorStop(1, "rgba(240, 205, 160, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    // Is the cup's rim (the box's bottom edge, at the rim's x) inside the viewport?
    const rimShown = () => {
      const b = el.getBoundingClientRect();
      const x = b.left + b.width * 0.5;
      return b.width > 0 && x >= 0 && x <= window.innerWidth && b.bottom >= 24 && b.bottom <= window.innerHeight;
    };

    const live = () => visible && !document.hidden && rimShown();

    // Steam runs on a clock that only advances while frames are drawn, so a hidden tab holds it still instead of jumping.
    let clock = 0;
    let last = 0;
    const frame = (now: number) => {
      raf = 0;
      if (!live()) {
        ctx.clearRect(0, 0, width, height);
        return;
      }
      clock += Math.min(0.1, last ? (now - last) / 1000 : 0);
      last = now;
      el.dataset.steam = "on";
      draw(puffs.map((p) => puffAt(p, clock)));
      raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      if (!live()) {
        delete el.dataset.steam;
        ctx.clearRect(0, 0, width, height);
      } else if (reduce) draw(staticPuffs());
      else raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.max(1, Math.round(el.clientWidth * dpr));
      el.height = Math.max(1, Math.round(el.clientHeight * dpr));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      width = el.clientWidth;
      height = el.clientHeight;
      sync();
    };

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(el);
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
      delete el.dataset.steam;
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [puffs, reduce]);

  return <canvas ref={canvas} aria-hidden data-steam-canvas className="pet-steam-zone pointer-events-none absolute" style={{ mixBlendMode: "screen" }} />;
}
