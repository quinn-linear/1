"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { monthName, plural, type Recap } from "@/lib/recap";
import { daysInYear, sigil, sparkles } from "@/lib/share/art";
import { CARD_ACCENTS } from "@/lib/share/theme";
import { Ring } from "./charts";

/**
 * The end card: an original holographic collectible. Layers, back to front:
 * dark metal base, iridescent foil whose hue slides with the light, diffraction
 * lines, a specular glare under the pointer, sparkles, then the content at a
 * slight depth. It tilts toward the pointer or finger, idles with a slow sway
 * (also while focused, so keyboard users see it), and is static under reduced
 * motion. `data-no-nav` keeps card gestures from turning story pages.
 *
 * It shows only what the shared summary image shows (plus the viewer's own
 * name, which never leaves their screen), so the preview matches the download.
 */
export function HoloCard({ recap }: { recap: Recap }) {
  const reduce = useReducedMotion();
  const [a, b] = CARD_ACCENTS.summary;
  const [engaged, setEngaged] = useState(false);
  const [focused, setFocused] = useState(false);

  // Pointer position within the card, 0-1. Resting light sits upper-left, like the share image.
  const px = useMotionValue(0.3);
  const py = useMotionValue(0.2);
  const sx = useSpring(px, { stiffness: 140, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 140, damping: 18, mass: 0.6 });

  const rotateY = useTransform(sx, [0, 1], [-16, 16]);
  const rotateX = useTransform(sy, [0, 1], [14, -14]);
  const foilX = useTransform(sx, [0, 1], [0, 100]);
  const foilY = useTransform(sy, [0, 1], [0, 100]);
  const foilPos = useMotionTemplate`${foilX}% ${foilY}%`;
  const glare = useMotionTemplate`radial-gradient(circle at ${useTransform(sx, (v) => v * 100)}% ${useTransform(sy, (v) => v * 100)}%, rgba(255,255,255,0.55), rgba(255,255,255,0.08) 35%, rgba(255,255,255,0) 60%)`;
  const hue = useTransform(sx, [0, 1], [-35, 35]);
  const foilFilter = useMotionTemplate`hue-rotate(${hue}deg) saturate(1.25)`;
  const glintX = useTransform(sx, [0, 1], [-14, 14]);
  const glintY = useTransform(sy, [0, 1], [-14, 14]);

  // Idle sway so the foil is alive before anyone touches it.
  useEffect(() => {
    if (reduce || engaged) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      const amp = focused ? 0.28 : 0.16;
      px.set(0.5 + Math.sin(t * 0.7) * amp + 0.02);
      py.set(0.45 + Math.cos(t * 0.55) * amp);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, engaged, focused, px, py]);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce) return;
    const box = e.currentTarget.getBoundingClientRect();
    px.set(Math.min(Math.max((e.clientX - box.left) / box.width, 0), 1));
    py.set(Math.min(Math.max((e.clientY - box.top) / box.height, 0), 1));
  };

  const dots = useMemo(() => sparkles(26, 11), []);
  const art = useMemo(() => sigil(recap.archetype.id, 200, [a, b], "web-sigil"), [recap.archetype.id, a, b]);

  const streak = recap.longestStreak;
  const streakSub = streak ? (streak.days === 1 ? "day" : "days") : recap.peakMonth ? `Peak ${monthName(recap.peakMonth.month, true)}` : "";

  return (
    <div className="[perspective:1100px]" style={{ width: "min(80vw, calc((100dvh - 15rem) * 0.714), 22rem)" }}>
      <motion.div
        data-no-nav
        role="group"
        tabIndex={0}
        aria-label={`Collectible summary card for ${recap.viewer.name}, ${recap.year}: ${plural(recap.totalClosed, "issue")} closed, archetype ${recap.archetype.name}, ${plural(recap.activeDays, "active day")}`}
        onPointerEnter={() => setEngaged(true)}
        onPointerMove={move}
        onPointerLeave={() => setEngaged(false)}
        onPointerCancel={() => setEngaged(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ rotateX: reduce ? 8 : rotateX, rotateY: reduce ? -8 : rotateY, transformStyle: "preserve-3d" }}
        initial={reduce ? false : { opacity: 0, y: 40, scale: 0.92, rotateZ: -3 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateZ: 0 }}
        transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.25 }}
        className="relative aspect-[5/7] w-full touch-none select-none rounded-[1.6rem] p-[3px] outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-[#07080b]"
      >
        {/* Rim: rainbow foil edge plus a soft colored halo. */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-[1.6rem] shadow-[0_30px_90px_-20px_rgba(139,92,246,0.55),0_0_60px_-10px_rgba(103,232,249,0.35)]"
          style={{ backgroundImage: "linear-gradient(135deg,#67e8f9,#c4b5fd,#f0abfc,#fde68a,#86efac,#67e8f9)", backgroundSize: "250% 250%", backgroundPosition: foilPos, filter: foilFilter }}
        />

        <div className="relative h-full w-full overflow-hidden rounded-[1.45rem] bg-[linear-gradient(160deg,#181a26,#0b0c13_55%,#14101f)]">
          {/* Foil */}
          <motion.div
            aria-hidden
            className="absolute inset-0 opacity-90 mix-blend-color-dodge"
            style={{
              backgroundImage:
                "linear-gradient(115deg, rgba(103,232,249,0) 6%, rgba(103,232,249,0.55) 20%, rgba(196,181,253,0.6) 33%, rgba(240,171,252,0.55) 46%, rgba(253,230,138,0.45) 58%, rgba(134,239,172,0.45) 70%, rgba(103,232,249,0) 86%)",
              backgroundSize: "260% 260%",
              backgroundPosition: foilPos,
              filter: foilFilter,
            }}
          />
          <motion.div
            aria-hidden
            className="absolute inset-0 opacity-50 mix-blend-overlay"
            style={{
              backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 7px)",
              backgroundSize: "100% 100%",
              backgroundPosition: foilPos,
            }}
          />
          {/* Sparkles drift against the tilt for parallax depth. */}
          <motion.div aria-hidden className="absolute inset-[-6%]" style={{ x: glintX, y: glintY, translateZ: 30 }}>
            {dots.map((g, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-[radial-gradient(circle,#fff,transparent_70%)] mix-blend-screen"
                style={{ left: `${g.x * 100}%`, top: `${g.y * 100}%`, width: 3 + g.s * 6, height: 3 + g.s * 6, opacity: g.o * 0.8 }}
              />
            ))}
          </motion.div>

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-between p-[7%]" style={{ transform: "translateZ(40px)" }}>
            <div className="flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.3em] text-white/85 sm:text-[0.65rem]">
              <span>Linear Wrapped</span>
              <span>{recap.year}</span>
            </div>

            <div className="relative mx-auto flex aspect-square w-[78%] items-center justify-center rounded-[1.1rem] bg-black/45 ring-1 ring-white/25">
              <Ring value={recap.activeDays / daysInYear(recap.year)} label={`${recap.activeDays} active days of ${daysInYear(recap.year)}`} >
                <motion.div className="h-[62%] w-[62%]" animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 120, ease: "linear", repeat: Infinity }}>
                  <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" aria-hidden>
                    {art}
                  </div>
                </motion.div>
              </Ring>
            </div>

            <div>
              <p className="font-mono text-[0.58rem] uppercase tracking-[0.3em] text-white/65">Archetype</p>
              <p className="text-[clamp(1.6rem,8vw,2.2rem)] font-semibold leading-none tracking-[-0.04em]">{recap.archetype.name}</p>
              <p className="mt-1 text-[0.7rem] leading-snug text-white/70 sm:text-xs">{recap.archetype.tagline}</p>
            </div>

            <dl className="grid grid-cols-3 gap-[0.4rem] text-left">
              <Cell k="Closed" v={recap.totalClosed.toLocaleString("en-US")} />
              <Cell k="Active days" v={String(recap.activeDays)} sub={`of ${daysInYear(recap.year)}`} />
              <Cell k="Streak" v={streak ? String(streak.days) : "-"} sub={streakSub} />
            </dl>
          </div>

          {/* Specular glare + edge vignette sit above everything. */}
          <motion.div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-overlay" style={{ backgroundImage: glare }} />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent,rgba(0,0,0,0.5))]" />
        </div>
      </motion.div>
    </div>
  );
}

function Cell({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.07] px-2 py-1.5 ring-1 ring-white/20">
      <dt className="font-mono text-[0.5rem] uppercase tracking-[0.2em] text-white/65">{k}</dt>
      <dd className="text-lg font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-xl">{v}</dd>
      <dd className="mt-0.5 h-3 text-[0.55rem] text-white/60">{sub}</dd>
    </div>
  );
}
