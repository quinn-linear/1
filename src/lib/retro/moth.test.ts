import assert from "node:assert/strict";
import { test } from "node:test";
import { BEAM_POLYGON } from "./art.ts";
import { pointInPolygon } from "./dust.ts";
import { EDGE, GAP_MAX, GAP_MIN, VISIT_MAX, VISIT_MIN, makeVisit, mothAt, nextGap } from "./moth.ts";

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

test("visits are short and the gaps between them long and varied", () => {
  const rnd = seeded(3);
  const gaps = new Set<number>();
  for (let i = 0; i < 100; i++) {
    const v = makeVisit(BEAM_POLYGON, rnd);
    assert.ok(v.duration >= VISIT_MIN && v.duration <= VISIT_MAX);
    const g = nextGap(rnd);
    assert.ok(g >= GAP_MIN && g <= GAP_MAX && g > VISIT_MAX, "quiet for longer than a visit");
    gaps.add(Math.round(g));
  }
  assert.ok(gaps.size > 10, "random, not periodic");
});

test("a visit starts and ends invisible, and the moth never leaves the beam's box", () => {
  const rnd = seeded(11);
  for (let i = 0; i < 40; i++) {
    const v = makeVisit(BEAM_POLYGON, rnd);
    assert.ok(pointInPolygon(v.from[0], v.from[1], BEAM_POLYGON) && pointInPolygon(v.to[0], v.to[1], BEAM_POLYGON), "arrives and leaves inside the beam");
    assert.equal(mothAt(v, -0.1), null);
    assert.equal(mothAt(v, v.duration + 0.1), null);
    assert.equal(mothAt(v, 0)?.a, 0);
    assert.equal(mothAt(v, v.duration)?.a, 0);
    let inBeam = 0;
    let n = 0;
    for (let t = 0; t <= v.duration; t += 0.05, n++) {
      const f = mothAt(v, t)!;
      assert.ok(f.x >= EDGE - 1e-9 && f.x <= 1 - EDGE + 1e-9 && f.y >= EDGE - 1e-9 && f.y <= 1 - EDGE + 1e-9, "inside the canvas");
      assert.ok(f.a >= 0 && f.a <= 0.9 && f.open >= 0 && f.open <= 1);
      if (pointInPolygon(f.x, f.y, BEAM_POLYGON)) inBeam++;
    }
    assert.ok(inBeam / n > 0.7, `stays mostly in the light (${((inBeam / n) * 100).toFixed(0)}%)`);
  }
});

test("it flutters gently: no jumps, wing beats under 8 Hz", () => {
  const rnd = seeded(5);
  for (let i = 0; i < 20; i++) {
    const v = makeVisit(BEAM_POLYGON, rnd);
    let prev = mothAt(v, 0.5)!;
    for (let t = 0.55; t < v.duration - 0.5; t += 0.05) {
      const f = mothAt(v, t)!;
      assert.ok(Math.hypot(f.x - prev.x, f.y - prev.y) / 0.05 < 0.5, "moves at a flutter's pace");
      prev = f;
    }
    assert.ok(v.beat <= 8);
  }
});
