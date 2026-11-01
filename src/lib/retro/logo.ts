/**
 * The boot screen's artwork: the Linear mark (a circle crossed by diagonal
 * cuts in its lower-left) drawn in half blocks with a little shade dithering
 * on the rim, plus the exact title text and how the lines are revealed.
 *
 * Original artwork, drawn by hand as 14 x 12 "pixels" (two per character row)
 * so a circle reads at terminal size. Every row is the same width: it is shown
 * in a monospace face with no letter-spacing, so columns must line up.
 */
export const LOGO_LINES = [
  "  ▄▄██████▄▄  ",
  " █████▀██████ ",
  "▒███▀▄█▀▄█████",
  "▓█▀▄█▀▄█▀▄████",
  " ░█▀▄█▀▄█████ ",
  "   ▀▀▄████▀▀  ",
] as const;

/** Shown exactly like this (not forced to capitals) beside the mark. */
export const BOOT_TITLE = "Linear wrapped";

/** Remaining boot lines, in order, under the title. Short enough for the PET screen's columns. */
export const BOOT_LINES = ["2026", "", "READY.", "INSERT DISK"] as const;

/** Spoken name of the whole boot screen; the art itself is hidden from assistive tech. */
export const BOOT_LABEL = "Linear wrapped";

const BASE_MS = 120;
const STEP_MS = 80;

/** Delay in ms before each of `count` lines appears. `instant` (reduced motion, skipped) shows them all at once. */
export function bootSchedule(count: number, instant: boolean): number[] {
  return Array.from({ length: count }, (_, i) => (instant ? 0 : BASE_MS + i * STEP_MS));
}

/** When the last of `count` lines has appeared. */
export const bootDuration = (count: number, instant: boolean) => Math.max(0, ...bootSchedule(count, instant));
