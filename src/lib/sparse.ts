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
