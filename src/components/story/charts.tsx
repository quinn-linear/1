"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState, type PointerEvent, type ReactNode } from "react";
import { monthName, plural } from "@/lib/recap";

/** Abstract, data-driven visuals. Each one is `aria-hidden` or an `img` with a text equivalent; none invents a number. */

const EASE = [0.16, 1, 0.3, 1] as const;

function useDuration(seconds: number) {
  return useReducedMotion() ? 0 : seconds;
}

/** Progress ring (0-1) with a glowing arc; `children` sit in the middle. */
export function Ring({ value, label, size, children }: { value: number; label: string; size?: number; children?: ReactNode }) {
  const d = useDuration(1.6);
  const v = Math.min(Math.max(value, 0), 1);
  const c = 100;
  const stroke = 7;
  const r = c - stroke - 6;
  return (
    <div role="img" aria-label={label} className="relative mx-auto" style={size ? { width: size, height: size, maxWidth: "78vw", maxHeight: "78vw" } : { width: "100%", aspectRatio: "1" }}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
        </defs>
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
          const long = i % 5 === 0;
          const r1 = r - stroke - 3;
          const r2 = r1 - (long ? 9 : 5);
          return <line key={i} x1={c + r1 * Math.cos(a)} y1={c + r1 * Math.sin(a)} x2={c + r2 * Math.cos(a)} y2={c + r2 * Math.sin(a)} stroke="var(--ph)" strokeOpacity={long ? 0.7 : 0.35} strokeWidth={0.7} />;
        })}
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--ph)" strokeOpacity={0.18} strokeWidth={stroke} />
        <g transform={`rotate(-90 ${c} ${c})`}>
          <motion.circle cx={c} cy={c} r={r} fill="none" stroke="var(--a1)" strokeWidth={stroke} strokeLinecap="butt" pathLength={1} strokeDasharray="1 1" initial={{ pathLength: 0 }} animate={{ pathLength: v }} transition={{ duration: d, ease: EASE, delay: 0.3 }} />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

type Pt = [number, number];

/** Smooth path through points (Catmull-Rom to cubic Bezier), clamped so it never dips below the baseline. */
function smooth(pts: Pt[], floor: number): string {
  const f = (n: number) => n.toFixed(2);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) * t, Math.min(p1[1] + (p2[1] - p0[1]) * t, floor)];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) * t, Math.min(p2[1] - (p3[1] - p1[1]) * t, floor)];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

const W = 360;
const H = 190;
const PAD_X = 14;
const BASE = 164;
const TOP = 26;

/**
 * Monthly area chart you can scrub: hover, drag or tab through the months.
 * The readout above it is a polite live region; arrow keys stay with the story.
 */
export function MonthChart({ monthly, peak }: { monthly: { month: number; count: number }[]; peak: number | null }) {
  const d = useDuration(1.4);
  const [active, setActive] = useState<number>(peak ?? 0);
  const max = Math.max(...monthly.map((m) => m.count), 1);
  const x = (i: number) => PAD_X + (i * (W - PAD_X * 2)) / (monthly.length - 1);
  const y = (n: number) => BASE - (n / max) * (BASE - TOP);
  const pts: Pt[] = monthly.map((m, i) => [x(i), y(m.count)]);
  const line = smooth(pts, BASE);
  const area = `${line} L${x(monthly.length - 1)},${BASE} L${x(0)},${BASE} Z`;
  const cur = monthly[active] ?? monthly[0];
  const label = monthly.map((m) => `${monthName(m.month, true)} ${m.count}`).join(", ");

  const scrub = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - box.left) / box.width) * (monthly.length - 1));
    setActive(Math.min(Math.max(i, 0), monthly.length - 1));
  };

  return (
    <div className="w-full">
      <p className="mb-2 flex items-baseline justify-between font-mono text-xs uppercase tracking-widest text-ph/70" aria-live="polite">
        <span>{monthName(cur.month)}</span>
        <span className="text-base font-semibold normal-case tracking-normal text-ph tabular-nums">{plural(cur.count, "issue")}</span>
      </p>
      <div role="group" aria-label={`Issues closed per month: ${label}`} className="relative w-full touch-pan-y" onPointerMove={scrub}>
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block max-h-[28dvh] w-full overflow-visible" aria-hidden>
                    {[0.25, 0.5, 0.75, 1].map((t) => (
            <line key={t} x1={PAD_X} x2={W - PAD_X} y1={BASE - t * (BASE - TOP)} y2={BASE - t * (BASE - TOP)} stroke="var(--ph)" strokeOpacity={0.3} strokeDasharray="2 5" />
          ))}
          <motion.path d={area} fill="var(--a1)" fillOpacity={0.18} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: d, delay: 0.5 }} />
          <motion.path d={line} fill="none" stroke="var(--a1)" strokeWidth={3} strokeLinecap="square" strokeLinejoin="miter" pathLength={1} strokeDasharray="1 1" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: d, ease: EASE }} />
          {monthly.map((m, i) => (
            <text key={m.month} x={x(i)} y={H - 6} textAnchor="middle" fontSize={14} fontFamily="var(--font-vt323)" fill="var(--ph)" fillOpacity={i === active ? 1 : 0.7}>
              {monthName(m.month, true)[0]}
            </text>
          ))}
          <motion.g animate={{ x: x(active) }} initial={false} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
            <line y1={TOP - 10} y2={BASE} stroke="var(--a1)" strokeOpacity={0.7} />
          </motion.g>
          <motion.rect width={10} height={10} fill="#0a0912" stroke="var(--a1)" strokeWidth={3} initial={false} animate={{ x: x(active) - 5, y: y(cur.count) - 5 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} />
        </svg>
        <div className="absolute inset-0 flex">
          {monthly.map((m, i) => (
            <button
              key={m.month}
              type="button"
              aria-label={`${monthName(m.month)}: ${plural(m.count, "issue")}${m.month === peak ? " (peak)" : ""}`}
              aria-pressed={i === active}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              className="h-full flex-1 cursor-crosshair focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a1)]/70 focus-visible:ring-inset"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** One cell per day of the streak: a literal picture of "days in a row", cell count == days. */
export function DayChain({ days, label }: { days: number; label: string }) {
  const reduce = useReducedMotion();
  return (
    <div role="img" aria-label={label} className="grid w-full gap-[3px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(13px, 1fr))" }}>
      {Array.from({ length: days }, (_, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="aspect-square"
          style={{ background: i === days - 1 ? "var(--a2)" : "var(--a1)" }}
          initial={reduce ? false : { opacity: 0, scale: 0.2 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: reduce ? 0 : 0.35 + Math.min(i * 0.015, 1.4), type: "spring", stiffness: 260, damping: 18 }}
        />
      ))}
    </div>
  );
}

/** Horizontal glowing meter for "share of" comparisons. `value` is 0-1. */
export function Meter({ value, label, caption }: { value: number; label: string; caption: string }) {
  const d = useDuration(1.3);
  const v = Math.min(Math.max(value, 0), 1);
  return (
    <div className="w-full max-w-md">
      <div role="img" aria-label={label} className="panel relative h-5 overflow-hidden p-[3px]">
        <motion.div className="h-full bg-[var(--a1)] [background-image:repeating-linear-gradient(90deg,transparent_0_9px,rgb(0_0_0/0.55)_9px_11px)]" initial={{ width: 0 }} animate={{ width: `${Math.max(v * 100, v > 0 ? 2 : 0)}%` }} transition={{ duration: d, ease: EASE, delay: 0.4 }} />
      </div>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-ph/70">{caption}</p>
    </div>
  );
}

/** How long something has been open, on a track that is at least a year long. */
export function AgeTrack({ days, label }: { days: number; label: string }) {
  const d = useDuration(1.8);
  const span = Math.max(365, Math.ceil(days / 365) * 365);
  const years = span / 365;
  return (
    <div className="w-full max-w-md">
      <div role="img" aria-label={label} className="relative h-10">
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-ph/10" />
        {Array.from({ length: years + 1 }, (_, i) => (
          <span key={i} aria-hidden className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-ph/10" style={{ left: `${(i / years) * 100}%` }} />
        ))}
        <motion.div aria-hidden className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 bg-[var(--a1)]" initial={{ width: 0 }} animate={{ width: `${(days / span) * 100}%` }} transition={{ duration: d, ease: EASE, delay: 0.4 }} />
        <motion.span aria-hidden className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 bg-[var(--a2)]" initial={{ left: 0 }} animate={{ left: `${(days / span) * 100}%` }} transition={{ duration: d, ease: EASE, delay: 0.4 }} />
      </div>
      <p className="mt-1 flex justify-between font-mono text-xs uppercase tracking-widest text-ph/70">
        <span>Opened</span>
        <span>{years === 1 ? "1 year" : `${years} years`} scale</span>
      </p>
    </div>
  );
}

/** Twelve tiny bars: the year at a glance, from the real monthly counts. */
export function YearSpark({ monthly }: { monthly: { month: number; count: number }[] }) {
  const max = Math.max(...monthly.map((m) => m.count), 1);
  return (
    <div aria-hidden className="flex h-12 items-end gap-1.5">
      {monthly.map((m, i) => (
        <motion.span
          key={m.month}
          className="w-1.5 bg-[var(--a1)] opacity-80"
          initial={{ height: 3 }}
          animate={{ height: Math.max((m.count / max) * 48, 3) }}
          transition={{ delay: 0.5 + i * 0.04, type: "spring", stiffness: 140, damping: 16 }}
        />
      ))}
    </div>
  );
}
