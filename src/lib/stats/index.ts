import { createHash } from "node:crypto";
import { computeStats, type IssueNode, type OpenIssueNode } from "./compute.ts";
import { LinearApiError, createLinearClient, paginate, type ClientOptions, type LinearClient } from "./linear.ts";
import { paddedYearWindow } from "./time.ts";
import type { PersonRef, WrappedStats } from "./types.ts";

export type { WrappedStats } from "./types.ts";
export { LinearApiError } from "./linear.ts";

/** The recap year; override per call to support other years. */
export const DEFAULT_YEAR = 2026;
const PAGE_SIZE = 50;
/** Per-list cap (50 * 100 = 5000 issues). Hitting it sets `truncated`. */
const MAX_PAGES = 100;

const USER_FIELDS = "id name displayName avatarUrl";
const ISSUE_FIELDS = `id completedAt project { id name } labels(first: 20) { nodes { id name } }
  creator { ${USER_FIELDS} } assignee { ${USER_FIELDS} }`;

const VIEWER_QUERY = `query { viewer { ${USER_FIELDS} timezone } organization { name } }`;

const completedQuery = (connection: "assignedIssues" | "createdIssues") => `
  query ($after: String, $from: DateTimeOrDuration!, $to: DateTimeOrDuration!) {
    viewer { ${connection}(first: ${PAGE_SIZE}, after: $after,
      filter: { completedAt: { gte: $from, lt: $to } }) {
      nodes { ${ISSUE_FIELDS} }
      pageInfo { hasNextPage endCursor }
    } }
  }`;

const OPEN_QUERY = `
  query ($after: String) {
    viewer { assignedIssues(first: ${PAGE_SIZE}, after: $after,
      filter: { state: { type: { nin: ["completed", "canceled"] } } }) {
      nodes { id identifier title url createdAt }
      pageInfo { hasNextPage endCursor }
    } }
  }`;

const INTEGRATIONS_QUERY = `query { integrations(first: 100) { nodes { service } } }`;

interface ViewerData {
  viewer: PersonRef & { timezone: string | null };
  organization: { name: string } | null;
}

async function fetchIntegrations(client: LinearClient): Promise<WrappedStats["integrations"]> {
  try {
    const data = await client<{ integrations: { nodes: { service: string }[] } }>(INTEGRATIONS_QUERY);
    const services = [...new Set(data.integrations.nodes.map((n) => n.service))].sort();
    return { status: "ok", services };
  } catch (err) {
    // Optional data: a bad token must still fail the whole recap, anything else degrades.
    if (err instanceof LinearApiError && err.kind === "unauthorized") throw err;
    return { status: "unavailable", services: [], reason: "Not available with read-only access" };
  }
}

/** Fetches from Linear and computes the recap. Nothing is persisted. */
export async function buildWrappedStats(
  token: string,
  opts: { year?: number; now?: Date; client?: ClientOptions } = {},
): Promise<WrappedStats> {
  const year = opts.year ?? DEFAULT_YEAR;
  const client = createLinearClient(token, opts.client);
  const window = paddedYearWindow(year);

  const [{ viewer, organization }, integrations] = await Promise.all([
    client<ViewerData>(VIEWER_QUERY),
    fetchIntegrations(client),
  ]);

  type Viewer<K extends string, N> = { viewer: Record<K, { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }> };
  const completed = (key: "assignedIssues" | "createdIssues") =>
    paginate<IssueNode, Viewer<typeof key, IssueNode>>(client, completedQuery(key), window, (d) => d.viewer?.[key], MAX_PAGES);

  // Sequential so a rate-limit backoff slows the whole run instead of fanning out.
  const assigned = await completed("assignedIssues");
  const created = await completed("createdIssues");
  const open = await paginate<OpenIssueNode, Viewer<"assignedIssues", OpenIssueNode>>(
    client,
    OPEN_QUERY,
    {},
    (d) => d.viewer?.assignedIssues,
    MAX_PAGES,
  );

  return computeStats({
    year,
    now: opts.now ?? new Date(),
    viewer: { ...viewer, organization: organization?.name ?? null },
    assignedCompleted: assigned.nodes,
    createdCompleted: created.nodes,
    openAssigned: open.nodes,
    integrations,
    truncated: assigned.truncated || created.truncated || open.truncated,
  });
}

// Short-lived per-instance memo so a page render and the JSON route right after
// login don't each re-crawl the API. Keyed by a hash of the token (never the
// token itself), best-effort on serverless, never written to disk or cookies.
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 50;
const cache = new Map<string, { expires: number; value: Promise<WrappedStats> }>();

export function getWrappedStats(token: string, year = DEFAULT_YEAR): Promise<WrappedStats> {
  const key = createHash("sha256").update(`${year}:${token}`).digest("hex");
  const now = Date.now();
  for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);

  const hit = cache.get(key);
  if (hit) return hit.value;

  const value = buildWrappedStats(token, { year });
  value.catch(() => cache.delete(key));
  cache.set(key, { expires: now + TTL_MS, value });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  return value;
}
