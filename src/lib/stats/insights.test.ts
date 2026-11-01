import assert from "node:assert/strict";
import { test } from "node:test";
import { computeStats, type IssueNode } from "./compute.ts";
import { addDays } from "./time.ts";

const me = { id: "me", name: "Me", displayName: "me", avatarUrl: null };
let n = 0;
const issue = (completedAt: string | null, extra: Partial<IssueNode> = {}): IssueNode => ({
  id: `i${String(n++).padStart(4, "0")}`,
  title: "Some work",
  completedAt,
  project: null,
  labels: { nodes: [] },
  creator: me,
  assignee: me,
  ...extra,
});

const build = (assigned: IssueNode[], over: { timezone?: string; now?: string; year?: number } = {}) =>
  computeStats({
    year: over.year ?? 2026,
    now: new Date(over.now ?? "2026-11-01T00:00:00Z"),
    viewer: { ...me, timezone: over.timezone ?? "UTC", organization: null },
    assignedCompleted: assigned,
    createdCompleted: [],
    openAssigned: [],
    integrations: { status: "ok", services: [] },
    truncated: false,
  });

/** `count` issues closed at noon UTC on each listed date. */
const on = (date: string, count = 1, extra: Partial<IssueNode> = {}) => Array.from({ length: count }, () => issue(`${date}T12:00:00Z`, extra));

test("addDays is calendar arithmetic", () => {
  assert.equal(addDays("2026-02-27", 2), "2026-03-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
});

// ---------- Comeback ----------

test("comeback: 14+ quiet days then 5+ issues in 7 days", () => {
  // Active Mar 1, quiet Mar 2-Mar 15 (14 days), back Mar 16 with 6 issues.
  const c = build([...on("2026-03-01"), ...on("2026-03-16", 4), ...on("2026-03-18", 2)]).comeback;
  assert.deepEqual(c, { status: "ok", quietDays: 14, quietStart: "2026-03-02", quietEnd: "2026-03-15", returnDate: "2026-03-16", burstCount: 6, burstDays: 7 });
});

test("comeback: 13 quiet days is not quiet enough", () => {
  const c = build([...on("2026-03-01"), ...on("2026-03-15", 8)]).comeback;
  assert.deepEqual(c, { status: "unavailable", reason: "no-quiet-stretch" });
});

test("comeback: burst below 5 or outside the 7-day window does not count", () => {
  assert.deepEqual(build([...on("2026-03-01"), ...on("2026-03-16", 4)]).comeback, { status: "unavailable", reason: "no-burst" });
  // 5 issues, but the 5th lands on day 8 after returning.
  assert.deepEqual(build([...on("2026-03-01"), ...on("2026-03-16", 4), ...on("2026-03-23")]).comeback, { status: "unavailable", reason: "no-burst" });
  assert.equal((build([...on("2026-03-01"), ...on("2026-03-16", 4), ...on("2026-03-22")]).comeback as { burstCount: number }).burstCount, 5);
});

test("comeback: time before the first or after the last completion is never a quiet stretch", () => {
  // Nothing in January or after Feb: only leading/trailing gaps, no gap between completions.
  assert.deepEqual(build([...on("2026-02-10", 6), ...on("2026-02-11")]).comeback, { status: "unavailable", reason: "no-quiet-stretch" });
});

test("comeback: needs history", () => {
  assert.deepEqual(build([]).comeback, { status: "unavailable", reason: "insufficient-history" });
  assert.deepEqual(build(on("2026-03-01", 9)).comeback, { status: "unavailable", reason: "insufficient-history" });
});

test("comeback: biggest burst wins, ties go to the longer quiet stretch, then the earlier one", () => {
  const bigger = build([...on("2026-01-01"), ...on("2026-02-01", 5), ...on("2026-04-01", 7)]).comeback;
  assert.equal(bigger.status === "ok" && bigger.returnDate, "2026-04-01");
  const longer = build([...on("2026-01-01"), ...on("2026-02-01", 5), ...on("2026-04-01", 5)]).comeback;
  assert.equal(longer.status === "ok" && longer.returnDate, "2026-04-01"); // 59 quiet days vs 30
  const earlier = build([...on("2026-01-01"), ...on("2026-01-20", 5), ...on("2026-02-08", 5)]).comeback;
  assert.equal(earlier.status === "ok" && earlier.quietDays, 18); // Jan 2-19 beats Jan 21-Feb 7 only on being first; both 18 -> earlier
  assert.equal(earlier.status === "ok" && earlier.returnDate, "2026-01-20");
});

test("comeback: the window is clipped by today while the year is in progress", () => {
  const items = [...on("2026-03-01"), ...on("2026-03-16", 3), ...on("2026-03-17", 2)];
  const c = build(items, { now: "2026-03-17T20:00:00Z" }).comeback;
  assert.equal(c.status === "ok" && c.burstDays, 2);
  assert.equal(c.status === "ok" && c.burstCount, 5);
});

test("comeback: uses the viewer's local days", () => {
  // 23:30 UTC on Mar 15 is already Mar 16 in Tokyo, so the return day differs by timezone.
  const items = [...on("2026-03-01"), ...Array.from({ length: 5 }, () => issue("2026-03-15T23:30:00Z"))];
  const utc = build(items, { timezone: "UTC" }).comeback;
  const tokyo = build(items, { timezone: "Asia/Tokyo" }).comeback;
  assert.equal(utc.status, "unavailable"); // 13 quiet days in UTC
  assert.equal(tokyo.status === "ok" && tokyo.returnDate, "2026-03-16");
});

// ---------- Scope Shapeshifter ----------

const P = (id: string) => ({ id, name: `Project ${id}` });
const L = (id: string) => ({ id, name: `label-${id}` });

test("scope: unavailable with fewer than two quarters of 5+ issues", () => {
  const s = build([...on("2026-01-10", 9), ...on("2026-05-10", 4)]).scope;
  assert.deepEqual(s, { status: "unavailable", reason: "too-few-quarters", quarterClosed: [9, 4, 0, 0] });
});

test("scope: shift is the total variation distance between first and last qualifying quarter", () => {
  const items = [
    ...on("2026-01-10", 5, { project: P("a"), labels: { nodes: [L("x")] } }),
    ...on("2026-05-10", 2, { project: P("b") }), // too sparse to qualify
    ...on("2026-11-10", 5, { project: P("b"), labels: { nodes: [L("y")] } }),
  ];
  const s = build(items, { now: "2026-12-01T00:00:00Z" }).scope;
  assert.equal(s.status, "ok");
  if (s.status !== "ok") return;
  assert.deepEqual(s.qualifying, [1, 4]);
  assert.equal(s.fromQuarter, 1);
  assert.equal(s.toQuarter, 4);
  assert.equal(s.projectShift, 1);
  assert.equal(s.labelShift, 1);
  assert.deepEqual(s.quarterClosed, [5, 2, 0, 5]);
});

test("scope: identical mixes shift 0 and partial overlap is proportional", () => {
  const same = [
    ...on("2026-01-10", 4, { project: P("a") }),
    ...on("2026-01-11", 4, { project: P("b") }),
    ...on("2026-10-10", 4, { project: P("a") }),
    ...on("2026-10-11", 4, { project: P("b") }),
  ];
  const s0 = build(same).scope;
  assert.equal(s0.status === "ok" && s0.projectShift, 0);
  // Q1: 50/50 a,b. Q4: 100% a -> distance 0.5.
  const half = [...on("2026-01-10", 3, { project: P("a") }), ...on("2026-01-11", 3, { project: P("b") }), ...on("2026-10-10", 6, { project: P("a") })];
  const s1 = build(half).scope;
  assert.equal(s1.status === "ok" && s1.projectShift, 0.5);
});

test("scope: unassigned and unlabeled issues are their own bucket, multi-label issues count once per label", () => {
  const items = [
    ...on("2026-01-10", 3, { labels: { nodes: [L("x"), L("y")] }, project: P("a") }),
    ...on("2026-01-11", 2), // no project, no label
    ...on("2026-10-10", 5), // no project, no label
  ];
  const s = build(items).scope;
  assert.equal(s.status, "ok");
  if (s.status !== "ok") return;
  // Q1 labels: x3 y3 none2; Q4: none5 -> distance = 0.5*(3/8 + 3/8 + |2/8-1|) = 0.75
  assert.equal(s.labelShift, 0.75);
  assert.deepEqual(s.labels.none, [2, 0, 0, 5]);
  assert.deepEqual(s.labels.series.map((x) => x.counts[0]), [3, 3]);
  // Projects: Q1 a3 none2 vs Q4 none5 -> 0.5*(3/5 + |2/5-1|) = 0.6
  assert.equal(s.projectShift, 0.6);
  assert.deepEqual(s.projects.none, [2, 0, 0, 5]);
});

test("scope: quarters follow local time and series keep the top 4 with the rest as other", () => {
  // Mar 31 23:30 UTC is Apr 1 in Tokyo: Q2, not Q1.
  const edge = Array.from({ length: 5 }, () => issue("2026-03-31T23:30:00Z"));
  const q = (tz: string) => build([...edge, ...on("2026-11-10", 5)], { timezone: tz }).scope.quarterClosed;
  assert.deepEqual(q("UTC"), [5, 0, 0, 5]);
  assert.deepEqual(q("Asia/Tokyo"), [0, 5, 0, 5]);

  const many = ["a", "b", "c", "d", "e", "f"].flatMap((id, i) => on("2026-01-10", 6 - i, { project: P(id) }));
  const s = build([...many, ...on("2026-10-10", 5, { project: P("a") })]).scope;
  assert.equal(s.status === "ok" && s.projects.series.length, 4);
  assert.deepEqual(s.status === "ok" && s.projects.series.map((x) => x.name), ["Project a", "Project b", "Project c", "Project d"]);
  assert.deepEqual(s.status === "ok" && s.projects.other, [3, 0, 0, 0]); // e (2) + f (1)
});

// ---------- Constellation ----------

test("constellation: biggest first, ties by name, capped at 12, no-project counted separately", () => {
  const items = [
    ...on("2026-02-01", 3, { project: P("z") }),
    ...on("2026-02-02", 3, { project: { id: "q", name: "Alpha" } }),
    ...on("2026-02-03", 5, { project: P("m") }),
    ...on("2026-02-04", 2),
  ];
  const c = build(items).constellation;
  assert.deepEqual(c.stars.map((s) => [s.name, s.closedCount]), [["Project m", 5], ["Alpha", 3], ["Project z", 3]]);
  assert.equal(c.withoutProject, 2);
  assert.equal(c.totalProjects, 3);

  const lots = Array.from({ length: 15 }, (_, i) => on("2026-02-01", 1, { project: P(String(i).padStart(2, "0")) })).flat();
  const big = build(lots).constellation;
  assert.equal(big.stars.length, 12);
  assert.equal(big.totalProjects, 15);
});

test("constellation: empty when no closed issue has a project", () => {
  assert.deepEqual(build(on("2026-02-01", 3)).constellation, { stars: [], totalProjects: 0, withoutProject: 3 });
});

// ---------- Signature Move ----------

test("signature: picks the pair that over-indexes against the viewer's own mix", () => {
  const items = [
    ...on("2026-02-01", 6, { project: P("a"), labels: { nodes: [L("bug")] } }),
    ...on("2026-02-02", 6, { project: P("b"), labels: { nodes: [L("feat")] } }),
    ...on("2026-02-03", 2, { project: P("a"), labels: { nodes: [L("feat")] } }),
    ...on("2026-02-04", 2, { project: P("b"), labels: { nodes: [L("bug")] } }),
    ...on("2026-02-05", 3), // excluded: no project/label
    ...on("2026-02-06", 2, { project: P("a") }), // excluded: no label
  ];
  const g = build(items).signatureMove;
  assert.equal(g.status, "ok");
  if (g.status !== "ok") return;
  assert.equal(g.eligible, 16);
  assert.equal(g.excluded, 5);
  // a+bug: 6 of N=16, project a = 8, bug = 8 -> lift = 6*16/(8*8) = 1.5. b+feat is equal: tie -> project id "a" first.
  assert.equal(g.project.id, "a");
  assert.equal(g.label.name, "label-bug");
  assert.equal(g.pairCount, 6);
  assert.equal(g.lift, 1.5);
});

test("signature: unavailable when nothing stands out, is too thin, or is missing data", () => {
  // One project, one label: everything overlaps, lift is exactly 1.
  const flat = build(on("2026-02-01", 9, { project: P("a"), labels: { nodes: [L("bug")] } })).signatureMove;
  assert.deepEqual(flat, { status: "unavailable", reason: "no-distinctive-pair", eligible: 9, excluded: 0 });
  assert.deepEqual(build(on("2026-02-01", 2, { project: P("a"), labels: { nodes: [L("bug")] } })).signatureMove, { status: "unavailable", reason: "insufficient-data", eligible: 2, excluded: 0 });
  assert.deepEqual(build(on("2026-02-01", 4)).signatureMove, { status: "unavailable", reason: "insufficient-data", eligible: 0, excluded: 4 });
  // Over-indexing but only 2 issues: below the minimum pair support.
  const thin = [
    ...on("2026-02-01", 10, { project: P("a"), labels: { nodes: [L("x")] } }),
    ...on("2026-02-02", 10, { project: P("b"), labels: { nodes: [L("y")] } }),
    ...on("2026-02-03", 2, { project: P("c"), labels: { nodes: [L("z")] } }),
  ];
  const g = build(thin).signatureMove;
  assert.equal(g.status === "ok" && g.project.id !== "c", true);
});

test("signature: multi-label issues contribute one pair per distinct label", () => {
  const items = [
    ...on("2026-02-01", 4, { project: P("a"), labels: { nodes: [L("x"), L("x"), L("y")] } }),
    ...on("2026-02-02", 8, { project: P("b"), labels: { nodes: [L("z")] } }),
  ];
  const g = build(items).signatureMove;
  assert.equal(g.status, "ok");
  if (g.status !== "ok") return;
  assert.equal(g.eligible, 12);
  assert.equal(g.pairCount, 4);
  assert.equal(g.projectCount, 4);
});

// ---------- Photo Finish ----------

test("photo finish: latest completion in the year, with local date and time", () => {
  const items = [issue("2026-12-30T08:15:00Z", { title: "Earlier" }), issue("2026-12-31T23:41:00Z", { title: "  Last one  " }), issue("2027-01-01T00:30:00Z", { title: "Next year" })];
  const f = build(items, { now: "2027-02-01T00:00:00Z" }).photoFinish;
  assert.deepEqual(f, { title: "Last one", date: "2026-12-31", time: "23:41", daysBeforeYearEnd: 0 });
});

test("photo finish: year boundaries use the viewer's timezone", () => {
  // 03:00 UTC Jan 1 2027 is still Dec 31 2026 in New York.
  const ny = build([issue("2026-12-20T10:00:00Z"), issue("2027-01-01T03:05:00Z")], { timezone: "America/New_York", now: "2027-02-01T00:00:00Z" }).photoFinish;
  assert.deepEqual([ny?.date, ny?.time, ny?.daysBeforeYearEnd], ["2026-12-31", "22:05", 0]);
  const utc = build([issue("2026-12-20T10:00:00Z"), issue("2027-01-01T03:05:00Z")], { now: "2027-02-01T00:00:00Z" }).photoFinish;
  assert.deepEqual([utc?.date, utc?.daysBeforeYearEnd], ["2026-12-20", 11]);
});

test("photo finish: honest while the year is in progress", () => {
  const f = build([issue("2026-10-02T09:00:00Z")]).photoFinish;
  assert.equal(f?.daysBeforeYearEnd, null);
  assert.equal(f?.date, "2026-10-02");
});

test("photo finish: nothing closed, missing title and exact ties", () => {
  assert.equal(build([]).photoFinish, null);
  assert.equal(build([issue("2026-05-05T10:00:00Z", { title: "   " })]).photoFinish?.title, null);
  assert.equal(build([issue("2026-05-05T10:00:00Z", { title: undefined })]).photoFinish?.title, null);
  const a = issue("2026-05-05T10:00:00Z", { id: "b-id", title: "B" });
  const b = issue("2026-05-05T10:00:00Z", { id: "a-id", title: "A" });
  assert.equal(build([a, b]).photoFinish?.title, "A");
  assert.equal(build([b, a]).photoFinish?.title, "A");
});
