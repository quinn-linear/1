import assert from "node:assert/strict";
import { test } from "node:test";
import { CARD_IDS } from "../recap.ts";
import { CARD_ACCENTS } from "../share/theme.ts";
import { EMPTY_LINES, HELP_LINES, LOAD_LINES, SYNTAX_LINES, bootReducer, parseCommand, type BootPhase } from "./boot.ts";
import { DIM_TEXT_ALPHA, PALETTE, contrastRatio, over } from "./palette.ts";
import { MASTER_GAIN, MAX_EVENTS, MAX_SOUND_SECONDS, MIN_GAP_MS, allowSound, initialSoundEnabled, planSound, soundLength, type SoundName } from "./sound.ts";

const SOUNDS = Object.keys(MIN_GAP_MS) as SoundName[];

test("every sound is short, bounded and quiet, reduced or not", () => {
  assert.ok(MASTER_GAIN <= 0.2, "master volume stays modest");
  for (const name of SOUNDS) {
    for (const reduced of [false, true]) {
      const events = planSound(name, reduced);
      assert.ok(events.length > 0 && events.length <= MAX_EVENTS, `${name} event count`);
      assert.ok(soundLength(events) <= MAX_SOUND_SECONDS, `${name} length`);
      for (const e of events) {
        assert.ok(e.gain > 0 && e.gain <= 1, `${name} gain`);
        assert.ok(e.dur > 0 && e.at >= 0, `${name} timing`);
        if (e.kind !== "noise") assert.ok(e.freq >= 20 && e.freq <= 4000, `${name} freq`);
      }
    }
  }
});

test("reduced motion shortens the disk sound to a click", () => {
  assert.ok(soundLength(planSound("disk", true)) < 0.5);
  assert.ok(soundLength(planSound("disk", false)) > 1);
});

test("sounds are rate limited per name", () => {
  const last: Partial<Record<SoundName, number>> = {};
  assert.ok(allowSound("key", 1000, last));
  last.key = 1000;
  assert.ok(!allowSound("key", 1000 + MIN_GAP_MS.key - 1, last));
  assert.ok(allowSound("key", 1000 + MIN_GAP_MS.key, last));
  assert.ok(allowSound("advance", 1001, last), "other sounds are independent");
});

test("sound defaults on, off for reduced motion, and a saved choice always wins", () => {
  assert.equal(initialSoundEnabled(null, false), true);
  assert.equal(initialSoundEnabled(null, true), false);
  assert.equal(initialSoundEnabled("on", true), true);
  assert.equal(initialSoundEnabled("off", false), false);
  assert.equal(initialSoundEnabled("garbage", false), true);
});

test("boot flow goes empty -> inserting -> loading -> ready -> launching, and ignores out-of-order actions", () => {
  let phase: BootPhase = "empty";
  for (const [type, expected] of [["insert", "inserting"], ["inserted", "loading"], ["loaded", "ready"], ["run", "launching"]] as const) {
    phase = bootReducer(phase, { type });
    assert.equal(phase, expected);
  }
  assert.equal(bootReducer("empty", { type: "run" }), "empty", "can't run without a disk");
  assert.equal(bootReducer("empty", { type: "loaded" }), "empty");
  assert.equal(bootReducer("ready", { type: "insert" }), "ready");
  assert.equal(bootReducer("ready", { type: "eject" }), "empty");
  assert.equal(bootReducer("launching", { type: "eject" }), "launching", "can't pull the disk mid sign-in");
});

test("terminal commands: Enter or RUN signs in, anything else is a friendly error", () => {
  for (const ok of ["", "  ", "run", " Run ", "START", "go", "sign in"]) assert.equal(parseCommand(ok).kind, "run", JSON.stringify(ok));
  assert.equal(parseCommand("help").kind, "help");
  assert.equal(parseCommand("?").kind, "help");
  assert.deepEqual(parseCommand("format c:"), { kind: "unknown", text: "FORMAT C:" });
});

test("terminal copy fits a 28-column screen", () => {
  for (const line of [...EMPTY_LINES, ...LOAD_LINES, ...HELP_LINES, ...SYNTAX_LINES, "CONNECTING TO LINEAR...", "> HELP"]) assert.ok(line.length <= 28, line);
});

test("phosphor and case text meet WCAG contrast", () => {
  const dim = over(PALETTE.phosphor, DIM_TEXT_ALPHA, PALETTE.screen);
  for (const fg of [PALETTE.phosphor, PALETTE.amber, dim]) assert.ok(contrastRatio(fg, PALETTE.screen) >= 7, `${fg} on screen`);
  assert.ok(contrastRatio(PALETTE.ink, PALETTE.case) >= 7, "ink on case");
  assert.ok(contrastRatio("#020703", PALETTE.phosphor) >= 7, "inverted terminal button");
});

test("every card accent is one of the two phosphors", () => {
  const allowed = new Set<string>([PALETTE.phosphor, PALETTE.amber]);
  for (const id of CARD_IDS) for (const c of CARD_ACCENTS[id]) assert.ok(allowed.has(c), `${id} ${c}`);
});

test("the supplied PET photo matches the numbers the terminal overlay is pinned with", async () => {
  const { readFileSync } = await import("node:fs");
  const { PET_ART, PET_SCREEN, PET_VIEWS } = await import("./art.ts");
  const png = readFileSync(new URL("../../../public/retro/pet.png", import.meta.url));
  assert.equal(png.readUInt32BE(16), PET_ART.width);
  assert.equal(png.readUInt32BE(20), PET_ART.height);
  const s = PET_SCREEN;
  assert.ok(s.x > 0 && s.y > 0 && s.x + s.w < 1 && s.y + s.h < 1);
  // The measured black CRT opening (x 596-1075, y 148-441) must contain the overlay.
  assert.ok(s.x * PET_ART.width >= 596 && (s.x + s.w) * PET_ART.width <= 1075);
  assert.ok(s.y * PET_ART.height >= 148 && (s.y + s.h) * PET_ART.height <= 441);
  // The phone crop keeps the whole screen in view.
  const v = PET_VIEWS.tight;
  assert.ok(v.x <= s.x && v.y <= s.y && v.x + v.w >= s.x + s.w && v.y + v.h >= s.y + s.h);
});
