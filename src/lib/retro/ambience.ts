import { AMBIENCE_FADE_IN_S, AMBIENCE_FADE_OUT_S, AMBIENCE_LEVEL, HUM_LAYERS, nextBeepDelayMs, planBeep } from "./sound.ts";

/**
 * The machine-room ambience: a low hum with an occasional soft beep, on the
 * page's one shared AudioContext (`getOutput`). Nothing here creates a context
 * or touches the clock on its own: `start` must be called from a user gesture,
 * and `stop` tears down every node and cancels the beep timer, so there is
 * never more than one hum and a muted page is silent at once.
 */
export interface AmbienceOutput {
  ctx: AudioContext;
  master: AudioNode;
}

export interface AmbienceDeps {
  /** The shared output, or null when WebAudio is unavailable. */
  getOutput: () => AmbienceOutput | null;
  random?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

export interface Ambience {
  /** Begin the hum. Resolves true when it is playing, false when it could not start (no WebAudio, resume refused, or stopped meanwhile). */
  start: () => Promise<boolean>;
  stop: () => void;
  running: () => boolean;
}

type Stoppable = { stop: (when?: number) => void; disconnect: () => void };

export function createAmbience(deps: AmbienceDeps): Ambience {
  const random = deps.random ?? Math.random;
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));

  let generation = 0;
  let live: { out: AmbienceOutput; bus: GainNode; sources: Stoppable[]; beeps: Set<Stoppable> } | null = null;
  let beepTimer: unknown = null;
  let fadeTimer: unknown = null;
  let pending: (() => void) | null = null;

  const flush = () => {
    if (fadeTimer !== null) clearTimer(fadeTimer);
    fadeTimer = null;
    pending?.();
    pending = null;
  };

  const scheduleBeep = () => {
    beepTimer = setTimer(() => {
      if (!live) return;
      const { out, bus, beeps } = live;
      const t0 = out.ctx.currentTime + 0.02;
      for (const e of planBeep(random)) {
        const osc = out.ctx.createOscillator();
        const gain = out.ctx.createGain();
        const start = t0 + e.at;
        osc.type = e.kind as OscillatorType;
        osc.frequency.value = e.freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(e.gain, start + 0.015);
        gain.gain.linearRampToValueAtTime(0.0001, start + e.dur);
        osc.connect(gain);
        gain.connect(bus);
        osc.start(start);
        osc.stop(start + e.dur + 0.02);
        const handle: Stoppable = { stop: (w) => osc.stop(w), disconnect: () => gain.disconnect() };
        beeps.add(handle);
        osc.onended = () => {
          beeps.delete(handle);
          gain.disconnect();
        };
      }
      scheduleBeep();
    }, nextBeepDelayMs(random()));
  };

  const stop = () => {
    generation++;
    if (beepTimer !== null) clearTimer(beepTimer);
    beepTimer = null;
    const current = live;
    live = null;
    if (!current) return;
    const { ctx } = current.out;
    const now = ctx.currentTime;
    current.bus.gain.cancelScheduledValues(now);
    current.bus.gain.setValueAtTime(current.bus.gain.value, now);
    current.bus.gain.linearRampToValueAtTime(0, now + AMBIENCE_FADE_OUT_S);
    pending = () => {
      for (const s of [...current.sources, ...current.beeps]) {
        try {
          s.stop();
        } catch {
          // Already stopped.
        }
        s.disconnect();
      }
      current.bus.disconnect();
    };
    fadeTimer = setTimer(flush, AMBIENCE_FADE_OUT_S * 1000 + 30);
  };

  const start = async () => {
    if (live) return true;
    const token = ++generation;
    flush();
    const out = deps.getOutput();
    if (!out) return false;
    try {
      if (out.ctx.state === "suspended") await out.ctx.resume();
    } catch {
      return false;
    }
    // Stopped (or started again) while the browser was resuming the context.
    if (token !== generation || live) return live !== null;
    if (out.ctx.state === "suspended") return false;

    const { ctx } = out;
    const bus = ctx.createGain();
    const now = ctx.currentTime;
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(AMBIENCE_LEVEL, now + AMBIENCE_FADE_IN_S);
    bus.connect(out.master);

    const sources: Stoppable[] = [];
    for (const layer of HUM_LAYERS) {
      const gain = ctx.createGain();
      gain.gain.value = layer.gain;
      if (layer.kind === "noise") {
        const length = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const low = ctx.createBiquadFilter();
        low.type = "lowpass";
        low.frequency.value = layer.freq;
        src.connect(low);
        low.connect(gain);
        src.start();
        sources.push({ stop: (w) => src.stop(w), disconnect: () => gain.disconnect() });
      } else {
        const osc = ctx.createOscillator();
        osc.type = layer.kind;
        osc.frequency.value = layer.freq;
        osc.connect(gain);
        osc.start();
        sources.push({ stop: (w) => osc.stop(w), disconnect: () => gain.disconnect() });
      }
      gain.connect(bus);
    }
    live = { out, bus, sources, beeps: new Set() };
    scheduleBeep();
    return true;
  };

  return { start, stop, running: () => live !== null };
}
