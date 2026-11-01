/**
 * The boot screen's artwork: the Linear mark drawn as geometry, not as text
 * characters, so the circle keeps its true shape and aspect ratio at any size.
 *
 * Measured from the reference render: a circle cut into 17 thin horizontal
 * scanline bands, with three parallel 45-degree cuts running down and to the
 * right through its lower-left. Everything is in units of the circle radius
 * (centre 0,0; y grows downward) and mapped into a square `LOGO_VIEWBOX`, so
 * the SVG is as wide as it is tall. Each band is its own row, so the boot can
 * reveal the mark one scanline at a time.
 */
export const LOGO_VIEWBOX = 100;
const CENTER = LOGO_VIEWBOX / 2;
/** Circle radius in viewBox units (a little inside the box so the edge is never clipped). */
export const LOGO_RADIUS = 48;

export const LOGO_BANDS = 17;
/** Share of each band's pitch that is lit; the rest is the dark gap between scanlines. */
const BAND_DUTY = 0.48;

/**
 * The diagonal pieces, as ranges of u = x - y (in radii). Cuts run along x - y = const, i.e. down and to the right.
 * The main body is everything right of its edge; the three strips left of it are separated by gaps of the same width as the strips.
 */
const DIAGONAL_PIECES: readonly (readonly [number, number])[] = [
  [-0.136, 4],
  [-0.568, -0.364],
  [-1.0, -0.795],
  [-1.43, -1.227],
];

export interface LogoRow {
  /** Polygons (SVG `points`) lit in this scanline band, already in viewBox units. Clipped to the circle by `LOGO_CLIP`. */
  polygons: string[];
  /** Top and bottom of the band, in viewBox units. */
  top: number;
  bottom: number;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** One entry per scanline band, top to bottom. Parallelograms where a diagonal piece crosses the band. */
export function logoRows(): LogoRow[] {
  const pitch = (2 * LOGO_RADIUS) / (LOGO_BANDS - 1);
  const lit = pitch * BAND_DUTY;
  return Array.from({ length: LOGO_BANDS }, (_, i) => {
    // Band centres run from the circle's top to its bottom, so the first and last are slivers the clip trims.
    const mid = CENTER - LOGO_RADIUS + i * pitch;
    const top = mid - lit / 2;
    const bottom = mid + lit / 2;
    const polygons = DIAGONAL_PIECES.map(([u0, u1]) => {
      const a = u0 * LOGO_RADIUS;
      const b = u1 * LOGO_RADIUS;
      // x = CENTER + u + (y - CENTER): the left and right edges lean at 45 degrees.
      const x = (u: number, y: number) => CENTER + u + (y - CENTER);
      return [[x(a, top), top], [x(b, top), top], [x(b, bottom), bottom], [x(a, bottom), bottom]].map(([px, py]) => `${fmt(px)},${fmt(py)}`).join(" ");
    });
    return { polygons, top, bottom };
  });
}

/** Whether a point (viewBox units) is inside the circle. */
export const insideLogo = (x: number, y: number) => (x - CENTER) ** 2 + (y - CENTER) ** 2 <= LOGO_RADIUS ** 2;

/** Spoken name of the idle screen; the art itself is hidden from assistive tech and shows no text. */
export const BOOT_LABEL = "Linear wrapped";

const BASE_MS = 120;

const LOGO_STEP_MS = 40;

/** Delay in ms before each scanline band of the mark appears: a fast top-to-bottom sweep, 17 bands in well under a second. */
export function logoSchedule(instant: boolean): number[] {
  return Array.from({ length: LOGO_BANDS }, (_, i) => (instant ? 0 : BASE_MS + i * LOGO_STEP_MS));
}
