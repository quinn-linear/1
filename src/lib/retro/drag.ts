/**
 * Geometry for the landing floppy: where it rests, where it counts as "in the
 * drive", and the seated pose. Pure (plain boxes in viewport px) so the drop
 * rules are tested; the UI measures real elements and feeds them in.
 */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Moving less than this many px between press and release is a tap, not a drag. */
export const TAP_SLOP_PX = 6;

const centerX = (b: Box) => b.left + b.width / 2;

/**
 * True when a dragged disk has been pushed into the slot: its leading (top)
 * edge reached the slot band, and its middle is over the slot's width.
 */
export function isOverSlot(disk: Box, slot: Box): boolean {
  const reached = disk.top <= slot.top + slot.height;
  const aligned = centerX(disk) >= slot.left && centerX(disk) <= slot.left + slot.width;
  return reached && aligned;
}

/** Offset from the resting pose to the seated one: centred on the slot, leading edge a third of the way into it. */
export function seatedOffset(rest: Box, slot: Box): { x: number; y: number } {
  return { x: centerX(slot) - centerX(rest), y: slot.top + slot.height / 3 - rest.top };
}

/** A drag offset kept inside the viewport so the disk can't be flung off screen. */
export function clampOffset(rest: Box, dx: number, dy: number, viewport: { width: number; height: number }): { x: number; y: number } {
  const min = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
  return {
    x: min(dx, -rest.left, viewport.width - rest.left - rest.width),
    y: min(dy, -rest.top, viewport.height - rest.top - rest.height),
  };
}
