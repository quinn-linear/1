import { createElement as h, type ReactElement } from "react";
import type { ArchetypeId } from "../stats/types.ts";

/**
 * Decorative SVG art shared by the web card and the share images. Plain
 * `createElement` (no hooks, no JSX) so Satori can render it too. These are
 * generative shapes, not data: nothing here claims a number.
 */

/** Polygon sides per archetype: each one gets its own recognizable sigil. */
const SIDES: Record<ArchetypeId, number> = {
  "night-owl": 6,
  "early-bird": 5,
  "friday-shipper": 4,
  "weekend-warrior": 7,
  "steady-builder": 8,
};

const LAYERS = 6;

const pt = (cx: number, cy: number, r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;

export function polygonPoints(size: number, sides: number, radius: number, rotation: number): string {
  const c = size / 2;
  return Array.from({ length: sides }, (_, i) => pt(c, c, radius, rotation + (i / sides) * Math.PI * 2)).join(" ");
}

/** Nested, counter-rotated polygons with a bright core: a different silhouette per archetype. */
export function sigil(id: ArchetypeId, size: number, [a, b]: [string, string], uid = "sg"): ReactElement {
  const sides = SIDES[id];
  const c = size / 2;
  const outer = size * 0.46;
  return h(
    "svg",
    { width: size, height: size, viewBox: `0 0 ${size} ${size}`, xmlns: "http://www.w3.org/2000/svg" },
    h(
      "defs",
      null,
      h("linearGradient", { id: uid, x1: "0", y1: "0", x2: "1", y2: "1" }, h("stop", { offset: "0", stopColor: a }), h("stop", { offset: "1", stopColor: b })),
      h("radialGradient", { id: `${uid}-core` }, h("stop", { offset: "0", stopColor: "#fff", stopOpacity: 0.95 }), h("stop", { offset: "1", stopColor: a, stopOpacity: 0 })),
    ),
    h("circle", { cx: c, cy: c, r: outer, fill: "none", stroke: `url(#${uid})`, strokeOpacity: 0.35, strokeWidth: size * 0.004 }),
    ...Array.from({ length: LAYERS }, (_, i) => {
      const t = i / (LAYERS - 1);
      return h("polygon", {
        key: i,
        points: polygonPoints(size, sides, outer * (1 - t * 0.78), -Math.PI / 2 + t * (Math.PI / sides) * 1.5),
        fill: i === LAYERS - 1 ? `url(#${uid})` : "none",
        fillOpacity: 0.55,
        stroke: `url(#${uid})`,
        strokeWidth: size * (0.012 - t * 0.006),
        strokeLinejoin: "round",
        strokeOpacity: 0.95 - t * 0.35,
      });
    }),
    h("circle", { cx: c, cy: c, r: size * 0.1, fill: `url(#${uid}-core)` }),
  );
}

/** Static progress ring (0-1) with tick marks. The web version animates the same geometry. */
export function ring(size: number, value: number, [a, b]: [string, string], uid = "rg"): ReactElement {
  const c = size / 2;
  const stroke = size * 0.07;
  const r = c - stroke;
  const circ = 2 * Math.PI * r;
  const v = Math.min(Math.max(value, 0), 1);
  const ticks = 60;
  return h(
    "svg",
    { width: size, height: size, viewBox: `0 0 ${size} ${size}`, xmlns: "http://www.w3.org/2000/svg" },
    h("defs", null, h("linearGradient", { id: uid, x1: "0", y1: "0", x2: "1", y2: "1" }, h("stop", { offset: "0", stopColor: a }), h("stop", { offset: "1", stopColor: b }))),
    ...Array.from({ length: ticks }, (_, i) => {
      const ang = (i / ticks) * Math.PI * 2 - Math.PI / 2;
      const [x1, y1] = pt(c, c, r - stroke * 0.9, ang).split(",");
      const [x2, y2] = pt(c, c, r - stroke * (i % 5 === 0 ? 1.9 : 1.4), ang).split(",");
      return h("line", { key: i, x1, y1, x2, y2, stroke: "#fff", strokeOpacity: i % 5 === 0 ? 0.35 : 0.14, strokeWidth: size * 0.004 });
    }),
    h("circle", { cx: c, cy: c, r, fill: "none", stroke: "#fff", strokeOpacity: 0.09, strokeWidth: stroke }),
    h("circle", {
      cx: c,
      cy: c,
      r,
      fill: "none",
      stroke: `url(#${uid})`,
      strokeWidth: stroke,
      strokeLinecap: "round",
      strokeDasharray: `${circ * v} ${circ}`,
      transform: `rotate(-90 ${c} ${c})`,
    }),
  );
}

/** Active days as a share of the year; honest denominator including leap years. */
export const daysInYear = (year: number) => ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365);

/** Deterministic pseudo-random sparkle positions (so the static image is reproducible). */
export function sparkles(count: number, seed = 7): { x: number; y: number; s: number; o: number }[] {
  let n = seed;
  const rnd = () => ((n = (n * 1664525 + 1013904223) >>> 0) / 0xffffffff);
  return Array.from({ length: count }, () => ({ x: rnd(), y: rnd(), s: 0.4 + rnd() * 1.1, o: 0.35 + rnd() * 0.65 }));
}

export interface Star {
  /** Center as 0-1 fractions of the drawing box. */
  x: number;
  y: number;
  /** Radius as a fraction of the box width. Area-proportional to the count (sqrt scale). */
  r: number;
}

const STAR_MIN = 0.022;
const STAR_MAX = 0.075;

/**
 * Deterministic star layout from real counts, biggest first. Size is the only
 * encoded value: radius grows with the square root of the count, so area is
 * proportional to closed issues. Position follows a golden-angle spiral by rank
 * and carries no meaning. The web chart and the share image both use it.
 */
export function constellationLayout(values: number[]): Star[] {
  const max = Math.max(...values, 1);
  return values.map((v, i) => {
    const angle = i * 2.399963 + 0.6;
    const dist = i === 0 ? 0.04 : 0.17 + 0.27 * Math.sqrt(i / Math.max(values.length, 2));
    return {
      x: 0.5 + Math.cos(angle) * dist * 1.05,
      y: 0.5 + Math.sin(angle) * dist * 0.95,
      r: STAR_MIN + (STAR_MAX - STAR_MIN) * Math.sqrt(Math.max(v, 0) / max),
    };
  });
}

/** Each star links to its nearest bigger star: a simple, readable line figure. */
export function constellationLinks(stars: Star[]): [number, number][] {
  return stars.flatMap((s, i): [number, number][] => {
    if (i === 0) return [];
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < i; j++) {
      const d = (stars[j].x - s.x) ** 2 + (stars[j].y - s.y) ** 2;
      if (d < bestD) [best, bestD] = [j, d];
    }
    return [[best, i]];
  });
}

/** Static constellation for share images. `w` x `h` px; text-free, so it needs no fonts. */
export function constellation(values: number[], w: number, hgt: number, [a, b]: [string, string], uid = "cn"): ReactElement {
  const stars = constellationLayout(values);
  const px = (s: Star) => [s.x * w, s.y * hgt, s.r * w] as const;
  return h(
    "svg",
    { width: w, height: hgt, viewBox: `0 0 ${w} ${hgt}`, xmlns: "http://www.w3.org/2000/svg" },
    h(
      "defs",
      null,
      h("radialGradient", { id: uid }, h("stop", { offset: "0", stopColor: "#fff" }), h("stop", { offset: "0.45", stopColor: a }), h("stop", { offset: "1", stopColor: b, stopOpacity: 0 })),
    ),
    ...constellationLinks(stars).map(([i, j]) => {
      const [x1, y1] = px(stars[i]);
      const [x2, y2] = px(stars[j]);
      return h("line", { key: `l${i}-${j}`, x1, y1, x2, y2, stroke: "#fff", strokeOpacity: 0.28, strokeWidth: Math.max(1.5, w * 0.002) });
    }),
    ...stars.map((s, i) => {
      const [cx, cy, r] = px(s);
      return h(
        "g",
        { key: `s${i}` },
        h("circle", { cx, cy, r: r * 2.4, fill: `url(#${uid})`, fillOpacity: 0.35 }),
        h("circle", { cx, cy, r, fill: `url(#${uid})` }),
        h("circle", { cx, cy, r: r * 0.32, fill: "#fff" }),
      );
    }),
  );
}
