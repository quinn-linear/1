/**
 * Three small moths that flutter around the lamp's light all the time. Each has its own
 * home orbit near the lamp, wander speeds, wing-beat rate and phase, depth (size and
 * brightness), so they never move together. Pure maths over a random source and a time in
 * seconds (the canvas only draws what `mothAt` says), so the bounds and independence are
 * tested. Coordinates are 0-1 inside the beam's box, like the dust motes.
 */
import type { Point } from "./dust.ts";

export interface Moth {
  /** The point it circles: near the lamp's mouth, a little different for each moth. */
  cx: number;
  cy: number;
  /** Wander radii (box units), slow sway speeds (rad/s) and phases per axis. */
  rx: number;
  ry: number;
  fx: number;
  fy: number;
  px: number;
  py: number;
  /** Speed of the slow breathing of the radius, and its phase. */
  fr: number;
  pr: number;
  /** Wing beats per second and a phase. */
  beat: number;
  pb: number;
  /** 0 (far) to 1 (near): nearer moths are bigger and brighter. */
  depth: number;
}

export interface MothFrame {
  x: number;
  y: number;
  /** Heading in radians (0 = right). */
  angle: number;
  /** Wing spread, 0 (closed) to 1 (open). */
  open: number;
  /** Overall opacity. */
  a: number;
  /** Size multiplier from depth. */
  size: number;
}

export const MOTH_COUNT = 3;
/** The moths stay this far inside the box edge. */
export const EDGE = 0.04;
/** Wingspan in CSS px at the base size (scaled up with the picture, like the dust). */
export const SPAN = 7;
/** The lamp's mouth in the beam's box: what they flutter around. */
export const LIGHT: Point = [0.34, 0.12];

export type Random = () => number;

export function makeMoths(rnd: Random, count = MOTH_COUNT): Moth[] {
  const between = (a: number, b: number) => a + rnd() * (b - a);
  return Array.from({ length: count }, (_, i) => ({
    // Each moth gets its own third of the circle around the light so they start apart.
    ...(() => {
      const a = ((i + rnd() * 0.6) / count) * Math.PI * 2;
      const r = between(0.04, 0.12);
      return { cx: LIGHT[0] + Math.cos(a) * r, cy: LIGHT[1] + 0.14 + Math.sin(a) * r * 0.6 };
    })(),
    rx: between(0.08, 0.14),
    ry: between(0.06, 0.11),
    fx: between(0.7, 1.7),
    fy: between(0.8, 2.0),
    px: between(0, Math.PI * 2),
    py: between(0, Math.PI * 2),
    fr: between(0.1, 0.3),
    pr: between(0, Math.PI * 2),
    beat: between(5, 7.5),
    pb: between(0, Math.PI * 2),
    depth: between(0, 1),
  }));
}

const clamp = (v: number) => Math.min(1 - EDGE, Math.max(EDGE, v));

/** Where the moth is at `t` seconds: two unequal sines per axis around its home, with a slowly breathing radius, so the loops never repeat exactly. */
function path(m: Moth, t: number): Point {
  const breathe = 0.7 + 0.3 * Math.sin(t * m.fr + m.pr);
  const wx = Math.sin(t * m.fx + m.px) + 0.5 * Math.sin(t * m.fx * 2.3 + m.py);
  const wy = Math.sin(t * m.fy + m.py) + 0.5 * Math.cos(t * m.fy * 1.9 + m.px);
  return [clamp(m.cx + (m.rx * breathe * wx) / 1.5), clamp(m.cy + (m.ry * breathe * wy) / 1.5)];
}

export function mothAt(m: Moth, t: number): MothFrame {
  const [x, y] = path(m, t);
  const [x2, y2] = path(m, t + 0.05);
  // Short glides now and then: the beat slows and the wings stay mostly open.
  const glide = 0.5 + 0.5 * Math.sin(t * 0.7 + m.pb);
  const beat = Math.abs(Math.cos(Math.PI * m.beat * (1 - 0.6 * glide * glide) * t + m.pb));
  return {
    x,
    y,
    angle: Math.atan2(y2 - y, x2 - x),
    open: 0.25 + 0.75 * (glide > 0.8 ? 0.6 + 0.4 * beat : beat),
    a: 0.6 + 0.3 * m.depth,
    size: 0.8 + 0.5 * m.depth,
  };
}
