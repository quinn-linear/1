/**
 * Dust motes in the lamp's beam: a sprinkling of tiny warm specks that drift and swirl gently,
 * each fading in and out over its own long cycle. Pure maths (positions come from a
 * seeded generator and a time in seconds) so the behaviour is tested; the canvas only
 * draws what `moteAt` says. Coordinates are 0-1 inside the beam's box.
 */
export type Point = readonly [number, number];

export interface Mote {
  /** Start point, inside the beam. */
  x: number;
  y: number;
  /** Drift per cycle, in box units: a short, mostly sideways-and-up path. */
  dx: number;
  dy: number;
  /** Sway amplitude and speed (radians/s) on each axis, and starting phases. */
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  px: number;
  py: number;
  /** Cycle length in s and where in the cycle it starts (0-1). */
  period: number;
  start: number;
  /** 0 (far) to 1 (near): nearer motes are slightly bigger, brighter and drift faster. */
  depth: number;
}

export const MOTE_COUNT = 34;
/** The faintest and brightest a mote ever gets: never opaque, never glitter. */
export const MAX_ALPHA = 0.72;
/** Radius in CSS px for the farthest and nearest mote. */
export const MIN_RADIUS = 1;
export const MAX_RADIUS = 2.4;

export function pointInPolygon(x: number, y: number, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Deterministic: the same seed always gives the same specks (no layout jump between renders). */
export function makeMotes(poly: readonly Point[], count = MOTE_COUNT, seed = 7): Mote[] {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const motes: Mote[] = [];
  for (let guard = 0; motes.length < count && guard < 2000; guard++) {
    const x = rnd();
    const y = rnd();
    if (!pointInPolygon(x, y, poly)) continue;
    const depth = rnd();
    motes.push({
      x,
      y,
      dx: between(-0.1, 0.16) * (0.5 + depth),
      dy: between(-0.22, -0.05) * (0.5 + depth),
      ax: between(0.02, 0.05),
      ay: between(0.015, 0.04),
      fx: between(0.25, 0.6),
      fy: between(0.2, 0.5),
      px: between(0, Math.PI * 2),
      py: between(0, Math.PI * 2),
      period: between(28, 55),
      start: rnd(),
      depth,
    });
  }
  return motes;
}

export interface Frame {
  x: number;
  y: number;
  r: number;
  a: number;
}

/** A mote at time `t` seconds. Each fades in and out smoothly over its cycle, so nothing pops when it restarts. */
export function moteAt(m: Mote, t: number): Frame {
  const phase = (((t / m.period + m.start) % 1) + 1) % 1;
  // Mostly at full strength through the middle of the cycle, easing in and out at the ends (a pure sine would leave it dim most of the time).
  const fade = Math.min(1, Math.sin(Math.PI * phase) * 1.8);
  // A slow, uneven shimmer (about 8 to 20 s) rides on top, never more than a third of the brightness.
  const shimmer = 0.8 + 0.2 * Math.sin(t * (0.3 + m.depth * 0.2) + m.px);
  return {
    x: m.x + m.dx * (phase - 0.5) + Math.sin(t * m.fx + m.px) * m.ax,
    y: m.y + m.dy * (phase - 0.5) + Math.cos(t * m.fy + m.py) * m.ay,
    r: MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * m.depth,
    a: MAX_ALPHA * (0.35 + 0.65 * m.depth) * fade * shimmer,
  };
}

/** A calm still frame for reduced motion: every mote at mid-cycle, dimmer. */
export function staticFrame(m: Mote): Frame {
  const f = moteAt({ ...m, start: 0.5 }, 0);
  return { ...f, x: m.x, y: m.y, a: f.a * 0.5 };
}
