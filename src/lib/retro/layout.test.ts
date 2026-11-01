import assert from "node:assert/strict";
import { test } from "node:test";
import { centeredOffset, clampOffset, containsPoint, type Box } from "./drag.ts";
import { MIN_SCALE, chooseScale } from "./fit.ts";
import { CASSETTE_REST, PET_ART, PET_COMPUTER, PET_FOCUS, PET_NOTEPAD, PET_SCREEN } from "./art.ts";
import { coverPlacement, mapRect, restingBox } from "./cover.ts";

const CASSETTE_REST_RATIO = (CASSETTE_REST.w * PET_ART.width) / (CASSETTE_REST.h * PET_ART.height);

const computer: Box = { left: 100, top: 50, width: 500, height: 400 };
const tape: Box = { left: 300, top: 500, width: 200, height: 130 };

test("the pointer counts as over the computer anywhere inside its measured box, edges included", () => {
  assert.ok(containsPoint(computer, 350, 250));
  assert.ok(containsPoint(computer, 100, 50) && containsPoint(computer, 600, 450), "corners");
  assert.ok(!containsPoint(computer, 99, 250) && !containsPoint(computer, 601, 250), "beside it");
  assert.ok(!containsPoint(computer, 350, 49) && !containsPoint(computer, 350, 451), "above and below it");
  // The box is measured live, so a different (responsive) layout moves the target with it.
  assert.ok(!containsPoint({ ...computer, left: 700 }, 350, 250));
  assert.ok(containsPoint({ ...computer, left: 700 }, 750, 250));
});

test("a tapped cassette flies to the centre of the computer", () => {
  const o = centeredOffset(tape, computer);
  const arrived: Box = { ...tape, left: tape.left + o.x, top: tape.top + o.y };
  assert.equal(arrived.left + arrived.width / 2, computer.left + computer.width / 2);
  assert.equal(arrived.top + arrived.height / 2, computer.top + computer.height / 2);
  assert.ok(containsPoint(computer, arrived.left + arrived.width / 2, arrived.top + arrived.height / 2));
});

test("dragging can't fling the cassette off screen", () => {
  const o = clampOffset(tape, -9999, 9999, { width: 1000, height: 800 });
  assert.equal(tape.left + o.x, 0);
  assert.equal(tape.top + o.y + tape.height, 800);
});

test("fit picks the largest scale whose content fits, and reports when none does", () => {
  assert.deepEqual(chooseScale(500, () => 300), { scale: 1, overflow: false });
  const half = chooseScale(300, (s) => 600 / (1 + (1 - s) * 2)); // reflowing wider shortens the content
  assert.ok(half.scale < 1 && half.scale >= MIN_SCALE && !half.overflow);
  assert.ok(half.scale > 0.6, "picks the largest that fits, not the smallest");
  assert.deepEqual(chooseScale(100, () => 5000), { scale: MIN_SCALE, overflow: true });
  assert.deepEqual(chooseScale(0, () => 10), { scale: 1, overflow: false }, "an unmeasured space never collapses the card");
});

const view = (width: number, height: number) => ({ width, height });
const SCREEN_CENTRE = { x: PET_SCREEN.x + PET_SCREEN.w / 2, y: PET_SCREEN.y + PET_SCREEN.h / 2 };

test("the picture covers every viewport edge to edge without stretching", () => {
  for (const [w, h] of [[1440, 900], [1920, 1080], [2560, 1080], [390, 844], [360, 640], [844, 390], [667, 375], [720, 450]]) {
    const p = coverPlacement(view(w, h), PET_ART, PET_FOCUS, PET_SCREEN);
    assert.ok(p.left <= 1e-6 && p.top <= 1e-6 && p.left + p.width >= w - 1e-6 && p.top + p.height >= h - 1e-6, `${w}x${h} covered`);
    assert.ok(Math.abs(p.width / p.height - PET_ART.width / PET_ART.height) < 1e-9, `${w}x${h} keeps its aspect ratio`);
    assert.ok(Math.abs(p.scale * PET_ART.width - p.width) < 1e-6);
  }
});

test("the glass and the notepad stay in view whenever both fit, and the glass always does", () => {
  for (const [w, h] of [[1440, 900], [1280, 720], [1920, 1080], [844, 390], [667, 375], [720, 450], [768, 1024]]) {
    const p = coverPlacement(view(w, h), PET_ART, PET_FOCUS, PET_SCREEN);
    const glass = mapRect(p, PET_SCREEN);
    assert.ok(glass.left >= -1 && glass.top >= 0 && glass.left + glass.width <= w + 1 && glass.top + glass.height <= h, `${w}x${h} glass`);
    if (w >= h) {
      const pad = mapRect(p, PET_NOTEPAD);
      assert.ok(pad.left + pad.width <= w + 1 && pad.top + pad.height <= h + 1, `${w}x${h} notepad`);
    }
  }
});

test("on a phone held upright the screen is centred and the tape is pulled back inside the screen", () => {
  const v = view(390, 844);
  const p = coverPlacement(v, PET_ART, PET_FOCUS, PET_SCREEN);
  const mid = p.left + SCREEN_CENTRE.x * p.width;
  assert.ok(Math.abs(mid - 195) < 1, "the glass is centred");
  const t = restingBox(p, CASSETTE_REST, v);
  assert.ok(t.left >= 12 - 1e-6 && t.left + t.width <= 390 - 12 + 1e-6 && t.top >= 12 && t.top + t.height <= 844 - 12 + 1e-6, "whole and on screen");
  assert.ok(t.width >= 96 && t.width <= 390 * 0.6 + 1e-6);
  assert.ok(Math.abs(t.width / t.height - CASSETTE_REST_RATIO) < 1e-6, "keeps the tape's shape");
});

test("on a desktop the tape lies on the notepad, and the notepad is outside the drop target", () => {
  const v = view(1440, 900);
  const p = coverPlacement(v, PET_ART, PET_FOCUS, PET_SCREEN);
  const t = restingBox(p, CASSETTE_REST, v);
  const pad = mapRect(p, PET_NOTEPAD);
  assert.ok(t.left >= pad.left && t.left + t.width <= pad.left + pad.width && t.top >= pad.top && t.top + t.height <= pad.top + pad.height, "on the notepad");
  const computer = mapRect(p, PET_COMPUTER);
  const cx = t.left + t.width / 2;
  const cy = t.top + t.height / 2;
  assert.ok(!containsPoint(computer, cx, cy), "resting is not over the computer");
  const glass = mapRect(p, PET_SCREEN);
  assert.ok(containsPoint(computer, glass.left + glass.width / 2, glass.top + glass.height / 2), "the glass is inside the drop target");
});

test("overlay boxes map through the same placement as the picture", () => {
  const p = coverPlacement(view(1440, 900), PET_ART, PET_FOCUS, PET_SCREEN);
  const b = mapRect(p, PET_SCREEN);
  assert.ok(Math.abs(b.width / p.width - PET_SCREEN.w) < 1e-9 && Math.abs((b.left - p.left) / p.width - PET_SCREEN.x) < 1e-9);
});
