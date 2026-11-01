/**
 * The landing computer's artwork and where things sit on it. This is the one
 * place to change if the picture is swapped (replace `public/retro/pet.webp`
 * with a file of the same composition, or update the numbers below).
 *
 * The picture is the supplied halftone beige PET on a lamp-lit desk, 1672 x 941
 * px, with the CRT opening left blank. The interactive terminal is real HTML laid
 * over that opening, so the numbers below were measured from the image's pixels:
 * the glass (inside the bezel's recess, including its thin black rim) spans
 * x 588-1065, y 167-528, with corners rounded at about 70 px.
 */
export const PET_ART = {
  src: "/retro/pet.webp",
  /** Decorative: the terminal and controls carry all the content. */
  alt: "",
  width: 1672,
  height: 941,
};

/** The supplied halftone cassette (transparent background, trimmed to the tape), shown whole. */
export const CASSETTE_ART = { src: "/retro/cassette.webp", width: 840, height: 457 };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Terminal area, as fractions of the whole picture. */
export const PET_SCREEN: Rect = { x: 588 / 1672, y: 167 / 941, w: 477 / 1672, h: 361 / 941 };

/**
 * The notepad on the desk (lower right), measured from the picture. The cassette
 * rests on it: `CASSETTE_REST` is the tape's box on the picture (at about the
 * notepad's width, centred on its lined sheet).
 */
export const PET_NOTEPAD: Rect = { x: 1280 / 1672, y: 655 / 941, w: 320 / 1672, h: 220 / 941 };
export const CASSETTE_REST: Rect = { x: 1290 / 1672, y: 690 / 941, w: 270 / 1672, h: (270 * 457) / 840 / 941 };

/**
 * The monitor (its whole housing, bezel and glass) as a box on the picture: the drop
 * target. It stops well short of the notepad and the keyboard, so a tape lying where it
 * rests is never "over" it, even when a phone's crop leaves the tape on top of the case.
 */
export const PET_COMPUTER: Rect = { x: 470 / 1672, y: 118 / 941, w: 710 / 1672, h: 470 / 941 };

/**
 * What the cover crop must keep in view when the screen is too narrow or short to
 * show the whole picture: the glass and the notepad, with the tape's margin.
 * When both cannot fit (a phone held upright) the glass wins and the tape is pulled
 * back inside the screen instead (see `lib/retro/cover.ts`).
 */
export const PET_FOCUS: Rect = { x: 560 / 1672, y: 150 / 941, w: 1080 / 1672, h: 740 / 941 };

/**
 * The lamp's beam on the picture (upper left), measured from the artwork: a triangle from the
 * lamp's mouth down to the desk, in picture pixels. `PET_BEAM` is its bounding box as fractions
 * of the whole picture; `BEAM_POLYGON` is the same triangle-ish shape in 0-1 coordinates of
 * that box. The dust motes live inside it and nowhere else.
 */
export const PET_BEAM: Rect = { x: 40 / 1672, y: 185 / 941, w: 395 / 1672, h: 360 / 941 };
export const BEAM_POLYGON: readonly (readonly [number, number])[] = (
  [[70, 255], [285, 190], [430, 470], [430, 540], [40, 540]] as const
).map(([x, y]) => [(x - 40) / 395, (y - 185) / 360] as const);
