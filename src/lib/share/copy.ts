import { formatDay, monthName, plural, prettyService } from "../recap.ts";
import { ARCHETYPE_COPY } from "../stats/archetype.ts";
import { addDays, dayNumber } from "../stats/time.ts";
import { daysInYear } from "./art.ts";
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
  /** Star sizes (closed issues per project), biggest first. */
  stars?: number[];
  /** Spans on a Jan 1 - Dec 31 line, as 0-1 fractions of the year. */
  rail?: { from: number; to: number; tone: "quiet" | "burst" | "mark" }[];
  footnote?: string;
  /** Plain-text description for alt text / screen readers. */
  alt: string;
}

/** Where a local YYYY-MM-DD falls in the year, 0 (Jan 1) to 1 (Dec 31). */
const yearFraction = (date: string, year: number) => {
  const days = daysInYear(year);
  return Math.min(Math.max((dayNumber(date) - dayNumber(`${year}-01-01`)) / Math.max(days - 1, 1), 0), 1);
};

const COMEBACK_RULE = "A comeback needs 14+ days with nothing closed, then 5+ issues closed in the 7 days after returning. Quiet means no completions in Linear, not time off.";

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
    case "comeback": {
      const m = s.m;
      if (!m) return { kicker: "The Comeback", headline: "No comeback yet", body: "No quiet stretch was followed by a big enough burst.", footnote: COMEBACK_RULE };
      const end = formatDay(m.z);
      return {
        kicker: "The Comeback",
        big: String(m.k),
        headline: `${m.k === 1 ? "issue" : "issues"} in ${plural(m.w, "day")}.`,
        body: `After ${plural(m.q, "quiet day")} (${formatDay(m.a)} to ${end}), back on ${formatDay(m.r)}.`,
        rail: [
          { from: yearFraction(m.a, s.y), to: yearFraction(m.z, s.y), tone: "quiet" },
          { from: yearFraction(m.r, s.y), to: yearFraction(addDays(m.r, m.w - 1), s.y), tone: "burst" },
        ],
        footnote: COMEBACK_RULE,
      };
    }
    case "scope": {
      const z = s.z;
      const note = "Uses labels and projects as they are on issues now, grouped by the quarter each closed. 0% = same mix, 100% = entirely different.";
      if (!z) return { kicker: "Scope Shapeshifter", headline: "Too early to tell", body: "Needs two quarters with 5+ closed issues each to compare.", footnote: note };
      const top = Math.max(z.p, z.l);
      return {
        kicker: "Scope Shapeshifter",
        headline: top >= 50 ? "Full shapeshift." : top >= 25 ? "Shifting scope." : "Steady scope.",
        pills: [`Projects: ${z.p}% shift`, `Labels: ${z.l}% shift`, `Q${z.f} to Q${z.t}`],
        body: "Closed issues per quarter, Q1 to Q4.",
        bars: { values: z.q, highlight: null },
        footnote: note,
      };
    }
    case "constellation": {
      const foot = s.o > 0 ? `${plural(s.o, "closed issue")} had no project, so they aren't stars.` : "Star size follows closed issues per project.";
      if (s.s.length === 0) return { kicker: "Your year as a constellation", headline: "No stars yet", body: "None of the closed issues belong to a project.", footnote: foot };
      return {
        kicker: "Your year as a constellation",
        big: String(s.t),
        headline: s.t === 1 ? "project lit up." : "projects lit up.",
        pills: s.s.map((p) => `${p.n} ${p.k.toLocaleString("en-US")}`),
        stars: s.s.map((p) => p.k),
        body: s.t > s.s.length ? `Biggest ${s.s.length} shown. Star size follows closed issues.` : "Star size follows closed issues.",
        footnote: s.o > 0 ? foot : undefined,
      };
    }
    case "signature": {
      const note = "Compared only with my own closed work, not with anyone else.";
      if (!s.m) return { kicker: "Signature move", headline: "No signature yet", body: "Needs a project and label pair on 3+ issues that stands out in your own mix.", footnote: note };
      const { p, l, k, a, b, x } = s.m;
      return {
        kicker: "Signature move",
        headline: `${p} + ${l}`,
        pills: [plural(k, "issue"), `${(x / 10).toFixed(1)}x lift`],
        body: `${a}% of my ${l} issues were in ${p}, which is ${b}% of my labeled project work.`,
        footnote: note,
      };
    }
    case "photo-finish": {
      const o = s.o;
      if (!o) return { kicker: "Photo finish", headline: "No finish yet", body: `Nothing closed in ${s.y} yet.` };
      const when =
        o.g === null
          ? `Latest close so far, ${formatDay(o.d)}. ${s.y} isn't over yet.`
          : o.g === 0
            ? `${formatDay(o.d)}: the very last day of ${s.y}.`
            : `${formatDay(o.d)}, ${plural(o.g, "day")} before ${s.y} ended.`;
      return {
        kicker: "Photo finish",
        big: o.h,
        headline: o.t ?? "an issue",
        body: when,
        rail: [{ from: yearFraction(o.d, s.y), to: yearFraction(o.d, s.y), tone: "mark" }],
        footnote: "Latest completion of the year, in my Linear timezone.",
      };
    }
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
    case "comeback":
      return s.m ? `My Linear comeback of ${s.y}: ${plural(s.m.k, "issue")} in ${plural(s.m.w, "day")} after ${plural(s.m.q, "quiet day")}. ${tag}` : `My ${s.y} in Linear. ${tag}`;
    case "scope":
      return `How my Linear scope changed across ${s.y}. ${tag}`;
    case "constellation":
      return s.s.length > 0 ? `My ${s.y} in Linear as a constellation of ${plural(s.t, "project")}. ${tag}` : `My ${s.y} in Linear. ${tag}`;
    case "signature":
      return s.m ? `My Linear signature move of ${s.y}: ${s.m.p} + ${s.m.l}. ${tag}` : `My ${s.y} in Linear. ${tag}`;
    case "photo-finish":
      return s.o ? `The last issue I closed in Linear in ${s.y}${s.o.g === null ? " so far" : ""}. ${tag}` : `My ${s.y} in Linear. ${tag}`;
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
    case "comeback":
      return { items: [year, s.m ? "Quiet stretch and return dates, and issues closed after returning" : "No comeback"], sensitive: false };
    case "scope":
      return { items: [year, "Issues closed per quarter and how much your project and label mix shifted (percent)", "No project or label names"], sensitive: false };
    case "constellation":
      return s.s.length > 0
        ? { items: [year, `Project names: ${s.s.map((p) => p.n).join(", ")}`, "Issues closed in each, and how many projects you closed issues in"], sensitive: true }
        : none("project names");
    case "signature":
      return s.m ? { items: [year, `Project and label names: ${s.m.p} + ${s.m.l}`, "How often they appeared together"], sensitive: true } : none("project or label names");
    case "photo-finish":
      return s.o
        ? {
            items: [year, s.o.t ? `Issue title: “${s.o.t}” (no ID or link)` : "No issue title", "Date and time of the completion"],
            sensitive: s.o.t !== null,
          }
        : none("issue title");
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
