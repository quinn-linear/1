import assert from "node:assert/strict";
import { test } from "node:test";
import { CARD_IDS } from "../recap.ts";
import { CARD_ACCENTS } from "../share/theme.ts";
import { ACCESS_GRANTED, CONNECTING, GRANT_HOLD_MS, GRANT_HOLD_REDUCED_MS, grantHold, grantReducer, type GrantPhase } from "./cassette.ts";
import { BOOT_LABEL, BOOT_LINES, BOOT_TITLE, LOGO_BANDS, LOGO_RADIUS, LOGO_VIEWBOX, bootDuration, bootSchedule, insideLogo, logoRows, logoSchedule } from "./logo.ts";
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

test("grant flow: grab, hover over the computer, release over it -> granted -> launching", () => {
  let phase: GrantPhase = "idle";
  for (const [action, expected] of [
    [{ type: "grab" }, "dragging"],
    [{ type: "enter" }, "over"],
    [{ type: "release", over: true }, "granted"],
    [{ type: "launch" }, "launching"],
  ] as const) {
    phase = grantReducer(phase, action);
    assert.equal(phase, expected);
  }
});

test("a release outside the computer, or a cancelled drag, goes back to idle with no grant", () => {
  assert.equal(grantReducer("dragging", { type: "release", over: false }), "idle");
  assert.equal(grantReducer("over", { type: "release", over: false }), "idle", "left it just before letting go");
  assert.equal(grantReducer("over", { type: "cancel" }), "idle");
  assert.equal(grantReducer("dragging", { type: "cancel" }), "idle");
  assert.equal(grantReducer("over", { type: "leave" }), "dragging");
  assert.equal(grantReducer("idle", { type: "enter" }), "idle", "can't hover without holding it");
  assert.equal(grantReducer("idle", { type: "launch" }), "idle", "can't launch without a grant");
});

test("tap or keyboard activation is the same grant, and nothing can grant twice", () => {
  assert.equal(grantReducer("idle", { type: "activate" }), "granted");
  for (const phase of ["granted", "launching"] as const) {
    for (const type of ["grab", "enter", "activate", "cancel"] as const) assert.equal(grantReducer(phase, { type }), phase, `${phase} ignores ${type}`);
    assert.equal(grantReducer(phase, { type: "release", over: true }), phase);
  }
  assert.equal(grantReducer("dragging", { type: "activate" }), "dragging", "a held cassette is released, not activated");
  assert.equal(grantReducer("launching", { type: "reset" }), "idle", "coming back from Linear via the back button starts over");
});

test("the message is exactly ACCESS GRANTED, fits the screen, and holds long enough to read but not forever", () => {
  assert.equal(ACCESS_GRANTED, "ACCESS GRANTED");
  assert.ok(CONNECTING.length <= 28);
  assert.ok(grantHold(false) === GRANT_HOLD_MS && GRANT_HOLD_MS >= 1000 && GRANT_HOLD_MS <= 2000);
  assert.ok(grantHold(true) === GRANT_HOLD_REDUCED_MS && GRANT_HOLD_REDUCED_MS < GRANT_HOLD_MS && GRANT_HOLD_REDUCED_MS >= 400);
});

test("phosphor and case text meet WCAG contrast", () => {
  const dim = over(PALETTE.phosphor, DIM_TEXT_ALPHA, PALETTE.screen);
  for (const fg of [PALETTE.phosphor, PALETTE.lavender, PALETTE.amber, dim]) assert.ok(contrastRatio(fg, PALETTE.screen) >= 7, `${fg} on screen`);
  assert.ok(contrastRatio(PALETTE.ink, PALETTE.case) >= 7, "ink on case");
  assert.ok(contrastRatio(PALETTE.screen, PALETTE.phosphor) >= 7, "inverted terminal button");
});

test("every card accent is the lavender or amber accent", () => {
  const allowed = new Set<string>([PALETTE.lavender, PALETTE.amber]);
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

const parse = (points: string) => points.split(" ").map((p) => p.split(",").map(Number) as [number, number]);

test("the boot logo is a true circle in a square box: same width and height, and the radius fits inside", () => {
  assert.ok(LOGO_RADIUS * 2 < LOGO_VIEWBOX && LOGO_RADIUS > LOGO_VIEWBOX * 0.4, "a large disc with a margin so its edge is never clipped");
  // The lit area, clipped to the disc, spans the same distance across and down.
  const lit = logoRows().flatMap((r) => r.polygons.flatMap(parse));
  const inDisc = lit.filter(([x, y]) => insideLogo(x, y));
  assert.ok(inDisc.length > 0);
  const xs = inDisc.map(([px]) => px);
  const ys = inDisc.map(([, py]) => py);
  assert.ok(Math.max(...ys) - Math.min(...ys) > LOGO_RADIUS, "spans down the circle");
  assert.ok(Math.max(...xs) - Math.min(...xs) > LOGO_RADIUS, "and across it");
  // Nothing is drawn further from the centre than the circle's own bounding square, so the clip makes a round (not oval) shape.
  const box = LOGO_VIEWBOX / 2 + LOGO_RADIUS;
  assert.ok(Math.max(...lit.map(([, py]) => py)) <= box + 3 && Math.min(...lit.map(([, py]) => py)) >= LOGO_VIEWBOX / 2 - LOGO_RADIUS - 3);
});

test("the boot logo is 17 thin scanline bands, evenly spaced from the top of the circle to the bottom", () => {
  const rows = logoRows();
  assert.equal(rows.length, LOGO_BANDS);
  assert.equal(LOGO_BANDS, 17);
  const pitch = rows.slice(1).map((r, i) => (r.top + r.bottom) / 2 - (rows[i].top + rows[i].bottom) / 2);
  for (const p of pitch) assert.ok(Math.abs(p - pitch[0]) < 0.02, "even pitch");
  for (const r of rows) assert.ok(r.bottom > r.top && r.bottom - r.top < pitch[0], "each band is thinner than its pitch, so dark gaps separate them");
  // Bands are in order and never overlap.
  rows.slice(1).forEach((r, i) => assert.ok(r.top > rows[i].bottom));
  // First and last bands are centred on the circle's top and bottom edge (slivers once clipped).
  assert.ok(Math.abs((rows[0].top + rows[0].bottom) / 2 - (LOGO_VIEWBOX / 2 - LOGO_RADIUS)) < 0.02);
  assert.ok(Math.abs((rows[16].top + rows[16].bottom) / 2 - (LOGO_VIEWBOX / 2 + LOGO_RADIUS)) < 0.02);
});

test("the diagonal cuts lean at 45 degrees and leave three strips beside the main body", () => {
  const rows = logoRows();
  for (const r of rows) {
    assert.equal(r.polygons.length, 4, "main body plus three strips in every band");
    for (const poly of r.polygons) {
      const [tl, tr, br, bl] = parse(poly);
      // Parallelogram: horizontal top and bottom, edges that move right by exactly the band's height (45 degrees, down and to the right).
      assert.equal(tl[1], tr[1]);
      assert.equal(bl[1], br[1]);
      const h = bl[1] - tl[1];
      assert.ok(Math.abs(bl[0] - tl[0] - h) < 0.02 && Math.abs(br[0] - tr[0] - h) < 0.02);
    }
  }
  // In a band through the lower-left, the pieces are separated by gaps about as wide as the pieces themselves.
  const row = rows[10];
  const spans = row.polygons.map((p) => parse(p)).map(([tl, tr]) => [tl[0], tr[0]]).sort((a, b) => a[0] - b[0]);
  const strips = spans.slice(0, 3);
  const gaps = [strips[1][0] - strips[0][1], strips[2][0] - strips[1][1], spans[3][0] - strips[2][1]];
  for (const g of gaps) assert.ok(g > 0, "pieces do not touch");
  for (const g of gaps) assert.ok(Math.abs(g - (strips[0][1] - strips[0][0])) < LOGO_RADIUS * 0.1);
  // The cuts are in the lower-left: near the top only the main body crosses the circle, near the bottom-left all the strips do.
  const crosses = (r: (typeof rows)[number]) => {
    const y = (r.top + r.bottom) / 2;
    const half = Math.sqrt(LOGO_RADIUS ** 2 - (y - LOGO_VIEWBOX / 2) ** 2);
    const [cl, cr] = [LOGO_VIEWBOX / 2 - half, LOGO_VIEWBOX / 2 + half];
    return r.polygons.map(parse).filter(([tl, tr, br, bl]) => Math.max(tl[0], bl[0]) < cr && Math.min(tr[0], br[0]) > cl).length;
  };
  assert.equal(crosses(rows[2]), 1, "top: the main body alone");
  assert.ok(crosses(rows[12]) >= 3, "lower-left: main body plus strips");
});

test("the mark reveals one band at a time from the top; reduced motion or a skip shows it at once", () => {
  const delays = logoSchedule(false);
  assert.equal(delays.length, LOGO_BANDS);
  delays.slice(1).forEach((d, i) => assert.ok(d > delays[i]));
  assert.ok(delays[delays.length - 1] <= 1000, "the whole mark appears in about a second at most");
  assert.ok(logoSchedule(true).every((d) => d === 0));
});

test("boot text uses the exact phrase, and every boot line fits the screen columns", () => {
  assert.equal(BOOT_TITLE, "Linear wrapped");
  assert.equal(BOOT_LABEL, "Linear wrapped");
  for (const line of [BOOT_TITLE, ...BOOT_LINES]) assert.ok(line.length <= 14, line);
});

test("boot lines reveal one after another, quickly; reduced motion or a skip shows them at once", () => {
  const count = BOOT_LINES.length + 1;
  const delays = bootSchedule(count, false);
  assert.equal(delays.length, count);
  for (let i = 1; i < count; i++) assert.ok(delays[i] > delays[i - 1], "line by line");
  assert.ok(bootDuration(count, false) <= 1000, "the whole boot is under a second");
  assert.deepEqual(bootSchedule(count, true), new Array(count).fill(0));
  assert.equal(bootDuration(count, true), 0);
});
