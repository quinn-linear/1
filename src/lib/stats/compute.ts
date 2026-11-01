import { classifyArchetype } from "./archetype.ts";
import type { PersonRef, WrappedStats } from "./types.ts";
import { dayNumber, localParts, resolveTimeZone } from "./time.ts";

export interface IssueNode {
  id: string;
  completedAt: string | null;
  project: { id: string; name: string } | null;
  labels: { nodes: { id: string; name: string }[] };
  creator: PersonRef | null;
  assignee: PersonRef | null;
}

export interface OpenIssueNode {
  id: string;
  identifier: string;
  title: string;
  url: string;
  createdAt: string;
}

export interface StatsInput {
  year: number;
  now: Date;
  viewer: PersonRef & { timezone: string | null; organization: string | null };
  /** Issues assigned to the viewer, completed inside the padded year window. */
  assignedCompleted: IssueNode[];
  /** Issues created by the viewer, completed inside the padded year window. */
  createdCompleted: IssueNode[];
  openAssigned: OpenIssueNode[];
  integrations: WrappedStats["integrations"];
  truncated: boolean;
}

function topBy<T>(entries: Map<string, T>, count: (v: T) => number): T | null {
  let best: [string, T] | null = null;
  for (const entry of entries) {
    if (!best || count(entry[1]) > count(best[1]) || (count(entry[1]) === count(best[1]) && entry[0] < best[0])) {
      best = entry;
    }
  }
  return best ? best[1] : null;
}

function argMax(values: number[]): number | null {
  let best = -1;
  values.forEach((v, i) => {
    if (v > 0 && (best < 0 || v > values[best])) best = i;
  });
  return best < 0 ? null : best;
}

export function longestStreak(dates: Iterable<string>): { days: number; start: string; end: string } | null {
  const sorted = [...new Set(dates)].sort();
  let best: { days: number; start: string; end: string } | null = null;
  let runStart = 0;
  for (let i = 0; i < sorted.length; i++) {
    const last = i === sorted.length - 1 || dayNumber(sorted[i + 1]) - dayNumber(sorted[i]) !== 1;
    if (!last) continue;
    const days = i - runStart + 1;
    if (!best || days > best.days) best = { days, start: sorted[runStart], end: sorted[i] };
    runStart = i + 1;
  }
  return best;
}

export function computeStats(input: StatsInput): WrappedStats {
  const { year, viewer } = input;
  const timeZone = resolveTimeZone(viewer.timezone);

  // Keep only issues whose *local* completion time is in the target year, and
  // de-duplicate by id.
  const closed = new Map<string, { issue: IssueNode; at: string; local: ReturnType<typeof localParts> }>();
  for (const issue of input.assignedCompleted) {
    if (!issue.completedAt || closed.has(issue.id)) continue;
    const local = localParts(issue.completedAt, timeZone);
    if (local.year === year) closed.set(issue.id, { issue, at: new Date(issue.completedAt).toISOString(), local });
  }
  const entries = [...closed.values()].sort((a, b) => a.at.localeCompare(b.at));

  const byHour = Array<number>(24).fill(0);
  const byWeekday = Array<number>(7).fill(0);
  const byMonth = Array<number>(12).fill(0);
  const byDay = new Map<string, number>();
  const projects = new Map<string, { id: string; name: string; closedCount: number }>();
  const labels = new Map<string, { id: string; name: string; count: number }>();
  const collaborators = new Map<string, PersonRef & { sharedIssues: number }>();
  let issuesWithoutProject = 0;

  const share = (person: PersonRef | null) => {
    if (!person || person.id === viewer.id) return;
    const c = collaborators.get(person.id) ?? { ...person, sharedIssues: 0 };
    c.sharedIssues++;
    collaborators.set(person.id, c);
  };

  for (const { issue, local } of entries) {
    byHour[local.hour]++;
    byWeekday[local.weekday]++;
    byMonth[local.month - 1]++;
    byDay.set(local.date, (byDay.get(local.date) ?? 0) + 1);

    if (issue.project) {
      const p = projects.get(issue.project.id) ?? { ...issue.project, closedCount: 0 };
      p.closedCount++;
      projects.set(p.id, p);
    } else {
      issuesWithoutProject++;
    }
    for (const label of issue.labels.nodes) {
      const l = labels.get(label.id) ?? { ...label, count: 0 };
      l.count++;
      labels.set(l.id, l);
    }
    share(issue.creator);
  }

  // Issues the viewer created and handed to someone else. Skip ones already
  // counted above (assigned to the viewer) so nothing is double counted.
  const seenCreated = new Set<string>();
  for (const issue of input.createdCompleted) {
    if (!issue.completedAt || seenCreated.has(issue.id) || closed.has(issue.id)) continue;
    seenCreated.add(issue.id);
    if (localParts(issue.completedAt, timeZone).year === year) share(issue.assignee);
  }

  const peak = argMax(byMonth);
  const busiestDayEntry = topBy(new Map([...byDay].map(([d, n]) => [d, { date: d, count: n }])), (v) => v.count);

  let oldest: OpenIssueNode | null = null;
  for (const issue of input.openAssigned) {
    if (!oldest || issue.createdAt < oldest.createdAt) oldest = issue;
  }

  const totalClosed = entries.length;
  const weekend = byWeekday[0] + byWeekday[6];

  const completions = {
    timestamps: entries.map((e) => e.at),
    byHour,
    byWeekday,
    after9pm: byHour.slice(21).reduce((a, b) => a + b, 0),
    before9am: byHour.slice(0, 9).reduce((a, b) => a + b, 0),
    friday: byWeekday[5],
    weekend,
  };
  const archetype = classifyArchetype({ totalClosed, timeZone, completions });

  return {
    year,
    timeZone,
    range: { start: `${year}-01-01`, end: `${year + 1}-01-01` },
    generatedAt: input.now.toISOString(),
    viewer: {
      id: viewer.id,
      name: viewer.name,
      displayName: viewer.displayName,
      avatarUrl: viewer.avatarUrl,
      organization: viewer.organization,
    },
    totalClosed,
    completions,
    monthly: {
      counts: byMonth.map((count, i) => ({ month: i + 1, count })),
      peakMonth: peak === null ? null : { month: peak + 1, count: byMonth[peak] },
    },
    longestStreak: longestStreak(byDay.keys()),
    biggestProject: topBy(projects, (p) => p.closedCount),
    topCollaborator: topBy(collaborators, (c) => c.sharedIssues),
    labelOfYear: topBy(labels, (l) => l.count),
    oldestOpenIssue: oldest && {
      ...oldest,
      ageDays: Math.max(0, Math.floor((input.now.getTime() - new Date(oldest.createdAt).getTime()) / 86_400_000)),
    },
    integrations: input.integrations,
    archetype,
    summary: {
      archetype: archetype.id,
      totalClosed,
      activeDays: byDay.size,
      busiestDay: busiestDayEntry,
      busiestWeekday: argMax(byWeekday),
      busiestHour: argMax(byHour),
      projectsTouched: projects.size,
      issuesWithoutProject,
    },
    truncated: input.truncated,
    limitations: [
      {
        key: "completion-time",
        message:
          "Uses Linear's completedAt, the latest completion time. Reopened and re-closed issues count at their latest close; issues archived before the request may be missing.",
      },
      {
        key: "collaboration",
        message:
          "Collaboration counts only issues where the viewer and another person are creator/assignee. Comments, mentions, subscribers and reviews are not counted.",
      },
      {
        key: "integrations",
        message:
          input.integrations.status === "ok"
            ? "Integrations are the workspace-level services visible to the read scope; per-user connections and activity are not exposed."
            : "Integrations could not be read with the read-only scope.",
      },
      {
        key: "history",
        message:
          "Only the current assignee's completed issues are counted; issues reassigned away from the viewer after they closed them are not included.",
      },
    ],
  };
}
