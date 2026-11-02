import assert from "node:assert/strict";
import { test } from "node:test";
import { PET_ART, PET_COMPUTER, PET_DROP, PET_NOTEPAD, PET_SCREEN, PET_STEAM, CASSETTE_REST, STEAM_RIM } from "./art.ts";
import { coverPlacement, scenePlacement } from "./cover.ts";
import { MAX_ALPHA, makePuffs, puffAt, rimVisible, staticPuffs } from "./steam.ts";

const px = (f: { x: number; y: number }) => ({ x: (PET_STEAM.x + f.x * PET_STEAM.w) * PET_ART.width, y: (PET_STEAM.y + f.y * PET_STEAM.h) * PET_ART.height });

test("the rim sits on the cup's opening, measured from the picture", () => {
  const c = px(STEAM_RIM);
  assert.ok(Math.abs(c.x - 1400) < 1 && Math.abs(c.y - 485) < 1, `${c.x},${c.y}`);
  assert.ok(Math.abs(STEAM_RIM.rx * PET_STEAM.w * PET_ART.width - 77) < 1);
});

test("the steam box is clear of the screen, the notepad, the tape and the computer", () => {
  assert.ok(PET_STEAM.x > PET_SCREEN.x + PET_SCREEN.w);
  assert.ok(PET_STEAM.x >= PET_COMPUTER.x + PET_COMPUTER.w && PET_STEAM.x >= PET_DROP.x + PET_DROP.w - 0.001);
  assert.ok(PET_STEAM.y + PET_STEAM.h <= PET_NOTEPAD.y && PET_STEAM.y + PET_STEAM.h <= CASSETTE_REST.y);
  assert.ok(PET_STEAM.x + PET_STEAM.w <= 1);
});

test("puffs are born at the rim, rise, stay in the box, and are invisible at birth and death", () => {
  for (const p of makePuffs()) {
    let prevY = Infinity;
    for (let u = 0; u < 1; u += 0.01) {
      const f = puffAt(p, (u - p.phase) * p.period);
      assert.ok(f.x >= 0 && f.x <= 1 && f.y >= 0 && f.y <= 1, `inside the box at ${u}`);
      assert.ok(f.a >= 0 && f.a <= MAX_ALPHA);
      if (u > 0.02) assert.ok(f.y <= prevY + 1e-9, "only rises");
      prevY = f.y;
    }
    const birth = puffAt(p, -p.phase * p.period);
    assert.equal(birth.a, 0);
    assert.ok(Math.abs(birth.x - STEAM_RIM.x) <= STEAM_RIM.rx, "born over the opening");
    assert.ok(birth.y <= STEAM_RIM.y && birth.y >= STEAM_RIM.y - STEAM_RIM.ry, "at the rim");
    assert.ok(puffAt(p, (1 - p.phase) * p.period - 1e-9).a < 1e-6);
  }
});

test("the loop is seamless and staggered", () => {
  const puffs = makePuffs();
  for (const p of puffs) { const a = puffAt(p, 3.3); const b = puffAt(p, 3.3 + p.period); assert.ok(Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.a - b.a) < 1e-9); }
  const alphaSum = (t: number) => puffs.reduce((s, p) => s + puffAt(p, t).a, 0);
  assert.ok(alphaSum(0) > 0 && alphaSum(2.5) > 0, "always some steam");
  assert.ok(new Set(puffs.filter((p) => p.lane === 0).map((p) => p.phase)).size > 3, "staggered");
});

test("it moves visibly but gently, and stays restrained", () => {
  for (const p of makePuffs()) {
    const a = puffAt(p, 1);
    const b = puffAt(p, 2);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 0.001 || a.a < 0.01, "moves each second");
    for (let t = 0; t < p.period; t += 0.1) {
      const f = puffAt(p, t);
      const g = puffAt(p, t + 0.1);
      if (f.a > 0.002 && g.a > 0.002) assert.ok(Math.hypot(f.x - g.x, f.y - g.y) < 0.05, "no jumps while visible");
    }
  }
  assert.ok(MAX_ALPHA <= 0.25, "semi-transparent, not smoke");
});

test("reduced motion: one faint still column, deterministic", () => {
  const s = staticPuffs();
  assert.deepEqual(s, staticPuffs());
  assert.ok(s.length > 0 && s.every((f) => f.a > 0 && f.a <= MAX_ALPHA / 2 + 1e-9));
});

test("steam is only drawn when the cup's rim is inside the viewport crop", () => {
  const focus = { x: 560 / 1672, y: 150 / 941, w: 1080 / 1672, h: 740 / 941 };
  const at = (width: number, height: number) => rimVisible(scenePlacement({ width, height }, PET_ART, focus, PET_SCREEN, PET_COMPUTER), { width, height });
  assert.ok(at(1440, 900), "desktop");
  assert.ok(at(1280, 720), "laptop");
  assert.ok(at(844, 390), "phone landscape");
  assert.equal(at(390, 844), false, "upright phone frames the computer alone: the cup is cropped away");
  const wide = coverPlacement({ width: 300, height: 900 }, PET_ART, focus, PET_SCREEN);
  assert.equal(rimVisible(wide, { width: 300, height: 900 }), false, "cropped away");
});
