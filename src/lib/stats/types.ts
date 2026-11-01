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

export type ArchetypeId = "night-owl" | "early-bird" | "friday-shipper" | "weekend-warrior" | "steady-builder";

export interface Archetype {
  id: ArchetypeId;
  /** Display name, e.g. "Night Owl". */
  name: string;
  /** One-line card headline. */
  tagline: string;
  /** One-sentence playful blurb. */
  description: string;
  /** Why this was chosen: a trait passed its threshold, nothing did, or too few issues. */
  reason: "threshold-met" | "default" | "insufficient-data";
  /** Inputs behind the decision (viewer-local counts), for transparency. */
  basis: {
    totalClosed: number;
    minCompletions: number;
    timeZone: string;
    traits: { id: Exclude<ArchetypeId, "steady-builder">; count: number; sharePercent: number; thresholdPercent: number }[];
  };
}

/**
 * "The Comeback". Computed from the local calendar days (in `timeZone`) that
 * have at least one completion, inside the year.
 * - Quiet stretch: a run of >= `quietMinDays` consecutive local days with zero
 *   completions, bounded on BOTH sides by a day that has one. Time before the
 *   first or after the last completion is never a stretch (we can't tell
 *   whether the viewer simply hadn't started, or the year isn't over).
 * - Return day: the first active day after the stretch.
 * - Burst: completions on the return day and the following days up to
 *   `burstWindowDays` in total, clipped to the end of the year and to today.
 *   It counts when >= `burstMinIssues`.
 * - Best comeback: most burst completions; ties go to the longer stretch, then
 *   the earlier return day.
 * It only describes completions in Linear, not effort or the reason for a gap.
 */
export const COMEBACK_RULES = { quietMinDays: 14, burstWindowDays: 7, burstMinIssues: 5 } as const;

export type Comeback =
  | {
      status: "ok";
      quietDays: number;
      /** Local dates (YYYY-MM-DD): first and last quiet day, and the return day. */
      quietStart: string;
      quietEnd: string;
      returnDate: string;
      burstCount: number;
      /** Days actually measured (<= burstWindowDays; fewer when clipped by year end or today). */
      burstDays: number;
    }
  | { status: "unavailable"; reason: "insufficient-history" | "no-quiet-stretch" | "no-burst" };

/**
 * "Scope Shapeshifter": the mix of projects and labels per local calendar
 * quarter. Labels and projects are those CURRENTLY on each issue (Linear is not
 * asked for label history), so this is how closed work looks now, by quarter
 * closed, not how labels changed over time.
 * - A quarter "qualifies" with >= `minQuarterIssues` closed issues.
 * - Shift: total variation distance (0-100%) between the share distributions of
 *   the first and last qualifying quarter: half the sum of |share difference|.
 *   Projects: one bucket per project plus "no project" (each issue counts once).
 *   Labels: one bucket per label plus "no label"; an issue with several labels
 *   adds one to each, and a label-less issue adds one to "no label".
 * - Needs >= 2 qualifying quarters; otherwise unavailable.
 * - Shown series are the 4 biggest buckets for the year (ties by id); the rest
 *   are summed into `other`.
 */
export const SCOPE_RULES = { minQuarterIssues: 5, seriesShown: 4 } as const;

export interface ScopeSeries {
  series: { name: string; counts: number[] }[];
  other: number[];
  none: number[];
}

export type ScopeEvolution =
  | {
      status: "ok";
      /** Closed issues per quarter, Q1-Q4. */
      quarterClosed: number[];
      /** Quarters (1-4) that qualify. */
      qualifying: number[];
      fromQuarter: number;
      toQuarter: number;
      /** 0-1 total variation distance, rounded to 3 decimals. */
      projectShift: number;
      labelShift: number;
      projects: ScopeSeries;
      labels: ScopeSeries;
    }
  | { status: "unavailable"; reason: "too-few-quarters"; quarterClosed: number[] };

/** Star counts shown for "Your Year as a Constellation". */
export const CONSTELLATION_MAX_STARS = 12;

/**
 * "Signature Move": the project + label pair that stands out most against the
 * viewer's OWN closed work (no one else's data is compared).
 * - Eligible issues: closed, in a project and with >= 1 label (N).
 * - For pair (project p, label l): n_pl eligible issues with both, n_p with
 *   project p, n_l with label l. Lift = (n_pl / N) / ((n_p / N) * (n_l / N)).
 *   Lift 2 = the pair occurs twice as often as the project and label would
 *   suggest if they were unrelated.
 * - A pair needs n_pl >= `minPairIssues` and lift >= `minLift`. Highest lift
 *   wins; ties go to more issues, then project id, then label id.
 * - Descriptive only: not unique across a team or population.
 */
export const SIGNATURE_RULES = { minPairIssues: 3, minLift: 1.5 } as const;

export type SignatureMove =
  | {
      status: "ok";
      project: { id: string; name: string };
      label: { id: string; name: string };
      pairCount: number;
      projectCount: number;
      labelCount: number;
      eligible: number;
      /** Closed issues in the year that were not eligible (no project or no label). */
      excluded: number;
      lift: number;
    }
  | { status: "unavailable"; reason: "insufficient-data" | "no-distinctive-pair"; eligible: number; excluded: number };

/** The latest completion (by instant) inside the year. */
export interface PhotoFinish {
  /** Issue title, or null when Linear returned none. Never the id or URL. */
  title: string | null;
  /** Local date and time (HH:MM) in `timeZone`. */
  date: string;
  time: string;
  /** Days from that date to Dec 31 of the year; null while the year is still in progress. */
  daysBeforeYearEnd: number | null;
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

  comeback: Comeback;
  scope: ScopeEvolution;
  /** Projects by closed issues (top `CONSTELLATION_MAX_STARS`; ties by name then id). */
  constellation: {
    stars: { id: string; name: string; closedCount: number }[];
    totalProjects: number;
    withoutProject: number;
  };
  signatureMove: SignatureMove;
  /** Null when nothing was closed. */
  photoFinish: PhotoFinish | null;

  /** Derived purely from `completions`; no extra API calls. */
  archetype: Archetype;

  summary: {
    archetype: ArchetypeId;
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
