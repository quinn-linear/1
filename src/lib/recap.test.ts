import assert from "node:assert/strict";
import { test } from "node:test";
import { CARD_IDS, formatDay, monthName, plural, prettyService, toRecap } from "./recap.ts";
import { clampIndex, keyToAction, resolveGesture, step } from "./storyNav.ts";
import { computeStats, type IssueNode } from "./stats/compute.ts";

const person = { id: "u1", name: "ada", displayName: "Ada L", avatarUrl: "https://x/a.png" };
const issue = (id: string, completedAt: string, over: Partial<IssueNode> = {}): IssueNode =>
  ({ id, completedAt, project: { id: "p1", name: "Apollo" }, labels: { nodes: [{ id: "l1", name: "bug" }] }, creator: person, assignee: person, ...over }) as IssueNode;

const build = (nodes: IssueNode[]) =>
  computeStats({
    year: 2026,
    now: new Date("2026-11-01T00:00:00Z"),
    viewer: { ...person, timezone: "UTC", organization: "Acme" } as never,
    assignedCompleted: nodes,
    createdCompleted: [],
    openAssigned: [],
    integrations: { status: "unavailable", services: [], reason: "nope" },
    truncated: false,
  } as never);

test("recap DTO carries no ids, timestamps or token-ish fields", () => {
  const recap = toRecap(build([issue("i1", "2026-03-04T10:00:00Z")]));
  const json = JSON.stringify(recap);
  for (const banned of ["completions", "timestamps", "generatedAt", "u1", "token"]) {
    assert.ok(!json.includes(banned), `leaked ${banned}`);
  }
  assert.equal(recap.year, 2026);
  assert.equal(recap.viewer.name, "Ada L");
  assert.equal(recap.totalClosed, 1);
  assert.equal(recap.monthly.length, 12);
  assert.deepEqual(recap.peakMonth, { month: 3, count: 1 });
  assert.equal(recap.integrations.status, "unavailable");
});

test("absent metrics stay null instead of being fabricated", () => {
  const recap = toRecap(build([]));
  assert.equal(recap.totalClosed, 0);
  assert.equal(recap.peakMonth, null);
  assert.equal(recap.longestStreak, null);
  assert.equal(recap.biggestProject, null);
  assert.equal(recap.topCollaborator, null);
  assert.equal(recap.labelOfYear, null);
  assert.equal(recap.oldestOpenIssue, null);
  assert.equal(recap.archetype.insufficientData, true);
  assert.deepEqual(recap.integrations.services, []);
});

test("recap year follows the stats year", () => {
  const stats = { ...build([]), year: 2031 };
  assert.equal(toRecap(stats).year, 2031);
});

test("lineup is the 11 cards in order", () => {
  assert.deepEqual([...CARD_IDS], [
    "intro", "total", "archetype", "peak", "streak", "project",
    "collaborator", "integrations", "got-away", "label", "summary",
  ]);
});

test("formatting helpers", () => {
  assert.equal(monthName(1), "January");
  assert.equal(monthName(12, true), "Dec");
  assert.equal(formatDay("2026-03-04"), "Mar 4");
  assert.equal(formatDay("2026-03-04T23:30:00Z", true), "Mar 4, 2026");
  assert.equal(formatDay("garbage"), "");
  assert.equal(prettyService("googleSheets"), "Google Sheets");
  assert.equal(prettyService("slack"), "Slack");
  assert.equal(plural(1, "issue"), "1 issue");
  assert.equal(plural(1200, "issue"), "1,200 issues");
});

test("story navigation clamps at both ends", () => {
  const n = CARD_IDS.length;
  assert.equal(step(0, "prev", n), 0);
  assert.equal(step(0, "next", n), 1);
  assert.equal(step(n - 1, "next", n), n - 1);
  assert.equal(step(n - 1, "prev", n), n - 2);
  assert.equal(clampIndex(99, n), n - 1);
  assert.equal(clampIndex(-3, n), 0);
});

test("gestures: taps by zone, horizontal swipes, ignores vertical scroll", () => {
  const w = 400;
  const g = (startX: number, endX: number, startY = 300, endY = 300) => resolveGesture({ startX, endX, startY, endY, width: w });
  assert.equal(g(50, 50), "prev");
  assert.equal(g(300, 302), "next");
  assert.equal(g(300, 200), "next");
  assert.equal(g(100, 220), "prev");
  assert.equal(g(200, 190, 300, 420), null);
  assert.equal(g(200, 215), null);
});

test("keyboard mapping", () => {
  assert.equal(keyToAction("ArrowRight"), "next");
  assert.equal(keyToAction(" "), "next");
  assert.equal(keyToAction("ArrowLeft"), "prev");
  assert.equal(keyToAction("a"), null);
});
