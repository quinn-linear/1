import assert from "node:assert/strict";
import { test } from "node:test";
import { clampOffset, isOverSlot, seatedOffset, type Box } from "./drag.ts";
import { MIN_SCALE, chooseScale } from "./fit.ts";

const slot: Box = { left: 100, top: 100, width: 400, height: 40 };
const disk = (left: number, top: number): Box => ({ left, top, width: 170, height: 170 });

test("a disk counts as inserted when its leading edge reaches the slot and it is centred over it", () => {
  assert.ok(isOverSlot(disk(215, 120), slot));
  assert.ok(isOverSlot(disk(215, 140), slot), "edge exactly at the slot's lower edge");
  assert.ok(!isOverSlot(disk(215, 141), slot), "still below the slot");
  assert.ok(!isOverSlot(disk(600, 100), slot), "beside the drive");
});

test("the seated pose centres the disk on the slot with its leading edge inside it", () => {
  const rest = disk(300, 400);
  const o = seatedOffset(rest, slot);
  const seated = disk(rest.left + o.x, rest.top + o.y);
  assert.equal(seated.left + seated.width / 2, slot.left + slot.width / 2);
  assert.ok(seated.top > slot.top && seated.top < slot.top + slot.height);
  assert.ok(isOverSlot(seated, slot), "the seated pose is itself a valid drop");
});

test("dragging can't fling the disk off screen", () => {
  const o = clampOffset(disk(300, 400), -9999, 9999, { width: 1000, height: 800 });
  assert.equal(300 + o.x, 0);
  assert.equal(400 + o.y + 170, 800);
});

test("fit picks the largest scale whose content fits, and reports when none does", () => {
  assert.deepEqual(chooseScale(500, () => 300), { scale: 1, overflow: false });
  const half = chooseScale(300, (s) => 600 / (1 + (1 - s) * 2)); // reflowing wider shortens the content
  assert.ok(half.scale < 1 && half.scale >= MIN_SCALE && !half.overflow);
  assert.ok(half.scale > 0.6, "picks the largest that fits, not the smallest");
  assert.deepEqual(chooseScale(100, () => 5000), { scale: MIN_SCALE, overflow: true });
  assert.deepEqual(chooseScale(0, () => 10), { scale: 1, overflow: false }, "an unmeasured space never collapses the card");
});
