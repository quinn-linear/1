/**
 * A single small moth that now and then wanders into the lamp's beam, flutters about for
 * a few seconds and fades back into the dark, with long quiet gaps between visits. Pure
 * maths over a random source and a time in seconds (the canvas only draws what `mothAt`
 * says), so the schedule, bounds and fades are tested. Coordinates are 0-1 inside the
 * beam's box, like the dust motes.
 */
import { pointInPolygon, type Point } from "./dust.ts";

export interface Visit {
  /** Where it comes in, where it leaves, and the point it circles between (all inside the beam). */
  from: Point;
  to: Point;
  /** Seconds the visit lasts. */
  duration: number;
  /** Wander amplitude (box units), slow sway speeds (rad/s) and phases per axis. */
  amp: number;
  fx: number;
  fy: number;
  px: number;
  py: number;
  /** Wing beats per second and a phase. */
  beat: number;
  pb: number;
}

export interface MothFrame {
  x: number;
  y: number;
  /** Heading in radians (0 = right). */
  angle: number;
  /** Wing spread, 0 (closed) to 1 (open). */
  open: number;
  /** Overall opacity, 0 at both ends of the visit. */
  a: number;
}

/** Quiet time between visits, in seconds: long enough to be a small surprise, never a loop. */
export const GAP_MIN = 25;
export const GAP_MAX = 60;
/** How long a visit lasts. */
export const VISIT_MIN = 8;
export const VISIT_MAX = 14;
/** The moth stays this far inside the box edge. */
export const EDGE = 0.04;
/** Its wingspan in CSS px at the base size (scaled up with the picture, like the dust). */
export const SPAN = 7;

export type Random = () => number;

/** A pick inside the beam, away from its edges, found by rejection (the polygon is non-convex enough to need it). */
function inside(poly: readonly Point[], rnd: Random): Point {
  for (let i = 0; i < 200; i++) {
    const x = EDGE + rnd() * (1 - 2 * EDGE);
    const y = EDGE + rnd() * (1 - 2 * EDGE);
    if (pointInPolygon(x, y, poly)) return [x, y];
  }
  const [x, y] = poly[0];
  return [x, y];
}

export function nextGap(rnd: Random): number {
  return GAP_MIN + rnd() * (GAP_MAX - GAP_MIN);
}

export function makeVisit(poly: readonly Point[], rnd: Random): Visit {
  const between = (a: number, b: number) => a + rnd() * (b - a);
  return {
    from: inside(poly, rnd),
    to: inside(poly, rnd),
    duration: between(VISIT_MIN, VISIT_MAX),
    amp: between(0.05, 0.1),
    fx: between(0.9, 1.5),
    fy: between(1.1, 1.9),
    px: between(0, Math.PI * 2),
    py: between(0, Math.PI * 2),
    beat: between(5, 7),
    pb: between(0, Math.PI * 2),
  };
}

const clamp = (v: number) => Math.min(1 - EDGE, Math.max(EDGE, v));
const smooth = (p: number) => p * p * (3 - 2 * p);

/** Where the path is at `t` seconds into the visit, before the clamp (a drift from `from` to `to` with an irregular sway on top). */
function path(v: Visit, t: number): Point {
  const p = Math.min(1, Math.max(0, t / v.duration));
  const e = smooth(p);
  // Two unequal sines per axis so the loops never repeat exactly.
  const wx = Math.sin(t * v.fx + v.px) + 0.5 * Math.sin(t * v.fx * 2.3 + v.py);
  const wy = Math.sin(t * v.fy + v.py) + 0.5 * Math.cos(t * v.fy * 1.9 + v.px);
  return [clamp(v.from[0] + (v.to[0] - v.from[0]) * e + (v.amp * wx) / 1.5), clamp(v.from[1] + (v.to[1] - v.from[1]) * e + (v.amp * wy) / 1.5)];
}

/** The moth `t` seconds into a visit, or null once it is over (or before it begins). */
export function mothAt(v: Visit, t: number): MothFrame | null {
  if (t < 0 || t > v.duration) return null;
  const [x, y] = path(v, t);
  const [x2, y2] = path(v, t + 0.05);
  // Fade in and out over the first and last 1.5 s so it neither pops in nor out.
  const fade = Math.min(1, t / 1.5, (v.duration - t) / 1.5);
  // Short glides now and then: the beat slows and the wings stay mostly open.
  const glide = 0.5 + 0.5 * Math.sin(t * 0.7 + v.pb);
  const beat = Math.abs(Math.cos(Math.PI * v.beat * (1 - 0.6 * glide * glide) * t + v.pb));
  return {
    x,
    y,
    angle: Math.atan2(y2 - y, x2 - x),
    open: 0.25 + 0.75 * (glide > 0.8 ? 0.6 + 0.4 * beat : beat),
    a: 0.9 * smooth(Math.max(0, fade)),
  };
}
