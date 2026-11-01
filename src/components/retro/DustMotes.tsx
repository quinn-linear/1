"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import { BEAM_POLYGON } from "@/lib/retro/art";
import { makeMotes, moteAt, staticFrame, type Frame } from "@/lib/retro/dust";
import { SPAN, makeMoths, mothAt, type MothFrame } from "@/lib/retro/moth";

/**
 * Dust motes drifting in the lamp's beam, and three small moths that always flutter around the light. One small canvas laid exactly over the beam's box
 * on the picture (`.pet-beam-zone` in globals.css, from the same fractions as the
 * terminal), so it follows the picture's crop and size. It never takes pointer events or
 * a place in the accessibility tree, sits under the cassette and the screen, and does no
 * work while it is off screen (including when the crop hides the lamp, as on phones) or
 * the tab is hidden (the moths' clock stops with it, and it is only ever started while the
 * beam is on screen). Under reduced motion it draws one still, dimmer frame and no moths.
 * The moths' paths are drawn from `Math.random` in the effect, so nothing random is
 * rendered on the server.
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

    const scale = () => Math.min(2.2, Math.max(0.55, width / 330));

    // Two halftone-dotted wings and a body, seen from above and tipped to its heading.
    const drawMoth = (m: MothFrame) => {
      const k = scale();
      const half = (SPAN / 2) * k * m.size;
      ctx.save();
      ctx.translate(m.x * width, m.y * height);
      ctx.rotate(m.angle + Math.PI / 2);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.scale(side * (0.15 + 0.85 * m.open), 1);
        ctx.fillStyle = `rgba(255, 232, 190, ${(m.a * 0.8).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(half * 0.55, -half * 0.1, half * 0.6, half * 0.45, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(150, 110, 60, ${(m.a * 0.55).toFixed(3)})`;
        for (const [dx, dy] of [[0.45, -0.25], [0.8, 0.0], [0.5, 0.15]]) {
          ctx.beginPath();
          ctx.arc(half * dx, half * dy, half * 0.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.fillStyle = `rgba(255, 214, 150, ${m.a.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, half * 0.14, half * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const draw = (frames: Frame[], moths: MothFrame[] = []) => {
      ctx.clearRect(0, 0, width, height);
      // Specks grow with the picture (the canvas is the beam's box on it), so they read the same on a laptop and a 4K screen.
      const k = scale();
      for (const f of frames) {
        if (f.a <= 0.004) continue;
        const x = f.x * width;
        const y = f.y * height;
        // A soft warm halo, then the speck itself.
        ctx.fillStyle = `rgba(255, 214, 150, ${(f.a * 0.3).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, f.r * k * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 232, 190, ${f.a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, f.r * k, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const m of moths) drawMoth(m);
    };

    const t0 = performance.now();
    // The moths run on their own clock that only advances while frames are drawn, so a hidden tab or an off-screen beam holds them still.
    let clock = 0;
    let last = 0;
    // Three moths with their own paths, wing beats and depth, made once per mount.
    const moths = makeMoths(Math.random);
    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      clock += Math.min(0.1, last ? (now - last) / 1000 : 0);
      last = now;
      const drawn = moths.map((m) => mothAt(m, clock));
      // Read by the browser checks: how many moths are on, and where (box fractions).
      el.dataset.moth = String(drawn.length);
      el.dataset.mothPos = drawn.map((m) => `${m.x.toFixed(3)},${m.y.toFixed(3)}`).join(";");
      draw(motes.map((m) => moteAt(m, (now - t0) / 1000)), drawn);
      raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
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
      delete el.dataset.moth;
      delete el.dataset.mothPos;
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [motes, reduce]);

  return <canvas ref={canvas} aria-hidden data-dust className="pet-beam-zone pointer-events-none absolute" style={{ mixBlendMode: "screen" }} />;
}
