import { createElement as h, type CSSProperties, type ReactElement } from "react";
import { monthName } from "../recap.ts";
import { ARCHETYPE_COPY } from "../stats/archetype.ts";
import type { ArchetypeId } from "../stats/types.ts";
import { daysInYear } from "./art.ts";
import { ADVANCE, blockSize, columnsFor, dotMatrix, wrapLines } from "./dotMatrix.ts";

/**
 * The year-end report as a dot-matrix print-out on tractor-feed paper: cream
 * paper, black ink, perforated edges with feed holes, torn top and bottom,
 * dotted rules, dot-matrix type, the archetype's halftone badge and three
 * large stats. One layout, defined here in "paper units" (the sheet is 1000
 * wide and 1250 tall), is used twice: the web report scales units with
 * container width (`1 unit = 0.1cqw`), the share images with pixels, so the two
 * can't drift apart. Everything is placed at fixed positions, so a long name or a
 * big number can wrap or shrink inside its own box and never collide with another.
 *
 * The viewer's name is only ever drawn on the web report (their own screen).
 * `buildPrintout` takes it as an option the public renderers never pass.
 */
export const PAPER = { w: 1000, h: 1250 } as const;
export const INK = "#1c1a14";
export const PAPER_TOP = "#f1e7cf";
export const PAPER_BOTTOM = "#e6d9ba";
/** What shows through the feed holes and the torn edges. */
export const BACKDROP = "#14120e";

export const LAYOUT = {
  /** Feed strips and the perforation lines between them and the page. */
  holeX: [36, 964],
  holeR: 15,
  holeStep: 60,
  holeFirst: 70,
  perfX: [72, 928],
  content: { x: 118, w: 764 },
  header: { y: 96 },
  ruleY: [196, 806, 1096] as const,
  name: { y: 218, fs: 34 },
  badge: { x: 118, y: 300, d: 340 },
  text: { x: 490, w: 392 },
  label: { y: 296, fs: 30 },
  archName: { y: 346, chars: 7 },
  desc: { y: 520, h: 266, fs: 31 },
  stats: { y: 836, h: 230, labelFs: 27, valueY: 90, valueMaxPitch: 13, subY: 196, subFs: 30, pad: 22 },
  footer: { y: 1124, fs: 30, small: 24 },
} as const;

const COLS = 3;
export const colW = LAYOUT.content.w / COLS;
export const colX = (i: number) => LAYOUT.content.x + i * colW;

export interface PrintoutData {
  year: number;
  archetype: ArchetypeId;
  closed: number;
  activeDays: number;
  /** Longest streak in days, or 0 for none. */
  streak: number;
  /** Peak month (1-12), shown under the streak only when there is no streak. */
  peakMonth: number | null;
  /** Counts may be undercounts (the fetch cap was hit). */
  undercount: boolean;
}

export interface Stat {
  label: string;
  value: string;
  sub: string;
}

export function printoutStats(d: PrintoutData): Stat[] {
  return [
    { label: "CLOSED", value: d.closed.toLocaleString("en-US"), sub: "" },
    { label: "ACTIVE DAYS", value: String(d.activeDays), sub: `of ${daysInYear(d.year)}` },
    { label: "STREAK", value: d.streak ? String(d.streak) : "-", sub: d.streak ? (d.streak === 1 ? "day" : "days") : d.peakMonth ? `Peak ${monthName(d.peakMonth, true)}` : "" },
  ];
}

export const headerText = (year: number) => `LINEAR WRAPPED ${year}`;
export const archetypeLines = (id: ArchetypeId) => wrapLines(ARCHETYPE_COPY[id].name, LAYOUT.archName.chars);

/** Dot pitch (paper units) for a stat value: big when short, shrinking so a long number stays inside its column. */
export function valuePitch(value: string): number {
  const cols = columnsFor([...value].length);
  return Math.min(LAYOUT.stats.valueMaxPitch, (colW - 2 * LAYOUT.stats.pad) / cols);
}

/** Dot pitch of the header: the title spans the whole content width. */
export const headerPitch = (year: number) => LAYOUT.content.w / columnsFor([...headerText(year)].length);
/** Dot pitch of the archetype name: the widest allowed word spans the text column. */
export const namePitch = () => LAYOUT.text.w / columnsFor(LAYOUT.archName.chars);

/** Torn paper edge as points across the sheet (x in units, y depth in units), deterministic. */
export function tornEdge(seed: number, steps = 46, depth = 9): [number, number][] {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: steps + 1 }, (_, i) => [(i / steps) * PAPER.w, 2 + rnd() * depth] as [number, number]);
}

/** CSS `clip-path` polygon (percent) for the torn sheet. */
export function tornClipPath(): string {
  const top = tornEdge(7);
  const bottom = tornEdge(19)
    .map(([x, y]) => [x, PAPER.h - y] as [number, number])
    .reverse();
  return `polygon(${[...top, ...bottom].map(([x, y]) => `${((x / PAPER.w) * 100).toFixed(2)}% ${((y / PAPER.h) * 100).toFixed(2)}%`).join(", ")})`;
}

/** The same torn edges as an SVG path for the area OUTSIDE the paper (drawn in the backdrop colour in share images). */
export function tornMaskPath(): string {
  const top = tornEdge(7);
  const bottom = tornEdge(19);
  const topPath = `M0 0 H${PAPER.w} V${top[top.length - 1][1]} ${[...top].reverse().map(([x, y]) => `L${x} ${y}`).join(" ")} Z`;
  const botPath = `M0 ${PAPER.h} H${PAPER.w} V${PAPER.h - bottom[bottom.length - 1][1]} ${[...bottom].reverse().map(([x, y]) => `L${x} ${PAPER.h - y}`).join(" ")} Z`;
  return `${topPath} ${botPath}`;
}

/** Feed-hole centres (y), both sides. */
export const holeYs = (): number[] => {
  const ys: number[] = [];
  for (let y = LAYOUT.holeFirst; y < PAPER.h - 40; y += LAYOUT.holeStep) ys.push(y);
  return ys;
};

/** A row (or column) of round dots as an SVG path in a `length` x 6 box: the dotted rules and perforation lines. */
export function dotRule(length: number, color = INK, vertical = false, opacity = 0.75): ReactElement {
  const step = 9;
  const n = Math.max(1, Math.floor(length / step));
  const d = Array.from({ length: n }, (_, i) => {
    const c = i * step + step / 2;
    const [cx, cy] = vertical ? [3, c] : [c, 3];
    return `M${cx - 1.6} ${cy}a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0`;
  }).join("");
  return h(
    "svg",
    { viewBox: vertical ? `0 0 6 ${n * step}` : `0 0 ${n * step} 6`, width: "100%", height: "100%", preserveAspectRatio: "none", xmlns: "http://www.w3.org/2000/svg", style: { display: "block" } },
    h("path", { d, fill: color, fillOpacity: opacity }),
  );
}

// ---------------------------------------------------------------------------------------
// Share-image rendering (pixels, Satori-safe: flex only, absolutely placed boxes).
// ---------------------------------------------------------------------------------------

const abs = (style: CSSProperties, ...children: (ReactElement | string | null)[]) => h("div", { style: { display: "flex", position: "absolute", ...style } }, ...children);

export interface PrintoutOptions {
  /** Archetype badge as a data URI; without it the badge circle is left as a plain ringed disc. */
  art: string | null;
  /** The viewer's name. Web report only: public images never pass it. */
  name?: string | null;
}

/** The print-out sheet at `w` px wide (height is `w * 1.25`). */
export function buildPrintout(d: PrintoutData, w: number, { art, name = null }: PrintoutOptions): ReactElement {
  const u = w / PAPER.w;
  const px = (n: number) => Math.round(n * u * 100) / 100;
  const L = LAYOUT;
  const copy = ARCHETYPE_COPY[d.archetype];
  const text = (style: CSSProperties, value: string) => abs({ color: INK, lineHeight: 1.1, whiteSpace: "pre-wrap", ...style }, value);
  const stats = printoutStats(d);

  const holes = holeYs().flatMap((y) =>
    L.holeX.map((x) => abs({ left: px(x - L.holeR), top: px(y - L.holeR), width: px(L.holeR * 2), height: px(L.holeR * 2), borderRadius: 999, backgroundColor: BACKDROP, boxShadow: `inset 0 ${px(3)}px ${px(4)}px rgba(0,0,0,0.6)` })),
  );
  const perf = L.perfX.map((x) => abs({ left: px(x - 3), top: px(30), width: px(6), height: px(PAPER.h - 60) }, dotRule(PAPER.h - 60, INK, true, 0.35)));
  const rule = (y: number) => abs({ left: px(L.content.x), top: px(y), width: px(L.content.w), height: px(6) }, dotRule(L.content.w));
  const vrule = (x: number) => abs({ left: px(x - 3), top: px(L.stats.y), width: px(6), height: px(L.stats.h) }, dotRule(L.stats.h, INK, true, 0.6));

  const headerCols = columnsFor([...headerText(d.year)].length);
  const nameLines = archetypeLines(d.archetype);
  const nameSize = blockSize(nameLines);
  const np = namePitch();

  return h(
    "div",
    { style: { display: "flex", position: "relative", width: w, height: px(PAPER.h), backgroundColor: PAPER_BOTTOM, backgroundImage: `linear-gradient(180deg, ${PAPER_TOP}, ${PAPER_BOTTOM})`, overflow: "hidden" } },
    ...holes,
    ...perf,
    // Header, dot matrix across the whole width
    abs({ left: px(L.content.x), top: px(L.header.y), width: px(L.content.w), height: px((L.content.w / headerCols) * 7) }, dotMatrix([headerText(d.year)], INK, px(L.content.w / headerCols))),
    rule(L.ruleY[0]),
    name ? text({ left: px(L.content.x), top: px(L.name.y), width: px(L.content.w), height: px(L.name.fs * 1.3), fontSize: px(L.name.fs), letterSpacing: px(3), overflow: "hidden" }, `NAME: ${name.toUpperCase()}`) : null,
    // Badge
    abs(
      { left: px(L.badge.x), top: px(L.badge.y), width: px(L.badge.d), height: px(L.badge.d), borderRadius: 999, overflow: "hidden", backgroundColor: art ? "transparent" : "#3a362b", border: art ? "none" : `${px(5)}px solid ${INK}` },
      art ? h("img", { src: art, width: px(L.badge.d), height: px(L.badge.d), style: { objectFit: "contain" } }) : null,
    ),
    // Archetype
    text({ left: px(L.text.x), top: px(L.label.y), fontSize: px(L.label.fs), letterSpacing: px(4), opacity: 0.8 }, "YOUR ARCHETYPE"),
    abs({ left: px(L.text.x), top: px(L.archName.y), width: px(nameSize.cols * np), height: px(nameSize.rows * np) }, dotMatrix(nameLines, INK, px(np))),
    text({ left: px(L.text.x), top: px(L.desc.y), width: px(L.text.w), height: px(L.desc.h), fontSize: px(L.desc.fs), lineHeight: 1.3, overflow: "hidden" }, copy.description),
    rule(L.ruleY[1]),
    // Stats
    vrule(colX(1)),
    vrule(colX(2)),
    ...stats.flatMap((s, i) => {
      const vp = valuePitch(s.value);
      const cols = columnsFor([...s.value].length);
      const cx = colX(i);
      return [
        text({ left: px(cx), top: px(L.stats.y), width: px(colW), justifyContent: "center", fontSize: px(L.stats.labelFs), letterSpacing: px(2) }, s.label),
        abs({ left: px(cx + (colW - cols * vp) / 2), top: px(L.stats.y + L.stats.valueY), width: px(cols * vp), height: px(7 * vp) }, dotMatrix([s.value], INK, px(vp))),
        text({ left: px(cx), top: px(L.stats.y + L.stats.subY), width: px(colW), justifyContent: "center", fontSize: px(L.stats.subFs), opacity: 0.8 }, s.sub),
      ];
    }),
    rule(L.ruleY[2]),
    // Footer
    text({ left: px(L.content.x), top: px(L.footer.y), fontSize: px(L.footer.fs), letterSpacing: px(3) }, "END OF YEAR REPORT"),
    text({ left: px(L.content.x), top: px(L.footer.y + L.footer.fs * 1.35), fontSize: px(L.footer.small), letterSpacing: px(2), opacity: 0.7 }, `LINEAR WRAPPED ${d.year}`),
    d.undercount ? text({ left: px(L.content.x + L.content.w / 2), top: px(L.footer.y), width: px(L.content.w / 2), justifyContent: "flex-end", textAlign: "right", fontSize: px(L.footer.small), opacity: 0.8 }, "COUNTS MAY BE UNDERCOUNTS") : null,
    // A faint fold across the sheet, as on the reference
    abs({ left: 0, top: px(PAPER.h * 0.37), width: w, height: px(40), backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0), rgba(60,40,10,0.07), rgba(0,0,0,0))" }),
    // Torn top and bottom: the backdrop shows through
    abs({ left: 0, top: 0, width: w, height: px(PAPER.h) }, h("svg", { viewBox: `0 0 ${PAPER.w} ${PAPER.h}`, width: w, height: px(PAPER.h), xmlns: "http://www.w3.org/2000/svg" }, h("path", { d: tornMaskPath(), fill: BACKDROP }))),
  );
}

export { ADVANCE };
