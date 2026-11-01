import { formatDay, monthName, plural, prettyService } from "../recap.ts";
import { ARCHETYPE_COPY } from "../stats/archetype.ts";
import type { Snapshot } from "./snapshot.ts";

/** Everything a share image or shared page shows, derived only from a validated snapshot. */
export interface CardCopy {
  kicker: string;
  /** Huge number, when the card has one. */
  big?: string;
  headline: string;
  body?: string;
  pills?: string[];
  bars?: { values: number[]; highlight: number | null };
  footnote?: string;
  /** Plain-text description for alt text / screen readers. */
  alt: string;
}

const UNDERCOUNT = "Linear returned more issues than we fetch, so this may be an undercount.";

export function describe(s: Snapshot): CardCopy {
  const copy = build(s);
  const parts = [copy.kicker, [copy.big, copy.headline].filter(Boolean).join(" "), copy.pills?.join(", "), copy.body, copy.footnote];
  const alt = parts.filter((p): p is string => !!p).map((p) => p.replace(/\.$/, "")).join(". ");
  return { ...copy, alt: `Linear Wrapped ${s.y}. ${alt}.` };
}

function build(s: Snapshot): Omit<CardCopy, "alt"> {
  switch (s.c) {
    case "intro":
      return { kicker: "Linear Wrapped", headline: `Your ${s.y} in Linear`, body: "A year of shipping, wrapped up." };
    case "total":
      return {
        kicker: "Issues closed",
        big: s.n.toLocaleString("en-US"),
        headline: s.n === 1 ? "issue." : "issues.",
        body: s.n === 0 ? `Nothing closed in ${s.y} yet.` : `Across ${plural(s.d, "active day")}.`,
        footnote: s.u ? UNDERCOUNT : undefined,
      };
    case "archetype": {
      const a = ARCHETYPE_COPY[s.a];
      return { kicker: "Archetype", headline: a.name, body: `${a.tagline} ${a.description}`, footnote: s.i ? "Too few closed issues to read a pattern, so this is the default." : undefined };
    }
    case "peak":
      return {
        kicker: "Peak month",
        headline: s.m ? monthName(s.m) : "No peak yet",
        body: s.m ? `${plural(s.b[s.m - 1], "issue")} closed.` : "No closed issues this year.",
        bars: { values: s.b, highlight: s.m ? s.m - 1 : null },
      };
    case "streak":
      return s.s
        ? {
            kicker: "Longest streak",
            big: String(s.s.n),
            headline: s.s.n === 1 ? "day in a row." : "days in a row.",
            body: s.s.n === 1 ? formatDay(s.s.a) : `${formatDay(s.s.a)} to ${formatDay(s.s.z)}.`,
          }
        : { kicker: "Longest streak", headline: "No streak yet", body: "Close something on consecutive days." };
    case "project":
      return s.p
        ? { kicker: "Biggest project", headline: s.p.n, big: s.p.k.toLocaleString("en-US"), body: `${s.p.k === 1 ? "issue" : "issues"} closed here.` }
        : { kicker: "Biggest project", headline: "No project winner", body: "None of the closed issues belong to a project." };
    case "collaborator":
      return {
        kicker: "Top collaborator",
        headline: s.p ? s.p.n : "No one stands out yet",
        body: s.p ? `${plural(s.p.k, "closed issue")} passed between the two of us.` : undefined,
        footnote: "Based on creator/assignee only. Comments, mentions and reviews aren't counted.",
      };
    case "integrations": {
      const foot = "Workspace-level integrations, not necessarily personal ones.";
      if (!s.s) return { kicker: "Integrations", headline: "Can't see these", body: "Read-only access doesn't list integrations.", footnote: foot };
      if (s.s.t === 0) return { kicker: "Integrations", headline: "Flying solo.", body: "No integrations visible in the workspace.", footnote: foot };
      const more = s.s.t - s.s.l.length;
      return {
        kicker: "Integrations",
        headline: plural(s.s.t, "service"),
        pills: s.s.l.map(prettyService),
        body: more > 0 ? `${more} more not shown.` : "Wired into the workspace.",
        footnote: foot,
      };
    }
    case "got-away":
      return s.o
        ? { kicker: "The one that got away", big: s.o.d.toLocaleString("en-US"), headline: s.o.t, body: `${s.o.d === 1 ? "day" : "days"} open and still assigned to me.` }
        : { kicker: "The one that got away", headline: "Nothing open.", body: "Either spotless or suspicious." };
    case "label":
      return s.l
        ? { kicker: "Label of the year", headline: s.l.n, body: `Stuck to ${plural(s.l.k, "issue")} I closed.` }
        : { kicker: "Label of the year", headline: "No label", body: "None of the closed issues carried a label." };
    case "summary":
      return {
        kicker: `My ${s.y} in Linear`,
        big: s.n.toLocaleString("en-US"),
        headline: s.n === 1 ? "issue closed." : "issues closed.",
        pills: [
          ARCHETYPE_COPY[s.a].name,
          `${plural(s.d, "active day")}`,
          ...(s.m ? [`Peak: ${monthName(s.m)}`] : []),
          ...(s.s ? [`${s.s}-day streak`] : []),
        ],
        footnote: s.u ? UNDERCOUNT : undefined,
      };
  }
}

/** Pre-filled post text. The user still has to press Post themselves. */
export function shareText(s: Snapshot): string {
  const tag = "#LinearWrapped";
  switch (s.c) {
    case "intro":
      return `My ${s.y} in Linear, wrapped. ${tag}`;
    case "total":
      return `I closed ${plural(s.n, "issue")} in Linear in ${s.y}. ${tag}`;
    case "archetype":
      return `My Linear archetype for ${s.y}: ${ARCHETYPE_COPY[s.a].name}. ${tag}`;
    case "peak":
      return s.m ? `My peak Linear month of ${s.y} was ${monthName(s.m)}. ${tag}` : `My ${s.y} in Linear. ${tag}`;
    case "streak":
      return s.s ? `My longest Linear streak of ${s.y}: ${plural(s.s.n, "day")} in a row. ${tag}` : `My ${s.y} in Linear. ${tag}`;
    case "project":
      return s.p ? `My biggest Linear project of ${s.y}: ${s.p.n}. ${tag}` : `My ${s.y} in Linear. ${tag}`;
    case "collaborator":
      return s.p ? `My top Linear collaborator of ${s.y}: ${s.p.n}. ${tag}` : `My ${s.y} in Linear. ${tag}`;
    case "integrations":
      return `My ${s.y} in Linear, wrapped. ${tag}`;
    case "got-away":
      return `The Linear issue that got away in ${s.y}. ${tag}`;
    case "label":
      return s.l ? `My Linear label of ${s.y}: ${s.l.n}. ${tag}` : `My ${s.y} in Linear. ${tag}`;
    case "summary":
      return `I closed ${plural(s.n, "issue")} in Linear in ${s.y}. ${tag}`;
  }
}

/** What the link will make public, shown to the user BEFORE they share. Derived from the snapshot itself so it can't drift. */
export function disclosure(s: Snapshot): { items: string[]; sensitive: boolean } {
  const year = `The year (${s.y})`;
  const none = (what: string) => ({ items: [year, `No ${what} (this card has none)`], sensitive: false });
  switch (s.c) {
    case "intro":
      return { items: [year, "No name, avatar or account details"], sensitive: false };
    case "total":
      return { items: [year, `Issues closed (${s.n.toLocaleString("en-US")}) and active days (${s.d})`], sensitive: false };
    case "archetype":
      return { items: [year, `Archetype: ${ARCHETYPE_COPY[s.a].name}`], sensitive: false };
    case "peak":
      return { items: [year, "Issues closed in each month of the year"], sensitive: false };
    case "streak":
      return { items: [year, s.s ? `Streak length and its start/end dates` : "No streak"], sensitive: false };
    case "project":
      return s.p ? { items: [year, `Project name: ${s.p.n}`, "Issues closed in it"], sensitive: true } : none("project name");
    case "collaborator":
      return s.p ? { items: [year, `A colleague's name: ${s.p.n}`, "How many issues you shared"], sensitive: true } : none("colleague name");
    case "integrations":
      return s.s && s.s.l.length > 0
        ? { items: [year, `Workspace integration names: ${s.s.l.map(prettyService).join(", ")}`], sensitive: true }
        : none("integration names");
    case "got-away":
      return s.o ? { items: [year, `Issue title: “${s.o.t}” (no ID or link)`, "How long it has been open"], sensitive: true } : none("issue title");
    case "label":
      return s.l ? { items: [year, `Label name: ${s.l.n}`, "Issues it was used on"], sensitive: true } : none("label name");
    case "summary":
      return { items: [year, "Issues closed, active days, archetype, peak month and streak length", "No project, collaborator, label or issue names"], sensitive: false };
  }
}
