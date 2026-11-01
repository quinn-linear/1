/**
 * "Cover" placement of the landing picture: it fills the whole viewport edge to
 * edge, scaled uniformly (never stretched) and cropped on one axis. Everything that
 * sits on the picture (the CRT overlay, the cursor, the drop target, the dust and
 * the cassette's resting place) is given as a box in the picture's own 0-1
 * coordinates and mapped through the same placement, so they cannot drift apart
 * at any size. Pure, so the framing rules are tested.
 */
import type { Rect } from "./art.ts";
import type { Box } from "./drag.ts";

export interface Placement {
  /** Viewport px per picture px. */
  scale: number;
  /** The whole picture's box in viewport px; it extends past the viewport on the cropped axis. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** True on an axis where the picture is smaller than the viewport, so its edges show and are faded into the dark backdrop. */
  gapX?: boolean;
  gapY?: boolean;
}

/** Offset of the picture along one axis: centre `focus` (picture px) if all of it fits, else centre `anchor`, always covering the viewport. */
function offset(view: number, size: number, scale: number, focus: readonly [number, number], anchor: number): number {
  const [from, to] = focus;
  const centre = (to - from) * scale <= view ? (from + to) / 2 : anchor;
  return Math.min(0, Math.max(view - size, view / 2 - centre * scale));
}

/**
 * Cover the viewport with a picture of `art` px. When it must be cropped, keep `focus`
 * (fractions of the picture) in view if it fits, else keep `anchor` (the glass) centred.
 */
export function coverPlacement(view: { width: number; height: number }, art: { width: number; height: number }, focus: Rect, anchor: Rect): Placement {
  const scale = Math.max(view.width / art.width, view.height / art.height);
  const width = art.width * scale;
  const height = art.height * scale;
  const axis = (v: number, size: number, f0: number, f1: number, a: number) => offset(v, size, scale, [f0 * (size / scale), f1 * (size / scale)], a * (size / scale));
  return {
    scale,
    width,
    height,
    left: axis(view.width, width, focus.x, focus.x + focus.w, anchor.x + anchor.w / 2),
    top: axis(view.height, height, focus.y, focus.y + focus.h, anchor.y + anchor.h / 2),
  };
}

/**
 * The landing's framing: full-bleed cover where that already shows the whole `keep` box (the
 * computer) with `margin` px to spare; otherwise the largest uniform scale that does show it
 * whole, centred on it. Then the picture is cropped on an axis where it is still larger than the
 * viewport, and on an axis where it is smaller (an upright phone: it is width-fitted) its edges
 * are left to fade into the backdrop. Never stretched.
 */
export function scenePlacement(view: { width: number; height: number }, art: { width: number; height: number }, focus: Rect, anchor: Rect, keep: Rect, margin = 10): Placement {
  const cover = coverPlacement(view, art, focus, anchor);
  const box = mapRect(cover, keep);
  const shown = box.left >= margin - 1e-6 && box.top >= margin - 1e-6 && box.left + box.width <= view.width - margin + 1e-6 && box.top + box.height <= view.height - margin + 1e-6;
  if (shown) return cover;
  const kw = keep.w * art.width;
  const kh = keep.h * art.height;
  const scale = Math.min(cover.scale, (view.width - 2 * margin) / kw, (view.height - 2 * margin) / kh);
  const width = art.width * scale;
  const height = art.height * scale;
  const place = (v: number, size: number, from: number, len: number) => {
    if (size <= v) return (v - size) / 2;
    const centre = from + len / 2; // picture px
    return Math.min(0, Math.max(v - size, v / 2 - centre * scale));
  };
  return {
    scale,
    width,
    height,
    left: place(view.width, width, keep.x * art.width, kw),
    top: place(view.height, height, keep.y * art.height, kh),
    gapX: width < view.width - 0.5,
    gapY: height < view.height - 0.5,
  };
}

/** A box given as fractions of the picture, in viewport px. */
export function mapRect(p: Placement, r: Rect): Box {
  return { left: p.left + r.x * p.width, top: p.top + r.y * p.height, width: r.w * p.width, height: r.h * p.height };
}

/**
 * Where the cassette rests: on the notepad at the picture's scale, but never smaller than
 * `minWidth`, never wider than `maxShare` of the viewport, and always whole inside the
 * viewport (inset by `margin`), so it can't be cropped off however the picture is framed.
 */
export function restingBox(p: Placement, rest: Rect, view: { width: number; height: number }, { margin = 12, minWidth = 96, maxShare = 0.6 } = {}): Box {
  const natural = mapRect(p, rest);
  const ratio = natural.height / natural.width;
  const width = Math.min(Math.max(natural.width, minWidth), view.width * maxShare, view.width - 2 * margin);
  const height = width * ratio;
  const left = Math.min(Math.max(natural.left + (natural.width - width) / 2, margin), view.width - margin - width);
  const top = Math.min(Math.max(natural.top + (natural.height - height) / 2, margin), view.height - margin - height);
  return { left, top, width, height };
}

/**
 * Where the tape rests when the picture is framed whole (`scenePlacement`): on the notepad if
 * that is entirely on screen, else centred in the free band below the computer's drop target (or
 * above it, if that is roomier), never over it, and no smaller than `minWidth` so it is easy to hit.
 */
export function sceneRestingBox(p: Placement, rest: Rect, drop: Rect, notepad: Rect, view: { width: number; height: number }, { margin = 12, minWidth = 120, maxShare = 0.5 } = {}): Box {
  const pad = mapRect(p, notepad);
  if (pad.left >= 0 && pad.top >= 0 && pad.left + pad.width <= view.width && pad.top + pad.height <= view.height) return restingBox(p, rest, view, { margin, minWidth: 96, maxShare: 0.6 });
  const natural = mapRect(p, rest);
  const ratio = natural.height / natural.width;
  const target = mapRect(p, drop);
  const below = view.height - (target.top + target.height);
  const above = target.top;
  const width = Math.min(Math.max(natural.width, minWidth), view.width * maxShare);
  const height = width * ratio;
  const room = Math.max(below, above);
  if (room < height + 2 * margin) return restingBox(p, rest, view, { margin, minWidth: 96, maxShare: 0.6 });
  const top = below >= above ? target.top + target.height + (below - height) / 2 : (above - height) / 2;
  return { left: (view.width - width) / 2, top, width, height };
}
