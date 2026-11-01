import assert from "node:assert/strict";
import { test } from "node:test";
import { BEAM_POLYGON, PET_ART, PET_BEAM, PET_SCREEN } from "./art.ts";
import { MAX_ALPHA, MAX_RADIUS, MOTE_COUNT, makeMotes, moteAt, pointInPolygon, staticFrame } from "./dust.ts";

test("the motes are sparse, deterministic, and start inside the lamp's beam", () => {
  const a = makeMotes(BEAM_POLYGON);
  assert.equal(a.length, MOTE_COUNT);
  assert.ok(MOTE_COUNT <= 40, "a sprinkling, not a snowfall");
  assert.deepEqual(a, makeMotes(BEAM_POLYGON), "same specks every render");
  for (const m of a) assert.ok(pointInPolygon(m.x, m.y, BEAM_POLYGON), `(${m.x.toFixed(2)}, ${m.y.toFixed(2)}) is in the beam`);
});

test("the beam box sits on the lamp side of the picture and never reaches the CRT or the keyboard", () => {
  assert.ok(PET_BEAM.x + PET_BEAM.w < PET_SCREEN.x, "left of the screen");
  assert.ok(PET_BEAM.x >= 0 && PET_BEAM.y >= 0 && PET_BEAM.y + PET_BEAM.h <= 0.65, "upper and middle left");
  assert.ok(PET_BEAM.w * PET_ART.width < 450 && PET_BEAM.h * PET_ART.height < 400, "a small region, not full screen");
  assert.ok(BEAM_POLYGON.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1));
});

test("motes are small, soft and drift slowly, with no pops or flicker", () => {
  const motes = makeMotes(BEAM_POLYGON);
  for (const m of motes) {
    let prev = moteAt(m, 0);
    let maxRate = 0;
    let maxStep = 0;
    for (let t = 0.05; t <= 200; t += 0.05) {
      const f = moteAt(m, t);
      assert.ok(f.a >= 0 && f.a <= MAX_ALPHA, `alpha ${f.a}`);
      assert.ok(f.r <= MAX_RADIUS && f.r >= 0.9, `radius ${f.r}`);
      maxRate = Math.max(maxRate, Math.abs(f.a - prev.a) / 0.05);
      // A mote restarts its path while fully faded out; only movement you could see counts.
      if (f.a > 0.003 && prev.a > 0.003) maxStep = Math.max(maxStep, Math.hypot(f.x - prev.x, f.y - prev.y) / 0.05);
      assert.ok(f.x > -0.15 && f.x < 1.15 && f.y > -0.15 && f.y < 1.15, "stays near the beam");
      prev = f;
    }
    assert.ok(maxRate < 0.15, `brightness changes slowly (${maxRate.toFixed(3)}/s), never a strobe`);
    assert.ok(maxStep < 0.06, `moves slowly (${maxStep.toFixed(3)} box/s)`);
  }
});

test("reduced motion draws one still, dimmer frame at the mote's own position", () => {
  for (const m of makeMotes(BEAM_POLYGON)) {
    const f = staticFrame(m);
    assert.equal(f.x, m.x);
    assert.equal(f.y, m.y);
    assert.ok(f.a <= MAX_ALPHA * 0.5 + 1e-9);
  }
});
