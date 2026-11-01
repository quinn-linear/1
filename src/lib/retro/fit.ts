/**
 * Fit-to-viewport maths for story cards. A card is laid out at a scale `s`
 * (1 = designed size): its content box is `available / s` wide and is then
 * shrunk by `s`, so a smaller scale both reduces the type and lets the text
 * reflow wider, which makes the content shorter. The search picks the largest
 * scale whose content height fits, never below `MIN_SCALE`.
 */
export const MIN_SCALE = 0.5;
export const SCALE_STEP = 0.04;

export interface Fit {
  scale: number;
  /** True when even `MIN_SCALE` doesn't fit, so the card must scroll (accessibility fallback). */
  overflow: boolean;
}

/** `heightAt(scale)` is the content's height, in layout px before scaling, when laid out at that scale. */
export function chooseScale(available: number, heightAt: (scale: number) => number): Fit {
  if (!(available > 0)) return { scale: 1, overflow: false };
  for (let s = 1; s >= MIN_SCALE - 1e-9; s -= SCALE_STEP) {
    const scale = Math.max(MIN_SCALE, Math.round(s * 100) / 100);
    if (heightAt(scale) * scale <= available + 0.5) return { scale, overflow: false };
  }
  return { scale: MIN_SCALE, overflow: true };
}
