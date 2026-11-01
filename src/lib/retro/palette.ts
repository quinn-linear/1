/**
 * The one palette for the whole experience: the web UI reads these through CSS
 * variables in `globals.css`, the share images use them directly. Two phosphors
 * (green P1, amber P3) on a black tube, plus the cream plastic of the case.
 */
export const PALETTE = {
  screen: "#020703",
  phosphor: "#5dff8f",
  amber: "#ffb43a",
  /** Case plastic, light and shadowed. */
  case: "#d8cfb3",
  caseShade: "#b5aa8a",
  caseDeep: "#8d836a",
  ink: "#1c1a14",
} as const;

/** The dimmest text opacity the UI uses on the screen; `contrastRatio` tests keep it legible. */
export const DIM_TEXT_ALPHA = 0.7;

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};

/** WCAG contrast ratio between two `#rrggbb` colors. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `fg` at `alpha` composited over opaque `bg`, as `#rrggbb`. */
export function over(fg: string, alpha: number, bg: string): string {
  const f = parseInt(fg.slice(1), 16);
  const b = parseInt(bg.slice(1), 16);
  const mix = (shift: number) => Math.round(((f >> shift) & 255) * alpha + ((b >> shift) & 255) * (1 - alpha));
  return `#${[16, 8, 0].map((s) => mix(s).toString(16).padStart(2, "0")).join("")}`;
}
