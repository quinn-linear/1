/**
 * Geometry for the landing cassette: where it rests, whether the pointer is over
 * the computer, and where it flies on a tap. Pure (plain boxes in viewport px)
 * so the drop rules are tested; the UI measures real elements and feeds them in.
 */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Moving less than this many px between press and release is a tap, not a drag. */
export const TAP_SLOP_PX = 6;

/** True when the point is inside the box (edges included). The box is measured live, so it follows the responsive layout. */
export function containsPoint(box: Box, x: number, y: number): boolean {
  return x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
}

/** Offset that moves a resting box so its centre sits on the centre of `target`. */
export function centeredOffset(rest: Box, target: Box): { x: number; y: number } {
  return { x: target.left + target.width / 2 - (rest.left + rest.width / 2), y: target.top + target.height / 2 - (rest.top + rest.height / 2) };
}

/** A drag offset kept inside the viewport so the cassette can't be flung off screen. */
export function clampOffset(rest: Box, dx: number, dy: number, viewport: { width: number; height: number }): { x: number; y: number } {
  const min = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  return {
    x: min(dx, -rest.left, viewport.width - rest.left - rest.width),
    y: min(dy, -rest.top, viewport.height - rest.top - rest.height),
  };
}
