/**
 * Synthesized 1980s computer sounds. This file is the pure part: each sound is
 * a plan (a short list of oscillator/noise events) so limits are testable
 * without an AudioContext. `components/retro/Sound.tsx` plays the plans.
 * Nothing is sampled or licensed; everything is square/saw/noise.
 */

export type SoundName = "key" | "disk" | "advance" | "toggle" | "error" | "ready";

export interface SoundEvent {
  /** Seconds after the sound starts. */
  at: number;
  dur: number;
  kind: "square" | "sawtooth" | "triangle" | "noise";
  freq: number;
  /** Optional glide target in Hz. */
  to?: number;
  /** Peak gain before the master volume, 0-1. */
  gain: number;
  /** Noise only: band-pass center in Hz. */
  filter?: number;
}

/** Master volume is deliberately low: these are accents, not an alarm. */
export const MASTER_GAIN = 0.12;
/** No single sound may run longer than this, and none may have more events than `MAX_EVENTS`. */
export const MAX_SOUND_SECONDS = 2.4;
export const MAX_EVENTS = 40;
/** Same sound won't retrigger faster than this (fast typing, key repeat). */
export const MIN_GAP_MS: Record<SoundName, number> = { key: 35, disk: 1500, advance: 90, toggle: 120, error: 400, ready: 800 };

const step = (at: number, freq: number): SoundEvent => ({ at, dur: 0.035, kind: "square", freq, to: freq * 0.6, gain: 0.5 });

/**
 * `reduced` is for people who asked for reduced motion: the long drive whirr
 * becomes a single short click, and key ticks are quieter.
 */
export function planSound(name: SoundName, reduced = false): SoundEvent[] {
  switch (name) {
    case "key":
      // A mechanical tick: a noise burst plus a tiny low thock.
      return [
        { at: 0, dur: 0.018, kind: "noise", freq: 0, gain: reduced ? 0.25 : 0.45, filter: 2600 },
        { at: 0, dur: 0.03, kind: "square", freq: 180, to: 90, gain: reduced ? 0.12 : 0.22 },
      ];
    case "disk": {
      if (reduced) return [{ at: 0, dur: 0.08, kind: "noise", freq: 0, gain: 0.5, filter: 900 }, step(0.1, 520)];
      // Disk inserted (clunk), motor spin-up whirr, then head stepping across tracks.
      const events: SoundEvent[] = [
        { at: 0, dur: 0.09, kind: "noise", freq: 0, gain: 0.8, filter: 700 },
        { at: 0.02, dur: 0.12, kind: "square", freq: 110, to: 55, gain: 0.5 },
        { at: 0.3, dur: 1.3, kind: "sawtooth", freq: 38, to: 74, gain: 0.35 },
        { at: 0.3, dur: 1.3, kind: "noise", freq: 0, gain: 0.12, filter: 420 },
      ];
      for (let i = 0; i < 9; i++) events.push(step(0.55 + i * 0.1 + (i % 3) * 0.02, 420 + (i % 4) * 70));
      return events;
    }
    case "advance":
      // Two quick rising blips, like a sound chip acknowledging a keypress.
      return [
        { at: 0, dur: 0.05, kind: "square", freq: 660, gain: reduced ? 0.25 : 0.4 },
        { at: 0.055, dur: 0.07, kind: "square", freq: 990, gain: reduced ? 0.25 : 0.4 },
      ];
    case "toggle":
      return [{ at: 0, dur: 0.06, kind: "triangle", freq: 440, to: 330, gain: 0.45 }];
    case "error":
      return [{ at: 0, dur: 0.18, kind: "square", freq: 150, gain: 0.35 }];
    case "ready":
      return [
        { at: 0, dur: 0.07, kind: "square", freq: 523, gain: 0.35 },
        { at: 0.08, dur: 0.07, kind: "square", freq: 659, gain: 0.35 },
        { at: 0.16, dur: 0.14, kind: "square", freq: 784, gain: 0.35 },
      ];
  }
}

export const soundLength = (events: SoundEvent[]) => Math.max(0, ...events.map((e) => e.at + e.dur));

/** Rate limiter: true when `name` may play at `now` given when it last played. */
export function allowSound(name: SoundName, now: number, last: Partial<Record<SoundName, number>>): boolean {
  const prev = last[name];
  return prev === undefined || now - prev >= MIN_GAP_MS[name];
}

export const SOUND_STORAGE_KEY = "lw-sound";

/**
 * Default is on for ordinary visitors (a sound only ever plays in direct
 * response to their own click or key press, never on load) and off for anyone
 * who prefers reduced motion. A saved choice always wins.
 */
export function initialSoundEnabled(saved: string | null, prefersReducedMotion: boolean): boolean {
  if (saved === "on") return true;
  if (saved === "off") return false;
  return !prefersReducedMotion;
}
