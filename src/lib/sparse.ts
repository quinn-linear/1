import type { Recap } from "./recap.ts";

/**
 * How much there is to wrap. `sparse` reuses the archetype's "too few closed
 * issues" cutoff (`archetype.insufficientData`) so the two never disagree.
 */
export type Density = "empty" | "sparse" | "full";

export function recapDensity(r: Pick<Recap, "totalClosed" | "archetype">): Density {
  if (r.totalClosed === 0) return "empty";
  return r.archetype.insufficientData ? "sparse" : "full";
}

export const SPARSE_NOTE = (closed: number, year: number) =>
  `A lighter ${year} so far: ${closed.toLocaleString("en-US")} closed ${closed === 1 ? "issue" : "issues"}. Some cards will be thin, and we only show what's real.`;

/** What "closed" means, shown when there's nothing to wrap so the zero isn't a mystery. */
export const COUNTING_RULE = (year: number) =>
  `We count issues assigned to you that were completed in ${year}. Canceled issues, and issues since reassigned to someone else, aren't counted.`;

/** Playful lines that cycle while stats load. They say what is being looked at, never how far along it is. */
export const LOADING_MESSAGES = [
  "Rounding up everything you closed",
  "Counting your active days",
  "Hunting for your longest streak",
  "Finding your busiest month",
  "Checking on that oldest open issue",
  "Deciding what kind of builder you are",
] as const;

export const nextLoadingIndex = (i: number, length: number = LOADING_MESSAGES.length) => (length > 0 ? (i + 1) % length : 0);

export const LOADING_HINT = "Bigger workspaces take longer. We read up to 5,000 issues per list.";
