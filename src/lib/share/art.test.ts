import assert from "node:assert/strict";
import test from "node:test";
import { daysInYear, polygonPoints, sparkles } from "./art.ts";

test("daysInYear handles leap years", () => {
  assert.equal(daysInYear(2026), 365);
  assert.equal(daysInYear(2028), 366);
  assert.equal(daysInYear(2100), 365);
  assert.equal(daysInYear(2000), 366);
});

test("sparkles are deterministic and stay inside the unit square", () => {
  const a = sparkles(20, 3);
  assert.deepEqual(a, sparkles(20, 3));
  for (const g of a) assert.ok(g.x >= 0 && g.x <= 1 && g.y >= 0 && g.y <= 1 && g.o > 0 && g.o <= 1);
});

test("polygonPoints returns one vertex per side", () => {
  assert.equal(polygonPoints(100, 7, 40, 0).split(" ").length, 7);
});
