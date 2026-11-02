/**
 * Steam curling up from the coffee cup. A few soft puffs per wisp, each on a repeating life
 * (born on the rim's opening, rising, swaying, widening, fading to nothing), staggered so the
 * loop never shows a seam. Everything is in 0-1 coordinates of the steam box on the picture
 * (`PET_STEAM`), so it is pure and the geometry is tested.
 */
import { PET_STEAM, STEAM_RIM } from "./art.ts";
import { mapRect, type Placement } from "./cover.ts";

export interface Puff {
  /** Where on the rim it is born, -1..1 across the opening. */
  lane: number;
  /** Seconds for one life. */
  period: number;
  /** Start of the life, 0..1, so puffs are staggered. */
  phase: number;
  /** Sway: amplitude (box fractions of width) and angular speed. */
  sway: number;
  speed: number;
  swayPhase: number;
  /** Radius at birth, in picture px. */
  r: number;
}

export interface PuffFrame {
  x: number;
  y: number;
  /** Radius in picture px (the canvas scales it with the picture). */
  r: number;
  a: number;
}

export const WISP_COUNT = 3;
export const PUFFS_PER_WISP = 6;
export const MAX_ALPHA = 0.2;
/** How far the opening's ellipse a puff may be born from its centre (fraction of the radii). */
const LANE_REACH = 0.6;

/** Deterministic: the same wisps on the server and every render. */
export function makePuffs(): Puff[] {
  const out: Puff[] = [];
  for (let w = 0; w < WISP_COUNT; w++) {
    const period = 7 + w * 1.3;
    const lane = (w - (WISP_COUNT - 1) / 2) * 0.55;
    for (let i = 0; i < PUFFS_PER_WISP; i++) {
      out.push({ lane, period, phase: (i / PUFFS_PER_WISP + w * 0.21) % 1, sway: 0.05 + 0.015 * w, speed: 1.1 + 0.25 * w, swayPhase: w * 2.1, r: 6 + w });
    }
  }
  return out;
}

const smooth = (x: number) => x * x * (3 - 2 * x);

/** The puff at time `t` seconds. Alpha is 0 at birth and death, so the wrap-around is invisible. */
export function puffAt(p: Puff, t: number): PuffFrame {
  const u = (((t / p.period + p.phase) % 1) + 1) % 1;
  // Fade in over the first fifth of the life, out over the rest; thinner as it climbs.
  const a = MAX_ALPHA * smooth(Math.min(1, u / 0.2)) * (1 - smooth(Math.max(0, (u - 0.2) / 0.8))) ** 1.3;
  const rise = 1 - (1 - u) ** 1.6; // quick off the rim, slowing as it thins
  const lane = Math.max(-1, Math.min(1, p.lane * LANE_REACH));
  const x = STEAM_RIM.x + lane * STEAM_RIM.rx * 0.6 + Math.sin(u * Math.PI * 2 * p.speed + p.swayPhase) * p.sway * u;
  const y = STEAM_RIM.y - STEAM_RIM.ry * 0.4 - rise * (STEAM_RIM.y - 0.04);
  return { x, y, r: p.r * (1 + 2.4 * u), a };
}

/** One faint, still frame of the wisps for reduced motion: a single column hanging above the rim. */
export function staticPuffs(): PuffFrame[] {
  return [0.18, 0.4, 0.62].map((u) => {
    const f = puffAt({ lane: 0, period: 1, phase: u, sway: 0.05, speed: 1.1, swayPhase: 0, r: 7 }, 0);
    return { ...f, a: f.a * 0.5 };
  });
}

/** Whether the cup's rim (and a little room above it for the first wisps) is inside the viewport, so no steam is drawn over a crop that has lost the cup. */
export function rimVisible(p: Placement, view: { width: number; height: number }, room = 24): boolean {
  const rim = mapRect(p, { x: PET_STEAM.x + STEAM_RIM.x * PET_STEAM.w, y: PET_STEAM.y + STEAM_RIM.y * PET_STEAM.h, w: 0, h: 0 });
  return rim.left >= 0 && rim.left <= view.width && rim.top >= room && rim.top <= view.height;
}
