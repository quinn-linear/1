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

/** A drop must come from at least this far (px, or `MIN_DRAG_WIDTHS` cassette widths if larger) from where the tape was picked up. */
export const MIN_DRAG_PX = 56;
export const MIN_DRAG_WIDTHS = 0.6;

/**
 * Tracks one drag to tell a deliberate drop on the computer from a tape that was merely nudged or
 * released where it lay (on a phone's crop the resting tape can already sit on the computer's case).
 * A drop counts only when the pointer is over the target now, has travelled a meaningful distance
 * from the press, and has *entered* the target during this drag (it started outside, or left and came back).
 */
export interface DragIntent {
  startX: number;
  startY: number;
  /** Farthest distance from the press point so far. */
  reach: number;
  /** Whether the pointer was over the target at the previous sample. */
  wasOver: boolean;
  /** Whether it has come into the target from outside during this drag. */
  entered: boolean;
}

export function startIntent(x: number, y: number, over: boolean): DragIntent {
  return { startX: x, startY: y, reach: 0, wasOver: over, entered: false };
}

export function updateIntent(i: DragIntent, x: number, y: number, over: boolean): DragIntent {
  return { ...i, reach: Math.max(i.reach, Math.hypot(x - i.startX, y - i.startY)), wasOver: over, entered: i.entered || (over && !i.wasOver) };
}

/** True when letting go now (over the target) is an intentional sign-in. */
export function isIntentionalDrop(i: DragIntent, over: boolean, cassetteWidth: number): boolean {
  return over && i.entered && i.reach >= Math.max(MIN_DRAG_PX, cassetteWidth * MIN_DRAG_WIDTHS);
}
