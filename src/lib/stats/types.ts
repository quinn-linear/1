/**
 * Shape of the recap returned by the stats engine. Everything is plain JSON.
 *
 * Metric semantics (all "local" values use `timeZone`, the viewer's Linear
 * timezone, falling back to UTC when unset/invalid):
 * - An issue counts as "closed" when it is assigned to the viewer and its
 *   `completedAt` falls inside the local calendar `year`. Canceled issues
 *   have no `completedAt` and are excluded.
 * - Days, weekdays, hours and months are local to `timeZone`.
 */

export interface PersonRef {
  id: string;
  name: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Limitation {
  /** Stable identifier, e.g. "integrations". */
  key: string;
  message: string;
}

export interface WrappedStats {
  year: number;
  timeZone: string;
  /** Local-time window [start, end) as ISO local dates. */
  range: { start: string; end: string };
  generatedAt: string;
  viewer: PersonRef & { organization: string | null };

  totalClosed: number;

  /** Raw timestamps and distributions; archetype logic is derived later. */
  completions: {
    /** UTC ISO timestamps of every counted completion, ascending. */
    timestamps: string[];
    /** Index = local hour 0-23. */
    byHour: number[];
    /** Index = local weekday, 0 = Sunday ... 6 = Saturday. */
    byWeekday: number[];
    /** Local hour >= 21. */
    after9pm: number;
    /** Local hour < 9 (includes the small hours after midnight). */
    before9am: number;
    friday: number;
    /** Saturday or Sunday. */
    weekend: number;
  };

  monthly: {
    /** 12 entries, month 1-12. */
    counts: { month: number; count: number }[];
    /** Earliest month wins ties; null when nothing was closed. */
    peakMonth: { month: number; count: number } | null;
  };

  /** Longest run of consecutive local calendar days with >= 1 completion. */
  longestStreak: { days: number; start: string; end: string } | null;

  /** Project with the most closed issues; issues without a project are ignored. */
  biggestProject: { id: string; name: string; closedCount: number } | null;

  /**
   * Person sharing the most issues with the viewer: closed issues assigned to
   * the viewer and created by them, plus closed issues the viewer created and
   * assigned to them. Ties break on id.
   */
  topCollaborator: (PersonRef & { sharedIssues: number }) | null;

  /** Most-used label across closed issues. */
  labelOfYear: { id: string; name: string; count: number } | null;

  /** Open (not completed/canceled) issue assigned to the viewer with the earliest createdAt. */
  oldestOpenIssue: {
    id: string;
    identifier: string;
    title: string;
    url: string;
    createdAt: string;
    ageDays: number;
  } | null;

  integrations:
    | { status: "ok"; services: string[] }
    | { status: "unavailable"; services: []; reason: string };

  summary: {
    totalClosed: number;
    activeDays: number;
    busiestDay: { date: string; count: number } | null;
    busiestWeekday: number | null;
    busiestHour: number | null;
    projectsTouched: number;
    issuesWithoutProject: number;
  };

  /** True if any list hit the page cap, so numbers may be undercounts. */
  truncated: boolean;
  limitations: Limitation[];
}
