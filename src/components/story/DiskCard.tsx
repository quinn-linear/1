"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useState, type PointerEvent } from "react";
import { monthName, plural, type Recap } from "@/lib/recap";
import { daysInYear } from "@/lib/share/art";
import { ARCHETYPE_ART, ART_SIZE } from "@/lib/share/archetypeArt";


/**
 * The end card: a collectible 5.25" floppy disk with a system report on its
 * paper label. The only holographic parts are two small foil stickers (the
 * write-protect tab and a seal on the label), whose colors slide with the light.
 * The disk tilts toward the pointer or finger, idles with a slow sway (also
 * while focused, so keyboard users see it) and is static under reduced motion.
 * `data-no-nav` keeps card gestures from turning story pages.
 *
 * It shows only what the shared summary image shows (plus the viewer's own
 * name, which never leaves their screen), so the preview matches the download.
 */
export function DiskCard({ recap }: { recap: Recap }) {
  const reduce = useReducedMotion();
  const [engaged, setEngaged] = useState(false);
  const [focused, setFocused] = useState(false);

  // Pointer position within the disk, 0-1. Resting light sits upper-left.
  const px = useMotionValue(0.3);
  const py = useMotionValue(0.2);
  const sx = useSpring(px, { stiffness: 140, damping: 18, mass: 0.6 });
  const sy = useSpring(py, { stiffness: 140, damping: 18, mass: 0.6 });

  const rotateY = useTransform(sx, [0, 1], [-14, 14]);
  const rotateX = useTransform(sy, [0, 1], [12, -12]);
  const foilX = useTransform(sx, [0, 1], [0, 100]);
  const foilY = useTransform(sy, [0, 1], [0, 100]);
  const foilPos = useMotionTemplate`${foilX}% ${foilY}%`;
  const glare = useMotionTemplate`radial-gradient(circle at ${useTransform(sx, (v) => v * 100)}% ${useTransform(sy, (v) => v * 100)}%, rgba(255,255,255,0.28), rgba(255,255,255,0) 55%)`;

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

  const art = ARCHETYPE_ART[recap.archetype.id];

  const streak = recap.longestStreak;
  const streakSub = streak ? (streak.days === 1 ? "day" : "days") : recap.peakMonth ? `Peak ${monthName(recap.peakMonth.month, true)}` : "";
  const foil = "linear-gradient(115deg, #ff6ec7, #ffd86e, #7dffb2, #6ec8ff, #c58bff, #ff6ec7)";
  const foilStyle = { backgroundImage: foil, backgroundSize: "300% 300%", backgroundPosition: foilPos };

  return (
    <div className="[perspective:1100px]" style={{ width: "min(100%, 24rem, 64dvh)" }}>
      <motion.div
        data-no-nav
        data-disk
        role="group"
        tabIndex={0}
        aria-label={`Collectible floppy disk for ${recap.viewer.name}, ${recap.year}: ${plural(recap.totalClosed, "issue")} closed, archetype ${recap.archetype.name}, ${plural(recap.activeDays, "active day")}`}
        onPointerEnter={() => setEngaged(true)}
        onPointerMove={move}
        onPointerLeave={() => setEngaged(false)}
        onPointerCancel={() => setEngaged(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ rotateX: reduce ? 6 : rotateX, rotateY: reduce ? -6 : rotateY, transformStyle: "preserve-3d", containerType: "inline-size" }}
        initial={reduce ? false : { opacity: 0, y: 40, rotateZ: -3 }}
        animate={{ opacity: 1, y: 0, rotateZ: 0 }}
        transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.25 }}
        className="focus-ph relative aspect-square w-full touch-none select-none outline-none"
      >
        {/* Sleeve */}
        <div className="absolute inset-0 rounded-[3%] border-2 border-black bg-[linear-gradient(150deg,#2b2923,#0f0e0a)] shadow-[8px_10px_0_rgb(0_0_0/0.55)]">
          <svg viewBox="0 0 200 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden focusable="false">
            <rect x={80} y={7} width={40} height={36} rx={18} fill="#030303" stroke="#4a463a" strokeWidth={2} />
            <circle cx={100} cy={64} r={19} fill="#17150f" stroke="#5a5444" strokeWidth={2} />
            <circle cx={100} cy={64} r={8} fill="#030303" stroke="#7a7360" strokeWidth={1.5} />
          </svg>
        </div>

        {/* Write-protect tab: a holographic foil sticker. */}
        <motion.div aria-hidden className="absolute left-[-1.2%] top-[20%] h-[10%] w-[4.5%] border border-black/60" style={{ ...foilStyle, translateZ: 6 }} />

        {/*
          Paper label. A grid of three bands (header / archetype / stats), each in its
          own row, so nothing can sit on top of anything else: text wraps or clamps
          inside its cell, and the middle band takes whatever height is left. Type is in
          container units (cqw), so the whole label scales with the disk.
        */}
        <div
          className="absolute inset-x-[5%] bottom-[3%] top-[42%] grid grid-rows-[auto_minmax(0,1fr)_auto] gap-[2.6cqw] overflow-hidden border border-black/40 bg-[#e8e0c4] px-[3cqw] pb-[2.4cqw] pt-0 text-ink"
          style={{ transform: "translateZ(14px)" }}
        >
          <header className="-mx-[3cqw] mb-0 flex items-baseline justify-between gap-[2cqw] border-t-[1.4cqw] border-amber px-[3cqw] pt-[1.2cqw] text-[3.6cqw] uppercase leading-none tracking-[0.1em]">
            <span className="min-w-0 truncate">Linear Wrapped</span>
            <span className="shrink-0 tabular-nums">{recap.year}</span>
          </header>

          <div className="grid min-h-0 grid-cols-[26cqw_minmax(0,1fr)] items-center gap-[2.6cqw]">
            {/* The archetype's engraving, whole and uncropped, on its parchment. */}
            <div className="relative aspect-square w-full overflow-hidden border-2 border-ink bg-[#e8e0c4]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={art.web} alt={art.alt} width={ART_SIZE.web} height={ART_SIZE.web} decoding="async" draggable={false} className="block h-full w-full object-contain" />
            </div>
            <div className="min-h-0 min-w-0">
              <p className="text-[2.8cqw] uppercase leading-none tracking-[0.16em] text-ink/70">Archetype</p>
              <p className="mt-[0.6cqw] line-clamp-2 break-words text-[6.4cqw] uppercase leading-[0.92]">{recap.archetype.name}</p>
              <p className="mt-[0.8cqw] line-clamp-3 break-words text-[3.7cqw] leading-[1.05] text-ink/80">{recap.archetype.description}</p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-[2cqw] border-t-2 border-dashed border-ink/50 pt-[1.6cqw] text-left">
            <Cell k="Closed" v={recap.totalClosed.toLocaleString("en-US")} />
            <Cell k="Active days" v={String(recap.activeDays)} sub={`of ${daysInYear(recap.year)}`} />
            <Cell k="Streak" v={streak ? String(streak.days) : "-"} sub={streakSub} />
          </dl>
        </div>

        {/* Holographic seal, on the sleeve above the label so it never covers text. */}
        <motion.div aria-hidden className="absolute right-[7%] top-[22%] flex h-[11%] w-[11%] items-center justify-center border border-black/50 text-[3.4cqw] text-black/70" style={{ ...foilStyle, translateZ: 10 }}>
          <span className="bg-white/40 px-0.5">{String(recap.year).slice(2)}</span>
        </motion.div>

        {/* A light sheen over the plastic, following the pointer. */}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[3%] mix-blend-overlay" style={{ backgroundImage: glare }} />
      </motion.div>
    </div>
  );
}

function Cell({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[2.7cqw] uppercase leading-none tracking-[0.1em] text-ink/70">{k}</dt>
      <dd className="mt-[0.4cqw] truncate text-[7cqw] leading-none tabular-nums">{v}</dd>
      <dd className="mt-[0.4cqw] h-[3cqw] truncate text-[2.7cqw] leading-none text-ink/70">{sub}</dd>
    </div>
  );
}
