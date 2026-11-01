import type { ArchetypeId, WrappedStats } from "./stats/types.ts";

/**
 * The only shape handed to client components. A strict projection of
 * `WrappedStats`: no ids, raw timestamps, issue URLs or distributions, and
 * nothing token-related. Absent metrics stay `null`; nothing is invented.
 */
export interface Recap {
  year: number;
  viewer: { name: string; avatarUrl: string | null };
  totalClosed: number;
  activeDays: number;
  archetype: { id: ArchetypeId; name: string; tagline: string; description: string; insufficientData: boolean };
  /** 12 entries, month 1-12. */
  monthly: { month: number; count: number }[];
  peakMonth: { month: number; count: number } | null;
  longestStreak: { days: number; start: string; end: string } | null;
  biggestProject: { name: string; closedCount: number } | null;
  /** Creator/assignee proxy only: `sharedIssues` counts issues the two of you created/assigned to each other. */
  topCollaborator: { name: string; avatarUrl: string | null; sharedIssues: number } | null;
  labelOfYear: { name: string; count: number } | null;
  oldestOpenIssue: { identifier: string; title: string; ageDays: number; createdAt: string } | null;
  /** Workspace-level services, not the viewer's own connections. */
  integrations: { status: "ok" | "unavailable"; services: string[] };
  /** Lists hit the fetch cap, so counts may be undercounts. */
  truncated: boolean;
}

const personName = (p: { name: string; displayName: string }) => p.displayName || p.name;

export function toRecap(s: WrappedStats): Recap {
  const project = s.biggestProject;
  const collab = s.topCollaborator;
  const label = s.labelOfYear;
  const oldest = s.oldestOpenIssue;
  return {
    year: s.year,
    viewer: { name: personName(s.viewer), avatarUrl: s.viewer.avatarUrl },
    totalClosed: s.totalClosed,
    activeDays: s.summary.activeDays,
    archetype: {
      id: s.archetype.id,
      name: s.archetype.name,
      tagline: s.archetype.tagline,
      description: s.archetype.description,
      insufficientData: s.archetype.reason === "insufficient-data",
    },
    monthly: s.monthly.counts.map(({ month, count }) => ({ month, count })),
    peakMonth: s.monthly.peakMonth && { ...s.monthly.peakMonth },
    longestStreak: s.longestStreak && { ...s.longestStreak },
    biggestProject: project && { name: project.name, closedCount: project.closedCount },
    topCollaborator: collab && { name: personName(collab), avatarUrl: collab.avatarUrl, sharedIssues: collab.sharedIssues },
    labelOfYear: label && { name: label.name, count: label.count },
    oldestOpenIssue: oldest && {
      identifier: oldest.identifier,
      title: oldest.title,
      ageDays: oldest.ageDays,
      createdAt: oldest.createdAt,
    },
    integrations: { status: s.integrations.status, services: [...s.integrations.services] },
    truncated: s.truncated,
  };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthName(month: number, short = false): string {
  const name = MONTHS[month - 1] ?? "";
  return short ? name.slice(0, 3) : name;
}

/** Formats a local `YYYY-MM-DD` (or ISO timestamp) as e.g. "Mar 4" without timezone shifts. */
export function formatDay(iso: string, withYear = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  const base = `${monthName(Number(m[2]), true)} ${Number(m[3])}`;
  return withYear ? `${base}, ${m[1]}` : base;
}

/** "slack" -> "Slack", "googleSheets" -> "Google Sheets". */
export function prettyService(service: string): string {
  const spaced = service.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").trim();
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

export type CardId =
  | "intro" | "total" | "archetype" | "peak" | "streak" | "project"
  | "collaborator" | "integrations" | "got-away" | "label" | "summary";

/** The fixed 11-card lineup, in order. */
export const CARD_IDS: readonly CardId[] = [
  "intro", "total", "archetype", "peak", "streak", "project",
  "collaborator", "integrations", "got-away", "label", "summary",
];
