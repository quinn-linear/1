/**
 * The landing computer's artwork and where things sit on it. This is the one
 * place to change if the picture is swapped (replace `public/retro/pet.png`
 * with a file of the same composition, or update the numbers below).
 *
 * The picture is a supplied photo-real Commodore PET on a lamp-lit desk, 1672 x
 * 941 px, with the CRT opening left blank black. The interactive terminal is
 * real HTML laid over that opening, so the numbers below were measured from the
 * image's pixels (the black region spans x 596-1075, y 148-441; the rectangle
 * here sits just inside its rounded corners).
 */
export const PET_ART = {
  src: "/retro/pet.png",
  /** Decorative: the terminal and controls carry all the content. */
  alt: "",
  width: 1672,
  height: 941,
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Terminal area, as fractions of the whole picture. */
export const PET_SCREEN: Rect = { x: 606 / 1672, y: 158 / 941, w: 458 / 1672, h: 268 / 941 };

/**
 * Crops of the picture, as fractions of it. `wide` is the whole scene (the
 * composition is never stretched). `tight` is for phones: it zooms on the
 * monitor so the terminal stays readable, instead of shrinking the lot.
 */
export const PET_VIEWS: Record<"wide" | "tight", Rect> = {
  wide: { x: 0, y: 0, w: 1, h: 1 },
  tight: { x: 0.27, y: 0.07, w: 0.46, h: 0.5 },
};
