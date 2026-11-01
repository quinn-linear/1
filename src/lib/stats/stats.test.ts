import assert from "node:assert/strict";
import { test } from "node:test";
import { computeStats, longestStreak, type IssueNode } from "./compute.ts";
import { localParts, paddedYearWindow, resolveTimeZone } from "./time.ts";
import { buildWrappedStats } from "./index.ts";
import { LinearApiError, createLinearClient, paginate } from "./linear.ts";

const me = { id: "me", name: "Me", displayName: "me", avatarUrl: null };
const bob = { id: "bob", name: "Bob", displayName: "bob", avatarUrl: null };
const ann = { id: "ann", name: "Ann", displayName: "ann", avatarUrl: null };

let n = 0;
const issue = (completedAt: string | null, extra: Partial<IssueNode> = {}): IssueNode => ({
  id: `i${n++}`,
  completedAt,
  project: null,
  labels: { nodes: [] },
  creator: me,
  assignee: me,
  ...extra,
});

const base = (assigned: IssueNode[], over: Partial<Parameters<typeof computeStats>[0]> = {}) =>
  computeStats({
    year: 2026,
    now: new Date("2026-11-01T00:00:00Z"),
    viewer: { ...me, timezone: "UTC", organization: "Acme" },
    assignedCompleted: assigned,
    createdCompleted: [],
    openAssigned: [],
    integrations: { status: "ok", services: ["slack"] },
    truncated: false,
    ...over,
  });

test("aggregates counts, distributions, months, project, label, collaborators", () => {
  const p = { id: "p1", name: "Proj" };
  const bug = { id: "l1", name: "bug" };
  const stats = base(
    [
      issue("2026-01-02T22:00:00Z", { project: p, creator: bob, labels: { nodes: [bug] } }), // Fri 10pm
      issue("2026-01-03T06:00:00Z", { project: p, creator: bob }), // Sat 6am
      issue("2026-03-10T12:00:00Z", { creator: ann, labels: { nodes: [bug] } }),
      issue(null),
    ],
    { createdCompleted: [issue("2026-02-01T00:00:00Z", { creator: me, assignee: bob })] },
  );
  assert.equal(stats.totalClosed, 3);
  assert.equal(stats.completions.after9pm, 1);
  assert.equal(stats.completions.before9am, 1);
  assert.equal(stats.completions.friday, 1);
  assert.equal(stats.completions.weekend, 1);
  assert.equal(stats.monthly.peakMonth?.month, 1);
  assert.equal(stats.biggestProject?.closedCount, 2);
  assert.equal(stats.labelOfYear?.name, "bug");
  assert.equal(stats.topCollaborator?.id, "bob");
  assert.equal(stats.topCollaborator?.sharedIssues, 3);
  assert.equal(stats.summary.issuesWithoutProject, 1);
  assert.equal(stats.longestStreak?.days, 2);
});

test("empty year yields nulls, not fabricated values", () => {
  const stats = base([]);
  assert.equal(stats.totalClosed, 0);
  assert.equal(stats.monthly.peakMonth, null);
  assert.equal(stats.longestStreak, null);
  assert.equal(stats.topCollaborator, null);
  assert.equal(stats.oldestOpenIssue, null);
});

test("year boundary uses the viewer's local time", () => {
  const items = [
    issue("2026-01-01T03:00:00Z"), // still Dec 31 2025 in New York
    issue("2027-01-01T03:00:00Z"), // still Dec 31 2026 in New York
    issue("2025-12-31T23:30:00Z"), // Jan 1 2026 in Tokyo
  ];
  const ny = base(items, { viewer: { ...me, timezone: "America/New_York", organization: null } });
  assert.equal(ny.totalClosed, 1);
  assert.equal(ny.completions.timestamps[0], "2027-01-01T03:00:00.000Z");
  const tokyo = base(items, { viewer: { ...me, timezone: "Asia/Tokyo", organization: null } });
  assert.equal(tokyo.totalClosed, 2);
  assert.equal(tokyo.completions.byHour[8], 1);
});

test("invalid timezone falls back to UTC; DST handled", () => {
  assert.equal(resolveTimeZone("Not/AZone"), "UTC");
  assert.equal(localParts("2026-07-01T04:30:00Z", "America/New_York").hour, 0);
  const w = paddedYearWindow(2026);
  assert.ok(w.from < "2026-01-01" && w.to > "2027-01-01");
});

test("streak boundaries: month/year gaps, leap day, duplicates", () => {
  assert.equal(longestStreak([]), null);
  assert.deepEqual(longestStreak(["2026-01-31", "2026-02-01", "2026-02-01"]), {
    days: 2,
    start: "2026-01-31",
    end: "2026-02-01",
  });
  assert.deepEqual(longestStreak(["2028-02-28", "2028-02-29", "2028-03-01", "2028-03-03"])?.days, 3);
  assert.equal(longestStreak(["2026-03-01", "2026-03-03", "2026-03-04"])?.start, "2026-03-03");
});

test("oldest open issue", () => {
  const mk = (id: string, createdAt: string) => ({ id, identifier: id, title: id, url: "u", createdAt });
  const stats = base([], { openAssigned: [mk("b", "2025-05-01T00:00:00Z"), mk("a", "2024-05-01T00:00:00Z")] });
  assert.equal(stats.oldestOpenIssue?.id, "a");
  assert.ok((stats.oldestOpenIssue?.ageDays ?? 0) > 365);
});

// --- client: pagination and rate limits ---

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });

test("paginate follows cursors and reports truncation at the page cap", async () => {
  const cursors: unknown[] = [];
  const fakeFetch = (async (_u: unknown, init: RequestInit) => {
    const { variables } = JSON.parse(init.body as string);
    cursors.push(variables.after);
    const page = variables.after === null ? 1 : Number(variables.after) + 1;
    return json({ data: { c: { nodes: [page], pageInfo: { hasNextPage: true, endCursor: String(page) } } } });
  }) as typeof fetch;
  const client = createLinearClient("tok", { fetch: fakeFetch });
  const res = await paginate<number, { c: never }>(client, "q", {}, (d) => d.c, 3);
  assert.deepEqual(res.nodes, [1, 2, 3]);
  assert.equal(res.truncated, true);
  assert.deepEqual(cursors, [null, "1", "2"]);
});

test("retries 429 honoring retry-after, then succeeds", async () => {
  const sleeps: number[] = [];
  let calls = 0;
  const fakeFetch = (async () =>
    ++calls < 3 ? json({}, { status: 429, headers: { "retry-after": "2" } }) : json({ data: { ok: 1 } })) as typeof fetch;
  const client = createLinearClient("tok", { fetch: fakeFetch, sleep: async (ms) => void sleeps.push(ms) });
  assert.deepEqual(await client("q"), { ok: 1 });
  assert.deepEqual(sleeps, [2000, 2000]);
});

test("retries RATELIMITED GraphQL errors with exponential backoff, bounded", async () => {
  const sleeps: number[] = [];
  const fakeFetch = (async () =>
    json({ errors: [{ extensions: { code: "RATELIMITED" } }] }, { status: 400 })) as typeof fetch;
  const client = createLinearClient("tok", { fetch: fakeFetch, sleep: async (ms) => void sleeps.push(ms), maxRetries: 3 });
  await assert.rejects(client("q"), (e: LinearApiError) => e.kind === "rate_limited");
  assert.deepEqual(sleeps, [500, 1000, 2000]);
});

test("gives up immediately when the requested wait exceeds the cap", async () => {
  const fakeFetch = (async () => json({}, { status: 429, headers: { "retry-after": "600" } })) as typeof fetch;
  const client = createLinearClient("tok", { fetch: fakeFetch, sleep: async () => assert.fail("slept") });
  await assert.rejects(client("q"), (e: LinearApiError) => e.kind === "rate_limited");
});

test("auth errors are not retried and never leak the token", async () => {
  let calls = 0;
  const fakeFetch = (async () => (calls++, json({ errors: [{ message: "bad tok-secret" }] }, { status: 401 }))) as typeof fetch;
  const client = createLinearClient("tok-secret", { fetch: fakeFetch });
  await assert.rejects(client("q"), (e: LinearApiError) => e.kind === "unauthorized" && !e.message.includes("tok-secret"));
  assert.equal(calls, 1);
});

test("buildWrappedStats degrades integrations without failing", async () => {
  const user = { ...me, timezone: "UTC" };
  const conn = (nodes: unknown[]) => ({ nodes, pageInfo: { hasNextPage: false, endCursor: null } });
  const fakeFetch = (async (_u: unknown, init: RequestInit) => {
    const { query } = JSON.parse(init.body as string) as { query: string };
    if (query.includes("integrations")) return json({ errors: [{ message: "forbidden" }] }, { status: 400 });
    if (query.includes("organization")) return json({ data: { viewer: user, organization: { name: "Acme" } } });
    if (query.includes("createdIssues")) return json({ data: { viewer: { createdIssues: conn([]) } } });
    if (query.includes("completedAt: {"))
      return json({ data: { viewer: { assignedIssues: conn([issue("2026-05-05T10:00:00Z")]) } } });
    return json({ data: { viewer: { assignedIssues: conn([]) } } });
  }) as typeof fetch;
  const stats = await buildWrappedStats("tok", { client: { fetch: fakeFetch }, now: new Date("2026-11-01T00:00:00Z") });
  assert.equal(stats.totalClosed, 1);
  assert.equal(stats.integrations.status, "unavailable");
  assert.equal(stats.viewer.organization, "Acme");
  assert.equal(JSON.stringify(stats).includes("tok\""), false);
});
