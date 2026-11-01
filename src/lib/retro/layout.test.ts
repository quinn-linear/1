import assert from "node:assert/strict";
import { test } from "node:test";
import { centeredOffset, clampOffset, containsPoint, isIntentionalDrop, startIntent, updateIntent, type Box } from "./drag.ts";
import { MIN_SCALE, chooseScale } from "./fit.ts";
import { CASSETTE_REST, PET_ART, PET_COMPUTER, PET_DROP, PET_FOCUS, PET_NOTEPAD, PET_SCREEN } from "./art.ts";
import { coverPlacement, mapRect, restingBox, scenePlacement, sceneRestingBox } from "./cover.ts";

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

test("the drop target is the whole computer plus a little forgiveness, and stays clear of the resting tape at several sizes", () => {
  for (const [w, h] of [[1440, 900], [1280, 720], [844, 390], [390, 844]] as const) {
    const v = view(w, h);
    const p = coverPlacement(v, PET_ART, PET_FOCUS, PET_SCREEN);
    const drop = mapRect(p, PET_DROP);
    const px = (fx: number, fy: number) => [p.left + (fx / 1672) * p.width, p.top + (fy / 941) * p.height] as const;
    // Screen, keyboard, built-in cassette deck and the case's lower edge are all inside.
    for (const [fx, fy] of [[826, 340], [970, 690], [570, 650], [800, 820]] as const) assert.ok(containsPoint(drop, ...px(fx, fy)), `${w}x${h}: (${fx}, ${fy}) is a valid drop`);
    // A little forgiveness just outside the case counts; well away from it does not.
    assert.ok(containsPoint(drop, ...px(365 - 12, 700)) && containsPoint(drop, ...px(1265 + 12, 700)));
    assert.ok(!containsPoint(drop, ...px(100, 700)) && !containsPoint(drop, ...px(1440, 760)) && !containsPoint(drop, ...px(826, 60)), `${w}x${h}: clear of the lamp, the notepad and the wall`);
    // Desktop-like crops keep the resting tape's centre outside it.
    if (w >= 844 && h <= 900) {
      const t = restingBox(p, CASSETTE_REST, v);
      assert.ok(!containsPoint(drop, t.left + t.width / 2, t.top + t.height / 2), `${w}x${h}: the tape at rest is not over the target`);
    }
  }
});

test("a drop needs a meaningful drag that enters the target; releasing where the tape lies does not sign in", () => {
  const W = 200;
  // Released at once where it lay, even if that spot is over the computer (phone crop): no.
  let i = startIntent(300, 300, true);
  assert.equal(isIntentionalDrop(updateIntent(i, 302, 301, true), true, W), false, "a nudge in place");
  // Started over the target, dragged a long way inside it without leaving: still no.
  i = updateIntent(startIntent(300, 300, true), 450, 360, true);
  assert.equal(isIntentionalDrop(i, true, W), false, "never entered from outside");
  // Left and came back: yes.
  i = updateIntent(updateIntent(updateIntent(startIntent(300, 300, true), 100, 300, false), 450, 300, true), 450, 300, true);
  assert.equal(isIntentionalDrop(i, true, W), true);
  // From outside into the target far enough: yes. Too short a move into it: no. Released outside: no.
  i = updateIntent(updateIntent(startIntent(900, 700, false), 700, 650, false), 500, 600, true);
  assert.equal(isIntentionalDrop(i, true, W), true);
  assert.equal(isIntentionalDrop(updateIntent(updateIntent(startIntent(900, 700, false), 880, 700, true), 880, 700, true), true, W), false, "too short");
  assert.equal(isIntentionalDrop(i, false, W), false, "released outside");
  // A wider tape needs a longer pull.
  assert.equal(isIntentionalDrop({ ...i, reach: 120 }, true, 300), false);
});

test("the whole computer is on screen, unstretched, on every phone and desktop size; desktop keeps the full-bleed cover", () => {
  for (const [w, h] of [[320, 568], [375, 667], [390, 844], [430, 932], [844, 390], [667, 375], [932, 430], [1440, 900], [1920, 1080]] as const) {
    const v = view(w, h);
    const p = scenePlacement(v, PET_ART, PET_FOCUS, PET_SCREEN, PET_COMPUTER);
    const c = mapRect(p, PET_COMPUTER);
    assert.ok(c.left >= 0 && c.top >= 0 && c.left + c.width <= w + 1e-6 && c.top + c.height <= h + 1e-6, `${w}x${h}: computer whole`);
    assert.ok(Math.abs(p.width / p.height - PET_ART.width / PET_ART.height) < 1e-9, `${w}x${h}: aspect ratio`);
    const d = mapRect(p, PET_DROP);
    assert.ok(d.left + d.width > c.left && d.width >= c.width, "drop target covers it");
    if (w >= 1440) assert.deepEqual(p, coverPlacement(v, PET_ART, PET_FOCUS, PET_SCREEN), `${w}x${h}: full bleed`);
    // Wherever the picture does not reach a viewport edge it is flagged to fade out, and it never leaves a gap otherwise.
    assert.equal(!!p.gapX, p.left > 0.5 || p.left + p.width < w - 0.5);
    assert.equal(!!p.gapY, p.top > 0.5 || p.top + p.height < h - 0.5);
  }
});

test("an upright phone shows the whole case with a big, reachable tape clear of the drop target", () => {
  for (const [w, h] of [[320, 568], [375, 667], [390, 844], [430, 932]] as const) {
    const v = view(w, h);
    const p = scenePlacement(v, PET_ART, PET_FOCUS, PET_SCREEN, PET_COMPUTER);
    const t = sceneRestingBox(p, CASSETTE_REST, PET_DROP, PET_NOTEPAD, v);
    const drop = mapRect(p, PET_DROP);
    assert.ok(t.left >= 0 && t.left + t.width <= w && t.top >= 0 && t.top + t.height <= h, `${w}x${h}: tape on screen`);
    assert.ok(t.width >= 100 && t.height >= 44, `${w}x${h}: tape easy to hit (${t.width}x${t.height})`);
    assert.ok(t.top >= drop.top + drop.height || t.top + t.height <= drop.top, `${w}x${h}: tape clear of the drop target`);
    const dist = Math.abs(t.top + t.height / 2 - (drop.top + drop.height / 2));
    assert.ok(dist >= Math.max(56, t.width * 0.6), `${w}x${h}: a meaningful drag (${dist | 0}px)`);
  }
});
