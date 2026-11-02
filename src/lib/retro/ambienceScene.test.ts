import assert from "node:assert/strict";
import { test } from "node:test";
import { createAmbience } from "./ambience.ts";
import { createAmbienceScene } from "./ambienceScene.ts";

const fake = () => {
  let running = false;
  return {
    starts: 0,
    stops: 0,
    start() {
      this.starts++;
      running = true;
      return Promise.resolve(true);
    },
    stop() {
      this.stops++;
      running = false;
    },
    running: () => running,
  };
};

test("landing -> wrapped stops the hum, and the recap's sound toggle cannot restart it", () => {
  const amb = fake();
  const s = createAmbienceScene(amb);
  s.setScene(true);
  s.setEnabled(true);
  s.unlock();
  assert.ok(amb.running());
  s.setScene(false); // navigated to /wrapped
  assert.ok(!amb.running());
  s.setEnabled(false);
  s.setEnabled(true); // toggled on and off again from the recap
  s.unlock();
  s.setHidden(true);
  s.setHidden(false);
  assert.ok(!amb.running());
});

test("needs scene, opt-in, gesture and a visible tab", () => {
  const amb = fake();
  const s = createAmbienceScene(amb);
  s.setEnabled(true);
  s.setScene(true);
  assert.ok(!amb.running(), "no gesture yet");
  s.unlock();
  assert.ok(amb.running());
  s.setHidden(true);
  assert.ok(!amb.running());
  s.setHidden(false);
  assert.ok(amb.running());
  s.setEnabled(false);
  assert.ok(!amb.running());
});

test("returning to the landing restarts it only with the opt-in", () => {
  const amb = fake();
  const s = createAmbienceScene(amb);
  s.setScene(true);
  s.unlock();
  s.setScene(false);
  s.setScene(true);
  assert.ok(!amb.running(), "sound off: stays silent");
  s.setEnabled(true);
  assert.ok(amb.running());
});

test("leaving while the context is still resuming never starts the hum or its beeps", async () => {
  let resolveResume: () => void = () => {};
  const nodes: string[] = [];
  const timers: unknown[] = [];
  const node = () => new Proxy({}, { get: (_t, k) => (k === "gain" ? new Proxy({}, { get: () => () => {}, set: () => true }) : () => node()), set: () => true });
  const ctx = {
    state: "suspended",
    currentTime: 0,
    sampleRate: 100,
    resume: () => new Promise<void>((r) => (resolveResume = () => ((ctx.state = "running"), r()))),
    createGain: () => (nodes.push("gain"), node()),
    createOscillator: () => (nodes.push("osc"), node()),
    createBuffer: () => ({ getChannelData: () => new Float32Array(200) }),
    createBufferSource: () => (nodes.push("src"), node()),
    createBiquadFilter: () => node(),
  };
  const amb = createAmbience({ getOutput: () => ({ ctx: ctx as never, master: {} as never }), setTimer: (fn) => (timers.push(fn), timers.length), clearTimer: () => {} });
  const s = createAmbienceScene(amb);
  s.setEnabled(true);
  s.setScene(true);
  s.unlock(); // start() now awaits resume
  s.setScene(false); // navigation
  resolveResume();
  await new Promise((r) => setImmediate(r));
  assert.ok(!amb.running());
  assert.equal(nodes.length, 0, "no audio nodes were built");
});

test("sound effects don't depend on the ambience scene", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../../components/retro/Sound.tsx", import.meta.url), "utf8");
  assert.match(src, /const play = useCallback\(\(name: SoundName\) => enabled && playNow\(name\)/);
  assert.doesNotMatch(src.match(/const play = .*/)?.[0] ?? "", /scene/i);
});
