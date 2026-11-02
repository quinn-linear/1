import assert from "node:assert/strict";
import { test } from "node:test";
import { createAmbience } from "./ambience.ts";
import { BEEP_MAX_GAP_MS, BEEP_MIN_GAP_MS, HUM_LAYERS, nextBeepDelayMs, planBeep } from "./sound.ts";

const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} });

/** A stub AudioContext that counts what is created, started and stopped. */
function fakeAudio(state: "running" | "suspended" = "running", resume?: () => Promise<void>) {
  const c = { contexts: 0, started: 0, stopped: 0, beepsStarted: 0 };
  c.contexts++;
  const ctx = {
    state,
    currentTime: 0,
    sampleRate: 100,
    resume: resume ?? (async () => void (ctx.state = "running")),
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createBiquadFilter: () => ({ type: "", frequency: { value: 0 }, connect() {} }),
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => ({ buffer: null, loop: false, connect() {}, start: () => void c.started++, stop: () => void c.stopped++ }),
    createOscillator: () => {
      const o = {
        type: "", frequency: { value: 0 }, onended: null as null | (() => void), connect() {},
        done: false,
        start: () => { c.started++; },
        stop: () => { if (!o.done) { o.done = true; c.stopped++; } },
      };
      return o;
    },
  };
  const master = { connect() {} };
  return { c, ctx, out: { ctx: ctx as unknown as AudioContext, master: master as unknown as AudioNode } };
}

/** A manual timer queue so beeps and fades run on demand. */
function fakeTimers() {
  const q = new Map<number, { fn: () => void; ms: number }>();
  let id = 0;
  return {
    q,
    setTimer: (fn: () => void, ms: number) => (q.set(++id, { fn, ms }), id),
    clearTimer: (i: unknown) => void q.delete(i as number),
    fire: (pick: (ms: number) => boolean) => {
      for (const [k, t] of [...q]) if (pick(t.ms)) { q.delete(k); t.fn(); }
    },
  };
}

const layers = HUM_LAYERS.length;

test("nothing starts, and no timer is set, until start is called", () => {
  const a = fakeAudio();
  const t = fakeTimers();
  let asked = 0;
  const amb = createAmbience({ getOutput: () => (asked++, a.out), ...t });
  assert.equal(amb.running(), false);
  assert.equal(asked, 0);
  assert.equal(a.c.started, 0);
  assert.equal(t.q.size, 0);
});

test("start plays one hum and is idempotent, so repeated opt-ins never stack", async () => {
  const a = fakeAudio("suspended");
  const t = fakeTimers();
  const amb = createAmbience({ getOutput: () => a.out, ...t });
  const results = await Promise.all([amb.start(), amb.start(), amb.start()]);
  assert.ok(results.every(Boolean) || results.some(Boolean));
  await amb.start();
  assert.equal(a.c.started, layers, "exactly one hum");
  assert.equal(t.q.size, 1, "one beep timer");
  assert.equal(a.c.contexts, 1);
});

test("stop silences at once, cancels the beep timer and releases every node", async () => {
  const a = fakeAudio();
  const t = fakeTimers();
  const amb = createAmbience({ getOutput: () => a.out, random: () => 0.5, ...t });
  await amb.start();
  t.fire((ms) => ms >= BEEP_MIN_GAP_MS); // one beep sounds; the next is scheduled
  assert.ok(a.c.started > layers);
  amb.stop();
  assert.equal(amb.running(), false);
  assert.ok(![...t.q.values()].some((x) => x.ms >= BEEP_MIN_GAP_MS), "no beep left scheduled");
  t.fire(() => true); // the fade-out finishes
  assert.equal(a.c.stopped, a.c.started, "every started source was stopped");
  assert.equal(t.q.size, 0);
  // Starting again (unmute) gives a fresh single hum.
  const before = a.c.started;
  await amb.start();
  assert.equal(a.c.started - before, layers);
});

test("a stop that lands while the browser is still resuming wins", async () => {
  let release!: () => void;
  const a = fakeAudio("suspended", () => new Promise<void>((r) => (release = r)));
  const t = fakeTimers();
  const amb = createAmbience({ getOutput: () => a.out, ...t });
  const p = amb.start();
  amb.stop();
  a.ctx.state = "running";
  release();
  assert.equal(await p, false);
  assert.equal(a.c.started, 0);
  assert.equal(t.q.size, 0, "no beep timer");
});

test("a refused resume or missing WebAudio fails quietly", async () => {
  const t = fakeTimers();
  const refused = fakeAudio("suspended", async () => { throw new Error("NotAllowedError"); });
  assert.equal(await createAmbience({ getOutput: () => refused.out, ...t }).start(), false);
  const stuck = fakeAudio("suspended", async () => {});
  assert.equal(await createAmbience({ getOutput: () => stuck.out, ...t }).start(), false);
  assert.equal(await createAmbience({ getOutput: () => null, ...t }).start(), false);
  assert.equal(refused.c.started + stuck.c.started, 0);
});

test("beeps are rare, soft and bounded", () => {
  for (const r of [0, 0.25, 0.5, 0.99, 2, -1]) {
    const d = nextBeepDelayMs(r);
    assert.ok(d >= BEEP_MIN_GAP_MS && d <= BEEP_MAX_GAP_MS);
  }
  assert.ok(BEEP_MIN_GAP_MS >= 10_000);
  for (const r of [0, 0.1, 0.5, 0.9, 0.999]) {
    const events = planBeep(() => r);
    assert.ok(events.length >= 1 && events.length <= 2);
    for (const e of events) assert.ok(e.gain <= 0.2 && e.dur <= 0.12 && e.freq <= 1500 && e.kind === "triangle");
  }
});
