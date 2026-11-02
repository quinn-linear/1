/**
 * Synthesized 1980s computer sounds. This file is the pure part: each sound is
 * a plan (a short list of oscillator/noise events) so limits are testable
 * without an AudioContext. `components/retro/Sound.tsx` plays the plans.
 * Nothing is sampled or licensed; everything is square/saw/noise.
 */

export type SoundName = "key" | "disk" | "advance" | "toggle" | "error" | "tape";

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
export const MIN_GAP_MS: Record<SoundName, number> = { key: 35, disk: 1500, advance: 90, toggle: 120, error: 400, tape: 1500 };

const step = (at: number, freq: number): SoundEvent => ({ at, dur: 0.035, kind: "square", freq, to: freq * 0.6, gain: 0.5 });

/**
 * `reduced` is for people who asked for reduced motion: the long drive and tape whirrs
 * become a single short click, and key ticks are quieter.
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
    case "tape": {
      // Cassette dropped into the deck: a plastic click and a latch thunk, then the motor
      // spinning up with a soft spool whirr. Ends inside the grant hold so the redirect never waits on it.
      const click: SoundEvent[] = [
        { at: 0, dur: 0.014, kind: "noise", freq: 0, gain: 0.7, filter: 3200 },
        { at: 0.006, dur: 0.05, kind: "square", freq: 240, to: 120, gain: 0.3 },
        { at: 0.07, dur: 0.03, kind: "noise", freq: 0, gain: 0.5, filter: 1800 },
      ];
      if (reduced) return click;
      return [
        ...click,
        // Motor: low saw rising as it comes up to speed, with a hiss of tape and spool noise.
        { at: 0.16, dur: 0.7, kind: "sawtooth", freq: 70, to: 150, gain: 0.16 },
        { at: 0.16, dur: 0.7, kind: "triangle", freq: 420, to: 760, gain: 0.05 },
        { at: 0.16, dur: 0.7, kind: "noise", freq: 0, gain: 0.1, filter: 2200 },
      ];
    }
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
 * Sound is off until the visitor turns it on (the effects and the ambience
 * below share this one switch). A saved "on" is that explicit opt-in; anything
 * else, including no saved choice, is off.
 */
export function initialSoundEnabled(saved: string | null): boolean {
  return saved === "on";
}

// ---- Ambience: a low machine-room hum with an occasional soft server beep ----

/** The ambience bus sits under the master gain (`MASTER_GAIN`), so this is "very quiet" on top of "modest". */
export const AMBIENCE_LEVEL = 0.4;
export const AMBIENCE_FADE_IN_S = 2;
export const AMBIENCE_FADE_OUT_S = 0.08;
/** A beep never comes sooner than this after the last one, and never later than the max. */
export const BEEP_MIN_GAP_MS = 12_000;
export const BEEP_MAX_GAP_MS = 32_000;

export interface HumLayer {
  kind: "sine" | "triangle" | "noise";
  /** Oscillator pitch in Hz; for noise, the low-pass cutoff. */
  freq: number;
  gain: number;
}

/** Mains hum and its second harmonic, a faint buzz, and a low fan rush. */
export const HUM_LAYERS: readonly HumLayer[] = [
  { kind: "sine", freq: 60, gain: 0.5 },
  { kind: "sine", freq: 120, gain: 0.22 },
  { kind: "triangle", freq: 180, gain: 0.05 },
  { kind: "noise", freq: 320, gain: 0.3 },
];

/** Delay before the next beep, from a random value in [0, 1). */
export const nextBeepDelayMs = (rand: number) => Math.round(BEEP_MIN_GAP_MS + Math.min(Math.max(rand, 0), 1) * (BEEP_MAX_GAP_MS - BEEP_MIN_GAP_MS));

const BEEP_PITCHES = [880, 988, 1175];

/** One restrained status beep, now and then a double. Soft triangle, never a siren. */
export function planBeep(rand: () => number): SoundEvent[] {
  const freq = BEEP_PITCHES[Math.floor(rand() * BEEP_PITCHES.length) % BEEP_PITCHES.length];
  const events: SoundEvent[] = [{ at: 0, dur: 0.09, kind: "triangle", freq, gain: 0.14 }];
  if (rand() < 0.25) events.push({ at: 0.2, dur: 0.09, kind: "triangle", freq, gain: 0.14 });
  return events;
}
