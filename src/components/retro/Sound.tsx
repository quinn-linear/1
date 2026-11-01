"use client";

import { useReducedMotion } from "framer-motion";
import { createContext, useCallback, useContext, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { MASTER_GAIN, MAX_SOUND_SECONDS, SOUND_STORAGE_KEY, allowSound, initialSoundEnabled, planSound, type SoundEvent, type SoundName } from "@/lib/retro/sound";

interface SoundApi {
  enabled: boolean;
  toggle: () => void;
  /** Call from a user event handler only; it does nothing while muted or rate-limited. */
  play: (name: SoundName) => void;
}

const SoundContext = createContext<SoundApi>({ enabled: false, toggle: () => {}, play: () => {} });
export const useSound = () => useContext(SoundContext);

// The saved choice lives in localStorage; a tiny store keeps every toggle on the page in sync.
const listeners = new Set<() => void>();
const readSaved = () => {
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY);
  } catch {
    return null;
  }
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
const saveChoice = (on: boolean) => {
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Private mode: the choice just lasts for this page view.
    memory = on ? "on" : "off";
  }
  listeners.forEach((l) => l());
};
let memory: string | null = null;

function schedule(ctx: AudioContext, master: GainNode, events: SoundEvent[]) {
  const t0 = ctx.currentTime + 0.01;
  for (const e of events) {
    const start = t0 + e.at;
    const end = start + e.dur;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(e.gain, 0.0002), start + Math.min(0.006, e.dur / 2));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    if (e.kind === "noise") {
      const length = Math.max(1, Math.floor(ctx.sampleRate * e.dur));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = e.filter ?? 1000;
      src.connect(band).connect(gain).connect(master);
      src.start(start);
    } else {
      const osc = ctx.createOscillator();
      osc.type = e.kind;
      osc.frequency.setValueAtTime(e.freq, start);
      if (e.to) osc.frequency.exponentialRampToValueAtTime(e.to, end);
      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }
}

/**
 * Optional WebAudio sound effects. The AudioContext is only created inside a
 * `play`/`toggle` call, which callers make from clicks and key presses, so
 * nothing ever plays on page load. Volume is capped (`MASTER_GAIN`), sounds are
 * rate-limited and length-capped, and the choice is remembered.
 */
export function SoundProvider({ children }: { children: ReactNode }) {
  const reduced = !!useReducedMotion();
  const saved = useSyncExternalStore(subscribe, () => memory ?? readSaved(), () => null);
  const enabled = initialSoundEnabled(saved, reduced);
  const audio = useRef<{ ctx: AudioContext; master: GainNode } | null>(null);
  const last = useRef<Partial<Record<SoundName, number>>>({});

  const output = useCallback(() => {
    if (!audio.current) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
      audio.current = { ctx, master };
    }
    if (audio.current.ctx.state === "suspended") void audio.current.ctx.resume();
    return audio.current;
  }, []);

  const playNow = useCallback(
    (name: SoundName) => {
      const now = performance.now();
      if (!allowSound(name, now, last.current)) return;
      const out = output();
      if (!out) return;
      last.current[name] = now;
      const events = planSound(name, reduced).filter((e) => e.at + e.dur <= MAX_SOUND_SECONDS);
      schedule(out.ctx, out.master, events);
    },
    [output, reduced],
  );

  const play = useCallback((name: SoundName) => enabled && playNow(name), [enabled, playNow]);

  const toggle = useCallback(() => {
    saveChoice(!enabled);
    // Turning sound on gives a confirming blip (this click is the user gesture that unlocks audio).
    if (!enabled) playNow("toggle");
  }, [enabled, playNow]);

  const api = useMemo(() => ({ enabled, toggle, play }), [enabled, toggle, play]);
  return <SoundContext.Provider value={api}>{children}</SoundContext.Provider>;
}

/** Mute switch, always visible wherever sound can play. `screen` styles it as an on-screen button, `key` as a keycap on the hardware. */
export function SoundToggle({ className = "", variant = "key" }: { className?: string; variant?: "key" | "screen" }) {
  const { enabled, toggle } = useSound();
  const off = variant === "key" ? "bg-ink/30" : "bg-ph/40";
  return (
    <button type="button" onClick={toggle} aria-pressed={enabled} aria-label="Sound effects" className={`${variant === "key" ? "keycap" : "term-btn"} ${className}`}>
      <span aria-hidden className={`mr-1.5 inline-block h-2 w-2 ${enabled ? "bg-[var(--led)] shadow-[0_0_6px_var(--led)]" : off}`} />
      SND {enabled ? "ON" : "OFF"}
    </button>
  );
}
