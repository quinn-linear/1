import assert from "node:assert/strict";
import { test } from "node:test";
import { BEAM_POLYGON } from "./art.ts";
import { pointInPolygon } from "./dust.ts";
import { EDGE, MOTH_COUNT, makeMoths, mothAt } from "./moth.ts";

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

test("there are exactly three moths, each with its own path, speed, wing beat and depth", () => {
  assert.equal(MOTH_COUNT, 3);
  for (let seed = 1; seed < 30; seed++) {
    const moths = makeMoths(seeded(seed));
    assert.equal(moths.length, 3);
    for (const key of ["fx", "fy", "beat", "pb", "px", "depth"] as const) assert.equal(new Set(moths.map((m) => m[key])).size, 3, `${key} differs`);
    // They are never in step: positions differ at every sampled moment.
    for (let t = 0; t < 30; t += 0.5) {
      const f = moths.map((m) => mothAt(m, t));
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(f[i].x !== f[j].x || f[i].y !== f[j].y);
    }
  }
});

test("the moths flutter around the light all the time, inside the beam's box and mostly in the beam", () => {
  for (let seed = 1; seed < 40; seed++) {
    for (const m of makeMoths(seeded(seed))) {
      let inBeam = 0;
      let n = 0;
      let minX = 1, maxX = 0, minY = 1, maxY = 0;
      for (let t = 0; t <= 120; t += 0.05, n++) {
        const f = mothAt(m, t);
        assert.ok(f.x >= EDGE - 1e-9 && f.x <= 1 - EDGE + 1e-9 && f.y >= EDGE - 1e-9 && f.y <= 1 - EDGE + 1e-9, "inside the canvas");
        assert.ok(f.a > 0.5 && f.a <= 0.9 && f.open >= 0 && f.open <= 1, "always visible");
        if (pointInPolygon(f.x, f.y, BEAM_POLYGON)) inBeam++;
        minX = Math.min(minX, f.x); maxX = Math.max(maxX, f.x); minY = Math.min(minY, f.y); maxY = Math.max(maxY, f.y);
      }
      assert.ok(inBeam / n > 0.8, `stays mostly in the light (${((inBeam / n) * 100).toFixed(0)}%)`);
      assert.ok(maxX - minX > 0.08 && maxY - minY > 0.06, "actually moves around");
    }
  }
});

test("they flutter gently: no jumps, wing beats under 8 Hz", () => {
  for (let seed = 1; seed < 20; seed++) {
    for (const m of makeMoths(seeded(seed))) {
      let prev = mothAt(m, 0);
      for (let t = 0.05; t < 60; t += 0.05) {
        const f = mothAt(m, t);
        assert.ok(Math.hypot(f.x - prev.x, f.y - prev.y) / 0.05 < 0.5, "moves at a flutter's pace");
        prev = f;
      }
      assert.ok(m.beat <= 8);
    }
  }
});
