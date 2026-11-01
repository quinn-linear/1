import assert from "node:assert/strict";
import { test } from "node:test";
import { centeredOffset, clampOffset, containsPoint, type Box } from "./drag.ts";
import { MIN_SCALE, chooseScale } from "./fit.ts";

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
