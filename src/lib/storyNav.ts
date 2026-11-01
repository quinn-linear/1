export type StoryAction = "next" | "prev";

export const SWIPE_MIN_PX = 40;
const TAP_MAX_PX = 10;
/** Left third of the screen goes back; the rest goes forward. */
const BACK_ZONE = 1 / 3;

export function clampIndex(index: number, count: number): number {
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}

export function step(index: number, action: StoryAction, count: number): number {
  return clampIndex(index + (action === "next" ? 1 : -1), count);
}

/** Maps a pointer down/up pair to a navigation action; null for ambiguous drags (e.g. scrolling). */
export function resolveGesture(g: { startX: number; startY: number; endX: number; endY: number; width: number }): StoryAction | null {
  const dx = g.endX - g.startX;
  const dy = g.endY - g.startY;
  if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.2) return dx < 0 ? "next" : "prev";
  if (Math.abs(dx) <= TAP_MAX_PX && Math.abs(dy) <= TAP_MAX_PX) return g.endX < g.width * BACK_ZONE ? "prev" : "next";
  return null;
}

export function keyToAction(key: string): StoryAction | null {
  if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown" || key === " ") return "next";
  if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") return "prev";
  return null;
}
