import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_COMPLETIONS, classifyArchetype } from "./archetype.ts";
import { computeStats, type IssueNode } from "./compute.ts";

type C = Parameters<typeof classifyArchetype>[0]["completions"];
const counts = (total: number, o: Partial<Pick<C, "after9pm" | "before9am" | "friday" | "weekend">> = {}) => ({
  totalClosed: total,
  timeZone: "UTC",
  completions: { timestamps: [], byHour: [], byWeekday: [], after9pm: 0, before9am: 0, friday: 0, weekend: 0, ...o },
});
const id = (total: number, o?: Parameters<typeof counts>[1]) => classifyArchetype(counts(total, o)).id;

test("each class at its threshold", () => {
  assert.equal(id(20, { after9pm: 7 }), "night-owl");
  assert.equal(id(20, { before9am: 7 }), "early-bird");
  assert.equal(id(20, { friday: 6 }), "friday-shipper");
  assert.equal(id(20, { weekend: 4 }), "weekend-warrior");
});

test("just below each threshold falls back to Steady Builder", () => {
  assert.equal(id(20, { after9pm: 6 }), "steady-builder");
  assert.equal(id(20, { before9am: 6 }), "steady-builder");
  assert.equal(id(20, { friday: 5 }), "steady-builder");
  assert.equal(id(20, { weekend: 3 }), "steady-builder");
});

test("sparse and zero data default to Steady Builder", () => {
  const zero = classifyArchetype(counts(0));
  assert.equal(zero.id, "steady-builder");
  assert.equal(zero.reason, "insufficient-data");
  assert.equal(zero.basis.traits.every((t) => t.sharePercent === 0), true);
  const sparse = classifyArchetype(counts(MIN_COMPLETIONS - 1, { after9pm: MIN_COMPLETIONS - 1 }));
  assert.equal(sparse.id, "steady-builder");
  assert.equal(sparse.reason, "insufficient-data");
  assert.equal(id(MIN_COMPLETIONS, { after9pm: MIN_COMPLETIONS }), "night-owl");
});

test("overlap: strongest relative to its threshold wins", () => {
  // night 40% (1.14x) vs weekend 60% (3x)
  assert.equal(id(20, { after9pm: 8, weekend: 12 }), "weekend-warrior");
  // night 10/20=50% (1.43x) vs friday 7/20=35% (1.17x)
  assert.equal(id(20, { after9pm: 10, friday: 7 }), "night-owl");
});

test("exact ties break on fixed order", () => {
  // night 7/20 = 35% (1x) and early 7/20 = 35% (1x)
  assert.equal(id(20, { after9pm: 7, before9am: 7 }), "night-owl");
  // early 7/20 (1x) vs friday 6/20 (1x)
  assert.equal(id(20, { before9am: 7, friday: 6 }), "early-bird");
  // weekend 4/20 (1x) vs friday 6/20 (1x)
  assert.equal(id(20, { weekend: 4, friday: 6 }), "weekend-warrior");
  // all four tied at 1x
  assert.equal(id(100, { after9pm: 35, before9am: 35, friday: 30, weekend: 20 }), "night-owl");
});

test("output is deterministic, JSON-safe and carries card copy", () => {
  const a = classifyArchetype(counts(20, { friday: 9 }));
  assert.deepEqual(a, classifyArchetype(counts(20, { friday: 9 })));
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  assert.equal(a.name, "Friday Shipper");
  assert.equal(a.reason, "threshold-met");
  assert.ok(a.tagline.length > 0 && a.description.length > 0);
  assert.equal(a.basis.traits.find((t) => t.id === "friday-shipper")?.sharePercent, 45);
});

const me = { id: "me", name: "Me", displayName: "me", avatarUrl: null };
let n = 0;
const issue = (completedAt: string): IssueNode => ({
  id: `a${n++}`,
  completedAt,
  project: null,
  labels: { nodes: [] },
  creator: me,
  assignee: me,
});
const stats = (times: string[], timezone: string) =>
  computeStats({
    year: 2026,
    now: new Date("2026-11-01T00:00:00Z"),
    viewer: { ...me, timezone, organization: null },
    assignedCompleted: times.map(issue),
    createdCompleted: [],
    openAssigned: [],
    integrations: { status: "ok", services: [] },
    truncated: false,
  });

test("time boundaries: 21:00 counts as night, 20:59 does not; 09:00 is not early", () => {
  // 2026-03-04 is a Wednesday.
  const night = Array.from({ length: 10 }, (_, i) => `2026-03-0${(i % 3) + 2}T21:00:00Z`);
  assert.equal(stats(night, "UTC").archetype.id, "night-owl");
  const notNight = Array.from({ length: 10 }, () => "2026-03-04T20:59:00Z");
  assert.equal(stats(notNight, "UTC").archetype.id, "steady-builder");
  const nine = Array.from({ length: 10 }, () => "2026-03-04T09:00:00Z");
  assert.equal(stats(nine, "UTC").archetype.id, "steady-builder");
  const eight = Array.from({ length: 10 }, () => "2026-03-04T08:59:00Z");
  assert.equal(stats(eight, "UTC").archetype.id, "early-bird");
});

test("uses viewer-local time, not UTC", () => {
  // 03:00Z Wed (before US DST): 19:00 Tue in LA, 22:00 Tue in New York.
  const times = Array.from({ length: 10 }, () => "2026-03-04T03:00:00Z");
  assert.equal(stats(times, "UTC").archetype.id, "early-bird");
  assert.equal(stats(times, "America/Los_Angeles").archetype.id, "steady-builder");
  assert.equal(stats(times, "America/New_York").archetype.id, "night-owl"); // 22:00 local (EST)
  const fri = Array.from({ length: 10 }, () => "2026-03-06T15:00:00Z"); // Fri UTC, Sat 04:00 Auckland
  assert.equal(stats(fri, "UTC").archetype.id, "friday-shipper");
  // Saturday 04:00 local: weekend (5x threshold) outranks early bird (~2.9x).
  assert.equal(stats(fri, "Pacific/Auckland").archetype.id, "weekend-warrior");
});

test("payload integration: archetype and summary agree; zero issues is Steady Builder", () => {
  const s = stats([], "UTC");
  assert.equal(s.archetype.id, "steady-builder");
  assert.equal(s.summary.archetype, "steady-builder");
});
