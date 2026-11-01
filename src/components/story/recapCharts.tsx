"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { formatDay, plural } from "@/lib/recap";
import type { Recap } from "@/lib/recap";
import { constellationLayout, constellationLinks, daysInYear } from "@/lib/share/art";
import { addDays, dayNumber } from "@/lib/stats/time";

/**
 * Charts for the Comeback, Scope Shapeshifter, Constellation and Photo Finish
 * cards. Each is an `img`/`group` with a text equivalent and draws only real
 * counts. Interactive ones carry `data-no-nav` so tapping or dragging them
 * never turns story pages, and are keyboard reachable via real buttons.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

/** Where a local YYYY-MM-DD falls in the year, 0 (Jan 1) to 1 (Dec 31). */
const frac = (date: string, year: number) => Math.min(Math.max((dayNumber(date) - dayNumber(`${year}-01-01`)) / Math.max(daysInYear(year) - 1, 1), 0), 1);

const MONTH_STARTS = (year: number) => Array.from({ length: 12 }, (_, m) => frac(`${year}-${String(m + 1).padStart(2, "0")}-01`, year));

function YearAxis({ year, y }: { year: number; y: number }) {
  return (
    <>
      <line x1={0} x2={100} y1={y} y2={y} stroke="#fff" strokeOpacity={0.15} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
      {MONTH_STARTS(year).map((f, i) => (
        <line key={i} x1={f * 100} x2={f * 100} y1={y - 2} y2={y + 2} stroke="#fff" strokeOpacity={i % 3 === 0 ? 0.45 : 0.2} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
      ))}
    </>
  );
}

type Comeback = Extract<Recap["comeback"], { status: "ok" }>;

/** Year line with the quiet stretch (dashed) and the burst after it (solid). Focus or tap either to read it. */
export function ComebackTimeline({ year, data }: { year: number; data: Comeback }) {
  const reduce = useReducedMotion();
  const [part, setPart] = useState<"quiet" | "burst">("burst");
  const q0 = frac(data.quietStart, year) * 100;
  const q1 = frac(data.quietEnd, year) * 100;
  const b0 = frac(data.returnDate, year) * 100;
  const b1 = frac(addDays(data.returnDate, data.burstDays - 1), year) * 100;
  const readout =
    part === "quiet"
      ? `${plural(data.quietDays, "quiet day")}: ${formatDay(data.quietStart)} to ${formatDay(data.quietEnd)}, nothing closed.`
      : `${plural(data.burstCount, "issue")} closed in ${plural(data.burstDays, "day")} from ${formatDay(data.returnDate)}.`;
  const pill = (id: "quiet" | "burst", label: string) => (
    <button
      type="button"
      aria-pressed={part === id}
      onClick={() => setPart(id)}
      onFocus={() => setPart(id)}
      className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-widest transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${part === id ? "border-[var(--a1)] bg-white/10 text-white" : "border-white/20 text-white/60"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="w-full max-w-md" data-no-nav>
      <div role="img" aria-label={`${year} timeline: ${plural(data.quietDays, "quiet day")} from ${formatDay(data.quietStart)} to ${formatDay(data.quietEnd)}, then ${plural(data.burstCount, "issue")} in ${plural(data.burstDays, "day")} from ${formatDay(data.returnDate)}`}>
        <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="block h-16 w-full overflow-visible" aria-hidden>
          <YearAxis year={year} y={16} />
          <rect x={q0} y={14.5} width={Math.max(q1 - q0, 0.8)} height={3} rx={1.5} fill="none" stroke="#fff" strokeOpacity={part === "quiet" ? 0.9 : 0.45} strokeDasharray="1.5 1.5" strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
          <motion.rect x={b0} width={Math.max(b1 - b0, 1.6)} rx={0.8} fill="var(--a1)" style={{ filter: "drop-shadow(0 0 3px var(--a1))" }} initial={reduce ? false : { y: 16, height: 0 }} animate={{ y: 2, height: 14 }} transition={{ duration: reduce ? 0 : 0.9, ease: EASE, delay: 0.5 }} />
        </svg>
        <p aria-hidden className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-widest text-white/40">
          <span>Jan</span>
          <span>Dec</span>
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        {pill("quiet", "Quiet")}
        {pill("burst", "Burst")}
      </div>
      <p className="mt-2 text-sm text-white/70" aria-live="polite">
        {readout}
      </p>
    </div>
  );
}

type Scope = Extract<Recap["scope"], { status: "ok" }>;
const ORDINAL = ["Q1", "Q2", "Q3", "Q4"];
const SERIES_MIX = [0, 34, 67, 100];

/** Stacked quarterly mix of projects or labels. Bars show shares; every quarter is a button with the exact counts. */
export function ScopeChart({ scope }: { scope: Scope }) {
  const reduce = useReducedMotion();
  const [dim, setDim] = useState<"projects" | "labels">("projects");
  const [active, setActive] = useState(scope.toQuarter - 1);
  const data = scope[dim];
  const noneLabel = dim === "projects" ? "No project" : "No label";
  const rows = [
    ...data.series.map((s, i) => ({ name: s.name, counts: s.counts, color: `color-mix(in oklab, var(--a1), var(--a2) ${SERIES_MIX[i]}%)` })),
    { name: "Other", counts: data.other, color: "rgba(255,255,255,0.4)" },
    { name: noneLabel, counts: data.none, color: "rgba(255,255,255,0.14)" },
  ].filter((r) => r.counts.some((c) => c > 0));
  const total = (q: number) => rows.reduce((sum, r) => sum + r.counts[q], 0);
  const unit = dim === "projects" ? "issue" : "label use";
  const summary = rows.map((r) => `${r.name}: ${r.counts.map((c, q) => `${ORDINAL[q]} ${c}`).join(", ")}`).join(". ");

  return (
    <div className="w-full max-w-md" data-no-nav>
      <div className="mb-3 flex gap-2" role="group" aria-label="Show mix of">
        {(["projects", "labels"] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={dim === d}
            onClick={() => setDim(d)}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-widest transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${dim === d ? "border-[var(--a1)] bg-white/10 text-white" : "border-white/20 text-white/60"}`}
          >
            {d}
          </button>
        ))}
      </div>
      <div role="group" aria-label={`Share of ${dim} per quarter. ${summary}`} className="flex h-44 items-stretch gap-2">
        {[0, 1, 2, 3].map((q) => {
          const t = total(q);
          const qualifies = scope.qualifying.includes(q + 1);
          return (
            <button
              key={q}
              type="button"
              aria-pressed={active === q}
              aria-label={`${ORDINAL[q]}: ${plural(scope.quarterClosed[q], "closed issue")}${qualifies ? "" : ", too few to compare"}`}
              onClick={() => setActive(q)}
              onFocus={() => setActive(q)}
              onPointerEnter={(e) => e.pointerType === "mouse" && setActive(q)}
              className={`flex min-w-0 flex-1 flex-col justify-end overflow-hidden rounded-xl p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${active === q ? "ring-1 ring-white/60" : ""} ${qualifies ? "" : "opacity-45"}`}
            >
              {t === 0 ? (
                <span className="h-px w-full bg-white/20" />
              ) : (
                rows
                  .slice()
                  .reverse()
                  .map((r) =>
                    r.counts[q] > 0 ? (
                      <motion.span key={r.name} className="block w-full" style={{ background: r.color }} initial={reduce ? false : { height: 0 }} animate={{ height: `${(r.counts[q] / t) * 100}%` }} transition={{ duration: reduce ? 0 : 0.8, ease: EASE, delay: 0.3 + q * 0.08 }} />
                    ) : null,
                  )
              )}
            </button>
          );
        })}
      </div>
      <p aria-hidden className="mt-1 flex gap-2 font-mono text-[11px] uppercase tracking-widest text-white/50">
        {ORDINAL.map((q) => (
          <span key={q} className="flex-1 text-center">
            {q}
          </span>
        ))}
      </p>
      <p className="mt-2 min-h-10 text-sm text-white/70" aria-live="polite">
        <span className="font-medium text-white">{ORDINAL[active]}</span>: {plural(scope.quarterClosed[active], "closed issue")}
        {total(active) > 0 &&
          ` — ${rows
            .filter((r) => r.counts[active] > 0)
            .map((r) => `${r.name} ${r.counts[active]}`)
            .join(", ")} (${unit}s)`}
      </p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
        {rows.map((r) => (
          <li key={r.name} className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
            <span className="truncate">{r.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Project stars sized by closed issues (area proportional to count). Each star is focusable; the list below is the text equivalent. */
export function ConstellationChart({ stars }: { stars: { name: string; closedCount: number }[] }) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const layout = constellationLayout(stars.map((s) => s.closedCount));
  const links = constellationLinks(layout);
  const W = 400;
  const H = 300;
  const cur = stars[active] ?? stars[0];
  return (
    <div className="w-full max-w-md" data-no-nav>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Constellation of ${plural(stars.length, "project")}, star size shows closed issues`} className="block w-full overflow-visible">
        <defs>
          <radialGradient id="cn-g">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.45" stopColor="var(--a1)" />
            <stop offset="1" stopColor="var(--a2)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {links.map(([i, j]) => (
          <line key={`${i}-${j}`} x1={layout[i].x * W} y1={layout[i].y * H} x2={layout[j].x * W} y2={layout[j].y * H} stroke="#fff" strokeOpacity={0.22} strokeWidth={0.8} />
        ))}
        {layout.map((s, i) => {
          const r = s.r * W;
          const on = i === active;
          return (
            <motion.g
              key={stars[i].name + i}
              role="button"
              tabIndex={0}
              aria-label={`${stars[i].name}: ${plural(stars[i].closedCount, "closed issue")}`}
              aria-pressed={on}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setActive(i))}
              className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-white"
              style={{ transformOrigin: `${s.x * W}px ${s.y * H}px` }}
              initial={reduce ? false : { opacity: 0, scale: 0.2 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduce ? 0 : 0.3 + i * 0.07, type: "spring", stiffness: 160, damping: 14 }}
            >
              <circle cx={s.x * W} cy={s.y * H} r={r * 2.4} fill="url(#cn-g)" fillOpacity={on ? 0.55 : 0.28} stroke="transparent" strokeWidth={2} />
              <circle cx={s.x * W} cy={s.y * H} r={r} fill="url(#cn-g)" />
              <circle cx={s.x * W} cy={s.y * H} r={r * 0.32} fill="#fff" />
            </motion.g>
          );
        })}
      </svg>
      <p className="mt-1 flex items-baseline justify-between gap-3 text-sm" aria-live="polite">
        <span className="min-w-0 truncate font-medium">{cur.name}</span>
        <span className="shrink-0 tabular-nums text-white/70">{plural(cur.closedCount, "issue")}</span>
      </p>
      <ol className="mt-2 grid grid-cols-1 gap-x-6 text-xs text-white/55 sm:grid-cols-2">
        {stars.map((s, i) => (
          <li key={s.name + i} className="flex justify-between gap-3 border-b border-white/10 py-1">
            <span className="min-w-0 truncate">{s.name}</span>
            <span className="tabular-nums">{s.closedCount.toLocaleString("en-US")}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Analog clock face for a local HH:MM. Decorative: the time is always printed beside it. */
export function ClockFace({ time }: { time: string }) {
  const [h, m] = time.split(":").map(Number);
  const hourAngle = ((h % 12) + m / 60) * 30;
  const minAngle = m * 6;
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="h-24 w-24 shrink-0 drop-shadow-[0_0_14px_var(--a1)]">
      <circle cx={50} cy={50} r={46} fill="none" stroke="#fff" strokeOpacity={0.25} strokeWidth={1.5} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={50} y1={7} x2={50} y2={i % 3 === 0 ? 15 : 11} stroke="#fff" strokeOpacity={i % 3 === 0 ? 0.7 : 0.35} strokeWidth={1.5} transform={`rotate(${i * 30} 50 50)`} />
      ))}
      <line x1={50} y1={50} x2={50} y2={28} stroke="#fff" strokeWidth={3} strokeLinecap="round" transform={`rotate(${hourAngle} 50 50)`} />
      <line x1={50} y1={50} x2={50} y2={14} stroke="var(--a2)" strokeWidth={2} strokeLinecap="round" transform={`rotate(${minAngle} 50 50)`} />
      <circle cx={50} cy={50} r={3} fill="#fff" />
    </svg>
  );
}

/** The year as a track with a finish marker where the last issue closed. */
export function FinishLine({ year, date, label }: { year: number; date: string; label: string }) {
  const reduce = useReducedMotion();
  const f = frac(date, year) * 100;
  return (
    <div className="w-full max-w-md">
      <div role="img" aria-label={label} className="relative h-10">
        <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <YearAxis year={year} y={5} />
        </svg>
        <motion.div aria-hidden className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-[var(--a2)] to-[var(--a1)] shadow-[0_0_16px_var(--a1)]" initial={{ width: 0 }} animate={{ width: `${f}%` }} transition={{ duration: reduce ? 0 : 1.4, ease: EASE, delay: 0.4 }} />
        <motion.span aria-hidden className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_22px_var(--a1)]" initial={{ left: 0 }} animate={{ left: `${f}%` }} transition={{ duration: reduce ? 0 : 1.4, ease: EASE, delay: 0.4 }} />
      </div>
      <p aria-hidden className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-white/40">
        <span>Jan 1</span>
        <span>Dec 31</span>
      </p>
    </div>
  );
}
