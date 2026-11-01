"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { monthName, plural, type Recap } from "@/lib/recap";
import { daysInYear, sigil } from "@/lib/share/art";
import { CARD_ACCENTS } from "@/lib/share/theme";
import { Ring } from "./charts";

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
  const [a, b] = CARD_ACCENTS.summary;
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

  const art = useMemo(() => sigil(recap.archetype.id, 200, [a, b], "disk-sigil"), [recap.archetype.id, a, b]);

  const streak = recap.longestStreak;
  const streakSub = streak ? (streak.days === 1 ? "day" : "days") : recap.peakMonth ? `Peak ${monthName(recap.peakMonth.month, true)}` : "";
  const foil = "linear-gradient(115deg, #ff6ec7, #ffd86e, #7dffb2, #6ec8ff, #c58bff, #ff6ec7)";
  const foilStyle = { backgroundImage: foil, backgroundSize: "300% 300%", backgroundPosition: foilPos };

  return (
    <div className="[perspective:1100px]" style={{ width: "min(84vw, calc(100dvh - 17rem), 24rem)" }}>
      <motion.div
        data-no-nav
        role="group"
        tabIndex={0}
        aria-label={`Collectible floppy disk for ${recap.viewer.name}, ${recap.year}: ${plural(recap.totalClosed, "issue")} closed, archetype ${recap.archetype.name}, ${plural(recap.activeDays, "active day")}`}
        onPointerEnter={() => setEngaged(true)}
        onPointerMove={move}
        onPointerLeave={() => setEngaged(false)}
        onPointerCancel={() => setEngaged(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ rotateX: reduce ? 6 : rotateX, rotateY: reduce ? -6 : rotateY, transformStyle: "preserve-3d" }}
        initial={reduce ? false : { opacity: 0, y: 40, rotateZ: -3 }}
        animate={{ opacity: 1, y: 0, rotateZ: 0 }}
        transition={{ type: "spring", stiffness: 90, damping: 16, delay: 0.25 }}
        className="focus-ph relative aspect-square w-full touch-none select-none outline-none"
      >
        {/* Sleeve */}
        <div className="absolute inset-0 rounded-[3%] border-2 border-black bg-[linear-gradient(150deg,#2b2923,#0f0e0a)] shadow-[8px_10px_0_rgb(0_0_0/0.55)]">
          <svg viewBox="0 0 200 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden focusable="false">
            <rect x={80} y={8} width={40} height={44} rx={20} fill="#030303" stroke="#4a463a" strokeWidth={2} />
            <circle cx={100} cy={62} r={22} fill="#17150f" stroke="#5a5444" strokeWidth={2} />
            <circle cx={100} cy={62} r={9} fill="#030303" stroke="#7a7360" strokeWidth={1.5} />
          </svg>
        </div>

        {/* Write-protect tab: a holographic foil sticker. */}
        <motion.div aria-hidden className="absolute left-[-1.2%] top-[22%] h-[12%] w-[4.5%] border border-black/60" style={{ ...foilStyle, translateZ: 6 }} />

        {/* Paper label with the system report */}
        <div className="absolute inset-x-[6%] bottom-[3.5%] top-[50%] flex flex-col justify-between overflow-hidden border border-black/40 bg-[#e8e0c4] p-[3%] text-ink" style={{ transform: "translateZ(14px)" }}>
          <div className="h-[7%] min-h-[0.35rem] bg-amber" aria-hidden />
          <div className="flex items-center justify-between text-[clamp(0.9rem,3.6vw,1.2rem)] uppercase leading-none tracking-[0.12em]">
            <span>Linear Wrapped</span>
            <span>System report {recap.year}</span>
          </div>
          <div className="flex min-h-0 flex-1 gap-[3%] pt-[2%]">
            <div className="crt relative aspect-square h-full shrink-0 overflow-hidden border-2 border-ink">
              <Ring value={recap.activeDays / daysInYear(recap.year)} label={`${recap.activeDays} active days of ${daysInYear(recap.year)}`}>
                <div className="h-[62%] w-[62%] [&>svg]:h-full [&>svg]:w-full" aria-hidden>
                  {art}
                </div>
              </Ring>
            </div>
            <div className="min-w-0 flex-1 leading-none">
              <p className="text-[clamp(0.8rem,3vw,1rem)] uppercase tracking-[0.18em] text-ink/70">Archetype</p>
              <p className="text-[clamp(1.5rem,6.6vw,2.1rem)] uppercase leading-[0.95]">{recap.archetype.name}</p>
              <p className="mt-1 text-[clamp(0.85rem,3.2vw,1.1rem)] leading-tight text-ink/80">{recap.archetype.tagline}</p>
            </div>
          </div>
          <dl className="mt-[2%] grid grid-cols-3 gap-[2%] border-t-2 border-dashed border-ink/50 pt-[2%] text-left">
            <Cell k="Closed" v={recap.totalClosed.toLocaleString("en-US")} />
            <Cell k="Active days" v={String(recap.activeDays)} sub={`of ${daysInYear(recap.year)}`} />
            <Cell k="Streak" v={streak ? String(streak.days) : "-"} sub={streakSub} />
          </dl>
          {/* Holographic seal */}
          <motion.div aria-hidden className="absolute right-[3%] top-[14%] flex h-[17%] w-[12%] items-center justify-center border border-black/50 text-[clamp(0.8rem,3vw,1rem)] text-black/70" style={foilStyle}>
            <span className="bg-white/40 px-0.5">{String(recap.year).slice(2)}</span>
          </motion.div>
        </div>

        {/* A light sheen over the plastic, following the pointer. */}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[3%] mix-blend-overlay" style={{ backgroundImage: glare }} />
      </motion.div>
    </div>
  );
}

function Cell({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[clamp(0.7rem,2.6vw,0.9rem)] uppercase tracking-[0.12em] text-ink/70">{k}</dt>
      <dd className="text-[clamp(1.4rem,6vw,1.9rem)] leading-none tabular-nums">{v}</dd>
      <dd className="h-3 text-[clamp(0.7rem,2.6vw,0.9rem)] leading-none text-ink/70">{sub}</dd>
    </div>
  );
}
