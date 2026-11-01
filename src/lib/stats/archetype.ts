import type { Archetype, ArchetypeId, WrappedStats } from "./types.ts";

/**
 * Deterministic archetype classification from viewer-local completion counts
 * (`completions.*` are already bucketed in the viewer's timezone). Pure: no
 * I/O, no clock, no duration estimates.
 *
 * Rules:
 * 1. Fewer than MIN_COMPLETIONS closed issues -> Steady Builder (too little
 *    data for a pattern to mean anything).
 * 2. A trait qualifies when its share of all completions is >= its threshold.
 *    Thresholds are conservative: well above what an ordinary 9-to-5 week
 *    produces, e.g. Friday is ~20% of a flat Mon-Fri week.
 * 3. If several qualify, the one furthest past its own threshold
 *    (share / threshold) wins; exact ties break on TRAIT_ORDER.
 * 4. Nothing qualifies -> Steady Builder.
 */
export const MIN_COMPLETIONS = 10;

type TraitId = Exclude<ArchetypeId, "steady-builder">;

/** Tie-break priority, first wins. */
export const TRAIT_ORDER: TraitId[] = ["night-owl", "early-bird", "weekend-warrior", "friday-shipper"];

/** Minimum share of completions, as whole percent so comparisons stay exact. */
export const THRESHOLD_PERCENT: Record<TraitId, number> = {
  "night-owl": 35, // local hour >= 21
  "early-bird": 35, // local hour < 9
  "weekend-warrior": 20, // Saturday or Sunday
  "friday-shipper": 30, // Friday
};

const COPY: Record<ArchetypeId, { name: string; tagline: string; description: string }> = {
  "night-owl": {
    name: "Night Owl",
    tagline: "The backlog sleeps. You don't.",
    description: "A big chunk of your issues closed after 9pm. Moonlight is your sprint planning.",
  },
  "early-bird": {
    name: "Early Bird",
    tagline: "Done before the coffee cools.",
    description: "Lots of your issues closed before 9am. You beat the standup to it.",
  },
  "friday-shipper": {
    name: "Friday Shipper",
    tagline: "Ship it. Deploy it. Weekend, here we come.",
    description: "Fridays are your big closing day. You live dangerously and it works.",
  },
  "weekend-warrior": {
    name: "Weekend Warrior",
    tagline: "Saturdays are for shipping.",
    description: "A real share of your issues closed on weekends. Rest is a future-you problem.",
  },
  "steady-builder": {
    name: "Steady Builder",
    tagline: "Slow and steady closes the issues.",
    description: "No single time of day or week dominates. You just keep the work moving.",
  },
};

function traitCount(c: WrappedStats["completions"], id: TraitId): number {
  switch (id) {
    case "night-owl":
      return c.after9pm;
    case "early-bird":
      return c.before9am;
    case "weekend-warrior":
      return c.weekend;
    case "friday-shipper":
      return c.friday;
  }
}

const sharePercent = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 1000) / 10 : 0);

export function classifyArchetype(input: {
  totalClosed: number;
  timeZone: string;
  completions: WrappedStats["completions"];
}): Archetype {
  const { totalClosed: total, completions } = input;

  const traits = TRAIT_ORDER.map((id) => {
    const count = traitCount(completions, id);
    return { id, count, sharePercent: sharePercent(count, total), thresholdPercent: THRESHOLD_PERCENT[id] };
  });

  const insufficient = total < MIN_COMPLETIONS;
  let winner: TraitId | null = null;
  if (!insufficient) {
    for (const t of traits) {
      if (t.count * 100 < t.thresholdPercent * total) continue;
      // Compare count/threshold ratios exactly via cross-multiplication; strict
      // ">" keeps the earlier TRAIT_ORDER entry on ties.
      const best = winner && traits.find((x) => x.id === winner)!;
      if (!best || t.count * best.thresholdPercent > best.count * t.thresholdPercent) winner = t.id;
    }
  }

  const id: ArchetypeId = winner ?? "steady-builder";
  return {
    id,
    ...COPY[id],
    reason: insufficient ? "insufficient-data" : winner ? "threshold-met" : "default",
    basis: { totalClosed: total, minCompletions: MIN_COMPLETIONS, timeZone: input.timeZone, traits },
  };
}

export { COPY as ARCHETYPE_COPY };
