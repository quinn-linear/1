import { toRecap, type Recap } from "./recap.ts";
import { computeStats, type IssueNode } from "./stats/compute.ts";

/**
 * Recap fixtures for layout checks and tests: a full year, a sparse one, an
 * empty one and one full of very long names. They run through the real stats
 * code, so they are shaped exactly like live data. Only reachable in the app
 * through the env-gated `/preview/<name>` route (see README).
 */
export type FixtureName = "full" | "sparse" | "zero" | "long";
export const FIXTURE_NAMES: FixtureName[] = ["full", "sparse", "zero", "long"];

const LONG_NAME = "Alexandrina-Konstantinopoulou Wolfeschlegelsteinhausen";
const LONG_PROJECT = "Customer Onboarding Experience Revamp Initiative Phase Two";
const LONG_LABEL = "cross-functional-infrastructure-reliability";

let n = 0;
const issue = (viewer: unknown, completedAt: string, project: string | null, labels: string[], title = "Ship the thing"): IssueNode =>
  ({
    id: `fx-${n++}`,
    title,
    completedAt,
    project: project && { id: `p-${project}`, name: project },
    labels: { nodes: labels.map((l) => ({ id: `l-${l}`, name: l })) },
    creator: viewer,
    assignee: viewer,
  }) as IssueNode;

const many = (viewer: unknown, date: string, count: number, project: string | null, labels: string[], title?: string) =>
  Array.from({ length: count }, () => issue(viewer, `${date}T12:00:00Z`, project, labels, title));

export function fixtureRecap(name: FixtureName): Recap {
  const long = name === "long";
  const viewer = { id: "fx-u", name: long ? LONG_NAME : "Alan", displayName: long ? LONG_NAME : "Alan Parsons", avatarUrl: null };
  const project = long ? LONG_PROJECT : "Apollo";
  const label = long ? LONG_LABEL : "bug";
  let items: IssueNode[] = [];
  if (name === "full" || long) {
    items = [
      ...many(viewer, "2026-01-10", 6, project, [label]),
      ...many(viewer, "2026-01-11", 6, "Zephyr", ["feature"]),
      ...many(viewer, "2026-02-20", 6, project, [label]),
      ...many(viewer, "2026-03-03", 3, "Gemini", ["docs"]),
      ...many(viewer, "2026-10-05", 8, "Zephyr", ["feature"]),
      ...many(viewer, "2026-10-06", 2, project, ["feature"]),
      ...many(viewer, "2026-10-07", 2, null, []),
      issue(viewer, "2026-12-31T23:41:00Z", "Zephyr", ["feature"], long ? "A remarkably long final issue title that keeps going well past any sensible length for a heading" : "Final polish"),
    ];
  } else if (name === "sparse") {
    items = [issue(viewer, "2026-04-02T10:00:00Z", null, [], "One lonely issue")];
  }
  const stats = computeStats({
    year: 2026,
    now: new Date("2027-01-02T00:00:00Z"),
    viewer: { ...viewer, timezone: "UTC", organization: long ? "Konstantinopoulou Global Platform Reliability Engineering Organization" : "Acme" } as never,
    assignedCompleted: items,
    createdCompleted: [],
    openAssigned: [],
    integrations: { status: "ok", services: long ? ["github", "slack", "figma", "sentry", "zendesk", "intercom", "notion", "datadog", "pagerduty"] : ["github", "slack"] },
    truncated: false,
  } as never);
  return toRecap(stats);
}
