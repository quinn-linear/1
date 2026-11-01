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
 * Crops of the picture, as fractions of it. `wide` is the whole scene (the
 * composition is never stretched). `tight` is for phones: it zooms on the
 * monitor so the terminal stays readable, instead of shrinking the lot.
 */
export const PET_VIEWS: Record<"wide" | "tight", Rect> = {
  wide: { x: 0, y: 0, w: 1, h: 1 },
  tight: { x: 0.27, y: 0.08, w: 0.46, h: 0.54 },
};

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
