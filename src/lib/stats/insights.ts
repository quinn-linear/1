import {
  COMEBACK_RULES,
  CONSTELLATION_MAX_STARS,
  SCOPE_RULES,
  SIGNATURE_RULES,
  type Comeback,
  type PhotoFinish,
  type ScopeEvolution,
  type ScopeSeries,
  type SignatureMove,
  type WrappedStats,
} from "./types.ts";
import { addDays, dayNumber } from "./time.ts";

/** One counted completion, already reduced to viewer-local parts. */
export interface ClosedEntry {
  id: string;
  /** UTC ISO instant. */
  at: string;
  title: string | null;
  project: { id: string; name: string } | null;
  labels: { id: string; name: string }[];
  local: { date: string; month: number; hour: number; minute: number };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Best burst after a quiet stretch. `lastDay` is the last local day that can
 * hold data: the end of the year, or today if the year is still in progress.
 */
export function computeComeback(byDay: Map<string, number>, lastDay: string): Comeback {
  const days = [...byDay.keys()].sort();
  if (days.length < 2) return { status: "unavailable", reason: "insufficient-history" };
  const { quietMinDays, burstWindowDays, burstMinIssues } = COMEBACK_RULES;

  let sawQuiet = false;
  let best: Extract<Comeback, { status: "ok" }> | null = null;
  for (let i = 1; i < days.length; i++) {
    const quietDays = dayNumber(days[i]) - dayNumber(days[i - 1]) - 1;
    if (quietDays < quietMinDays) continue;
    sawQuiet = true;
    const returnDate = days[i];
    const burstDays = Math.min(burstWindowDays, dayNumber(lastDay) - dayNumber(returnDate) + 1);
    let burstCount = 0;
    for (let d = 0; d < burstDays; d++) burstCount += byDay.get(addDays(returnDate, d)) ?? 0;
    if (burstCount < burstMinIssues) continue;
    const candidate = { status: "ok" as const, quietDays, quietStart: addDays(days[i - 1], 1), quietEnd: addDays(returnDate, -1), returnDate, burstCount, burstDays };
    // Days are visited in ascending order, so strict comparisons keep the earlier one on a full tie.
    if (!best || burstCount > best.burstCount || (burstCount === best.burstCount && quietDays > best.quietDays)) best = candidate;
  }
  return best ?? { status: "unavailable", reason: sawQuiet ? "no-burst" : "no-quiet-stretch" };
}

const quarterOf = (month: number) => Math.ceil(month / 3) - 1;

/** Share distribution per quarter over arbitrary bucket keys. */
function shiftBetween(a: Map<string, number>, b: Map<string, number>): number {
  const total = (m: Map<string, number>) => [...m.values()].reduce((x, y) => x + y, 0);
  const ta = total(a);
  const tb = total(b);
  if (ta === 0 || tb === 0) return 0;
  let sum = 0;
  for (const k of new Set([...a.keys(), ...b.keys()])) sum += Math.abs((a.get(k) ?? 0) / ta - (b.get(k) ?? 0) / tb);
  return Math.round((sum / 2) * 1000) / 1000;
}

const NONE = "\u0000none";

function buildSeries(perQuarter: Map<string, number>[], names: Map<string, string>): ScopeSeries {
  const totals = new Map<string, number>();
  for (const q of perQuarter) for (const [k, v] of q) if (k !== NONE) totals.set(k, (totals.get(k) ?? 0) + v);
  const top = [...totals].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, SCOPE_RULES.seriesShown).map(([k]) => k);
  const shown = new Set(top);
  return {
    series: top.map((k) => ({ name: names.get(k) ?? "", counts: perQuarter.map((q) => q.get(k) ?? 0) })),
    other: perQuarter.map((q) => [...q].filter(([k]) => k !== NONE && !shown.has(k)).reduce((s, [, v]) => s + v, 0)),
    none: perQuarter.map((q) => q.get(NONE) ?? 0),
  };
}

export function computeScope(entries: ClosedEntry[]): ScopeEvolution {
  const quarterClosed = [0, 0, 0, 0];
  const projects = [0, 1, 2, 3].map(() => new Map<string, number>());
  const labels = [0, 1, 2, 3].map(() => new Map<string, number>());
  const projectNames = new Map<string, string>();
  const labelNames = new Map<string, string>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  for (const e of entries) {
    const q = quarterOf(e.local.month);
    quarterClosed[q]++;
    if (e.project) {
      bump(projects[q], e.project.id);
      projectNames.set(e.project.id, e.project.name);
    } else bump(projects[q], NONE);
    // De-duplicate repeated labels on one issue so each counts once.
    const seen = new Set<string>();
    for (const l of e.labels) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      bump(labels[q], l.id);
      labelNames.set(l.id, l.name);
    }
    if (seen.size === 0) bump(labels[q], NONE);
  }

  const qualifying = quarterClosed.flatMap((n, i) => (n >= SCOPE_RULES.minQuarterIssues ? [i] : []));
  if (qualifying.length < 2) return { status: "unavailable", reason: "too-few-quarters", quarterClosed };
  const from = qualifying[0];
  const to = qualifying[qualifying.length - 1];
  return {
    status: "ok",
    quarterClosed,
    qualifying: qualifying.map((i) => i + 1),
    fromQuarter: from + 1,
    toQuarter: to + 1,
    projectShift: shiftBetween(projects[from], projects[to]),
    labelShift: shiftBetween(labels[from], labels[to]),
    projects: buildSeries(projects, projectNames),
    labels: buildSeries(labels, labelNames),
  };
}

export function computeConstellation(
  projects: Map<string, { id: string; name: string; closedCount: number }>,
  withoutProject: number,
): WrappedStats["constellation"] {
  const all = [...projects.values()].sort((a, b) => b.closedCount - a.closedCount || a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1));
  return { stars: all.slice(0, CONSTELLATION_MAX_STARS), totalProjects: all.length, withoutProject };
}

export function computeSignature(entries: ClosedEntry[]): SignatureMove {
  const { minPairIssues, minLift } = SIGNATURE_RULES;
  const projectCount = new Map<string, number>();
  const labelCount = new Map<string, number>();
  const pairCount = new Map<string, number>();
  const names = new Map<string, string>();
  let eligible = 0;

  for (const e of entries) {
    const labelIds = [...new Set(e.labels.map((l) => l.id))];
    if (!e.project || labelIds.length === 0) continue;
    eligible++;
    names.set(`p:${e.project.id}`, e.project.name);
    projectCount.set(e.project.id, (projectCount.get(e.project.id) ?? 0) + 1);
    for (const l of e.labels) names.set(`l:${l.id}`, l.name);
    for (const l of labelIds) {
      labelCount.set(l, (labelCount.get(l) ?? 0) + 1);
      const key = `${e.project.id}\u0000${l}`;
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    }
  }
  const excluded = entries.length - eligible;
  if (eligible < minPairIssues) return { status: "unavailable", reason: "insufficient-data", eligible, excluded };

  // Lift as an exact fraction num/den so ties and thresholds never depend on float rounding.
  let best: { project: string; label: string; n: number; num: number; den: number } | null = null;
  for (const [key, n] of pairCount) {
    if (n < minPairIssues) continue;
    const [project, label] = key.split("\u0000");
    const num = n * eligible;
    const den = (projectCount.get(project) as number) * (labelCount.get(label) as number);
    if (num < minLift * den) continue;
    const cmp = best ? num * best.den - best.num * den : 1;
    const better =
      !best ||
      cmp > 0 ||
      (cmp === 0 && (n > best.n || (n === best.n && (project < best.project || (project === best.project && label < best.label)))));
    if (better) best = { project, label, n, num, den };
  }
  if (!best) return { status: "unavailable", reason: "no-distinctive-pair", eligible, excluded };
  return {
    status: "ok",
    project: { id: best.project, name: names.get(`p:${best.project}`) as string },
    label: { id: best.label, name: names.get(`l:${best.label}`) as string },
    pairCount: best.n,
    projectCount: projectCount.get(best.project) as number,
    labelCount: labelCount.get(best.label) as number,
    eligible,
    excluded,
    lift: Math.round((best.num / best.den) * 10) / 10,
  };
}

/** Latest completion instant of the year; an exact tie goes to the smaller issue id. */
export function computePhotoFinish(entries: ClosedEntry[], year: number, yearOver: boolean): PhotoFinish | null {
  let last: ClosedEntry | null = null;
  for (const e of entries) {
    if (!last || e.at > last.at || (e.at === last.at && e.id < last.id)) last = e;
  }
  if (!last) return null;
  const { date, hour, minute } = last.local;
  return {
    title: last.title?.trim() || null,
    date,
    time: `${pad2(hour)}:${pad2(minute)}`,
    daysBeforeYearEnd: yearOver ? dayNumber(`${year}-12-31`) - dayNumber(date) : null,
  };
}
