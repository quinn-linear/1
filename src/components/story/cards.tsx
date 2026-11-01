"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { CARD_IDS, formatDay, monthName, plural, prettyService, type CardId, type Recap } from "@/lib/recap";
import { daysInYear } from "@/lib/share/art";
import { SPARSE_NOTE, recapDensity } from "@/lib/sparse";
import { ClockFace, ComebackTimeline, ConstellationChart, FinishLine, ScopeChart } from "./recapCharts";
import { AgeTrack, DayChain, Meter, MonthChart, Ring, YearSpark } from "./charts";
import { ArchetypeArt } from "./ArchetypeArt";
import { DiskCard } from "./DiskCard";
import { Avatar, Blurb, CountUp, Footnote, Headline, Huge, Kicker, Reveal, sunny } from "./primitives";

export const CARD_TITLES: Record<CardId, string> = {
  intro: "Intro",
  total: "Issues closed",
  archetype: "Your archetype",
  peak: "Peak month",
  streak: "Longest streak",
  comeback: "The Comeback",
  project: "Biggest project",
  constellation: "Your year as a constellation",
  scope: "Scope Shapeshifter",
  collaborator: "Top collaborator",
  integrations: "Integrations",
  "got-away": "The one that got away",
  label: "Label of the year",
  signature: "Signature move",
  "photo-finish": "Photo finish",
  summary: "Summary",
};

/** "12%" / "<1%": share of closed issues, rounded honestly. */
const share = (part: number, whole: number) => {
  const pct = (part / whole) * 100;
  return pct > 0 && pct < 1 ? "<1%" : `${Math.round(pct)}%`;
};

function Missing({ children }: { children: ReactNode }) {
  return <Blurb>{children}</Blurb>;
}

function Intro({ r }: { r: Recap }) {
  return (
    <>
      <Reveal>
        <Avatar name={r.viewer.name} src={r.viewer.avatarUrl} />
      </Reveal>
      <Reveal>
        <Kicker>Hey {r.viewer.name}</Kicker>
      </Reveal>
      <Reveal>
        <h1 className="text-[min(18vw,14dvh)] leading-[0.85] sm:text-[min(9.5rem,17dvh)]">
          Your {r.year}
          <span className={`block ${sunny}`}>in Linear</span>
        </h1>
      </Reveal>
      <Reveal>
        <YearSpark monthly={r.monthly} />
      </Reveal>
      <Reveal>
        <Blurb>Tap, swipe or press → to page through. Snacks optional.</Blurb>
      </Reveal>
      {recapDensity(r) === "sparse" && (
        <Reveal>
          <Footnote>{SPARSE_NOTE(r.totalClosed, r.year)}</Footnote>
        </Reveal>
      )}
    </>
  );
}

function Total({ r }: { r: Recap }) {
  return (
    <>
      <Reveal>
        <Kicker>You closed</Kicker>
      </Reveal>
      <Reveal className="w-full">
        <Ring value={r.activeDays / daysInYear(r.year)} label={`${plural(r.totalClosed, "issue")} closed on ${plural(r.activeDays, "active day")}, out of ${daysInYear(r.year)} days in ${r.year}`} size={320}>
          <Huge className={`text-[min(17vw,13dvh)] sm:text-[min(6.5rem,12dvh)] ${sunny}`}>
            <CountUp to={r.totalClosed} />
          </Huge>
          <p className="mt-2 font-mono text-sm uppercase tracking-[0.25em] text-ph/70">{r.totalClosed === 1 ? "issue" : "issues"}</p>
        </Ring>
      </Reveal>
      <Reveal>
        <Blurb>
          {r.totalClosed === 0
            ? `Nothing closed in ${r.year} yet. The backlog is nervous.`
            : `The ring is ${plural(r.activeDays, "active day")} out of ${daysInYear(r.year)}. That's a lot of green checkmarks.`}
        </Blurb>
      </Reveal>
      {r.truncated && <Footnote>Linear returned more issues than we fetch, so this may be an undercount.</Footnote>}
    </>
  );
}

function Archetype({ r }: { r: Recap }) {
  return (
    <>
      <Reveal>
        <Kicker>Your archetype</Kicker>
      </Reveal>
      <Reveal className="mx-auto">
        <ArchetypeArt id={r.archetype.id} priority className="w-[min(72vw,20rem,34dvh)]" />
      </Reveal>
      <Reveal>
        <Headline className={`text-[min(15vw,11dvh)] sm:text-8xl ${sunny}`}>{r.archetype.name}</Headline>
      </Reveal>
      <Reveal>
        <p className="text-xl font-medium tracking-tight text-ph/90 sm:text-3xl">{r.archetype.tagline}</p>
      </Reveal>
      <Reveal>
        <Blurb>{r.archetype.description}</Blurb>
      </Reveal>
      {r.archetype.insufficientData && <Footnote>Too few closed issues to read a pattern, so you get the default.</Footnote>}
    </>
  );
}

function Peak({ r }: { r: Recap }) {
  const peak = r.peakMonth ? r.peakMonth.month - 1 : null;
  return (
    <>
      <Reveal>
        <Kicker>Peak month</Kicker>
      </Reveal>
      {r.peakMonth ? (
        <>
          <Reveal>
            <Headline className={sunny}>{monthName(r.peakMonth.month)}</Headline>
          </Reveal>
          <Reveal>
            <Blurb>{plural(r.peakMonth.count, "issue")} closed. Drag across the chart to explore every month.</Blurb>
          </Reveal>
        </>
      ) : (
        <Reveal>
          <Missing>No closed issues, so no peak. Next year&apos;s chart has room to grow.</Missing>
        </Reveal>
      )}
      <Reveal className="w-full">
        <MonthChart monthly={r.monthly} peak={peak ?? null} />
      </Reveal>
    </>
  );
}

function Streak({ r }: { r: Recap }) {
  const s = r.longestStreak;
  return (
    <>
      <Reveal>
        <Kicker>Longest streak</Kicker>
      </Reveal>
      {s ? (
        <>
          <Reveal>
            <Huge className="text-ph">
              <CountUp to={s.days} />
            </Huge>
          </Reveal>
          <Reveal>
            <Headline className={sunny}>{s.days === 1 ? "day in a row." : "days in a row."}</Headline>
          </Reveal>
          <Reveal className="w-full">
            <DayChain days={s.days} label={`${plural(s.days, "day")} in a row, ${s.days === 1 ? formatDay(s.start) : `${formatDay(s.start)} to ${formatDay(s.end)}`}`} />
          </Reveal>
          <Reveal>
            <Blurb>
              {s.days === 1 ? formatDay(s.start) : `${formatDay(s.start)} to ${formatDay(s.end)}`}. {s.days >= 5 ? "Unstoppable." : "A start is a start."}
            </Blurb>
          </Reveal>
        </>
      ) : (
        <Reveal>
          <Missing>No streak yet. Close something on consecutive days and it shows up here.</Missing>
        </Reveal>
      )}
    </>
  );
}

function Project({ r }: { r: Recap }) {
  const p = r.biggestProject;
  return (
    <>
      <Reveal>
        <Kicker>Biggest project</Kicker>
      </Reveal>
      {p ? (
        <>
          <Reveal>
            <Headline className={`break-words ${sunny}`}>{p.name}</Headline>
          </Reveal>
          <Reveal>
            <Huge className="text-[min(22vw,16dvh)] sm:text-[min(9rem,16dvh)]">
              <CountUp to={p.closedCount} />
            </Huge>
          </Reveal>
          {r.totalClosed > 0 && (
            <Reveal className="w-full">
              <Meter
                value={p.closedCount / r.totalClosed}
                label={`${p.closedCount} of your ${r.totalClosed} closed issues`}
                caption={`${share(p.closedCount, r.totalClosed)} of everything you closed`}
              />
            </Reveal>
          )}
          <Reveal>
            <Blurb>{p.closedCount === 1 ? "issue" : "issues"} closed here. You basically live in it.</Blurb>
          </Reveal>
        </>
      ) : (
        <Reveal>
          <Missing>None of your closed issues belong to a project, so no winner this year.</Missing>
        </Reveal>
      )}
    </>
  );
}

function Collaborator({ r }: { r: Recap }) {
  const c = r.topCollaborator;
  return (
    <>
      <Reveal>
        <Kicker>Top collaborator</Kicker>
      </Reveal>
      {c ? (
        <>
          <Reveal className="w-full">
            <div className="flex items-center gap-3" aria-hidden>
              <Avatar name={r.viewer.name} src={r.viewer.avatarUrl} size="h-20 w-20 sm:h-24 sm:w-24" />
              <div className="relative h-0 flex-1 overflow-visible border-t-2 border-dashed border-[var(--a1)]">
                <motion.span className="absolute -top-[7px] h-3 w-3 bg-[var(--a2)]" animate={{ left: ["0%", "100%", "0%"] }} transition={{ duration: 4, ease: "linear", repeat: Infinity }} />
              </div>
              <Avatar name={c.name} src={c.avatarUrl} size="h-20 w-20 sm:h-24 sm:w-24" />
            </div>
          </Reveal>
          <Reveal>
            <Headline className={`break-words ${sunny}`}>{c.name}</Headline>
          </Reveal>
          <Reveal>
            <Blurb>
              {plural(c.sharedIssues, "closed issue")} passed between the two of you, counting issues you created for each other.
            </Blurb>
          </Reveal>
        </>
      ) : (
        <Reveal>
          <Missing>No one stands out yet. We only see issues you and someone else created or assigned to each other.</Missing>
        </Reveal>
      )}
      <Footnote>Based on creator/assignee only. Comments, mentions and reviews aren&apos;t counted.</Footnote>
    </>
  );
}

const ORBIT_MAX = 8;

function Integrations({ r }: { r: Recap }) {
  const { status, services } = r.integrations;
  const shown = services.slice(0, ORBIT_MAX);
  const extra = services.length - shown.length;
  return (
    <>
      <Reveal>
        <Kicker>Integrations</Kicker>
      </Reveal>
      {status === "ok" && services.length > 0 ? (
        <>
          <Reveal className="relative mx-auto my-2 h-72 w-72 sm:h-96 sm:w-96">
            <div aria-hidden className="absolute inset-[12%] border border-dashed border-ph/40" />
            <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center panel text-center font-mono text-xs font-medium uppercase leading-tight tracking-widest">
              Your
              <br />
              workspace
            </div>
            <motion.ul
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{ duration: 60, ease: "linear", repeat: Infinity }}
              aria-label="Connected services"
            >
              {shown.map((s, i) => {
                const angle = (360 / shown.length) * i;
                return (
                  <li key={s} className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transform: `rotate(${angle}deg) translateY(-8.5rem)` }}>
                    <motion.span
                      className="panel absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap px-3 py-1 text-xs font-medium text-ph sm:text-sm"
                      style={{ rotate: -angle }}
                      animate={{ rotate: [-angle, -angle - 360] }}
                      transition={{ duration: 60, ease: "linear", repeat: Infinity }}
                    >
                      {prettyService(s)}
                    </motion.span>
                  </li>
                );
              })}
            </motion.ul>
          </Reveal>
          <Reveal>
            <Blurb>
              {plural(services.length, "service")} wired into your workspace{extra > 0 ? ` (${extra} more not shown)` : ""}. Fully connected, spiritually too.
            </Blurb>
          </Reveal>
        </>
      ) : (
        <Reveal>
          <Headline className={sunny}>{status === "ok" ? "Flying solo." : "Can't see these."}</Headline>
          <div className="mt-4">
            <Blurb>
              {status === "ok"
                ? "No integrations are visible in your workspace."
                : "Linear's read-only access doesn't let us list integrations, so we won't guess."}
            </Blurb>
          </div>
        </Reveal>
      )}
      <Footnote>These are workspace-level integrations, not necessarily yours personally.</Footnote>
    </>
  );
}

function GotAway({ r }: { r: Recap }) {
  const o = r.oldestOpenIssue;
  return (
    <>
      <Reveal>
        <Kicker>The one that got away</Kicker>
      </Reveal>
      {o ? (
        <>
          <Reveal>
            <p className="font-mono text-lg font-medium text-ph/70 sm:text-2xl">{o.identifier}</p>
            <Headline className={`mt-2 break-words text-[min(9vw,7dvh)] sm:text-6xl ${sunny}`}>{o.title}</Headline>
          </Reveal>
          <Reveal>
            <Huge className="text-[min(20vw,15dvh)] sm:text-[min(8rem,14dvh)]">
              <CountUp to={o.ageDays} />
            </Huge>
          </Reveal>
          <Reveal className="w-full">
            <AgeTrack days={o.ageDays} label={`Open for ${plural(o.ageDays, "day")}`} />
          </Reveal>
          <Reveal>
            <Blurb>{o.ageDays === 1 ? "day" : "days"} open, assigned to you since {formatDay(o.createdAt, true)}. Maybe this is the year.</Blurb>
          </Reveal>
        </>
      ) : (
        <Reveal>
          <Headline className={sunny}>Nothing open.</Headline>
          <div className="mt-4">
            <Blurb>No open issues assigned to you. Either spotless or suspicious.</Blurb>
          </div>
        </Reveal>
      )}
    </>
  );
}

function Label({ r }: { r: Recap }) {
  const l = r.labelOfYear;
  return (
    <>
      <Reveal>
        <Kicker>Label of the year</Kicker>
      </Reveal>
      {l ? (
        <>
          <Reveal>
            <Headline className={`break-words text-[min(16vw,12dvh)] sm:text-8xl ${sunny}`}>{l.name}</Headline>
          </Reveal>
          {r.totalClosed > 0 && (
            <Reveal className="w-full">
              <Meter value={l.count / r.totalClosed} label={`${l.count} of your ${r.totalClosed} closed issues`} caption={`On ${share(l.count, r.totalClosed)} of everything you closed`} />
            </Reveal>
          )}
          <Reveal>
            <Blurb>
              Stuck to {plural(l.count, "issue")} you closed. It&apos;s basically your personality.
            </Blurb>
          </Reveal>
        </>
      ) : (
        <Reveal>
          <Missing>None of your closed issues carried a label. Mysterious and minimalist.</Missing>
        </Reveal>
      )}
    </>
  );
}

const COMEBACK_RULE = "A comeback is 14+ days with nothing closed, then 5+ issues closed within 7 days of returning. Quiet means no completions in Linear, not time off.";
const COMEBACK_MISSING = {
  "insufficient-history": "Needs completions on at least two different days to look for a comeback.",
  "no-quiet-stretch": "No stretch of 14+ days without a closed issue between completions, so there was nothing to come back from.",
  "no-burst": "There were quiet stretches, but none was followed by 5+ closed issues within 7 days of returning.",
} as const;

function Comeback({ r }: { r: Recap }) {
  const c = r.comeback;
  return (
    <>
      <Reveal>
        <Kicker>The Comeback</Kicker>
      </Reveal>
      {c.status === "ok" ? (
        <>
          <Reveal>
            <Huge className={`text-[min(24vw,18dvh)] sm:text-[min(9rem,16dvh)] ${sunny}`}>
              <CountUp to={c.burstCount} />
            </Huge>
          </Reveal>
          <Reveal>
            <Headline className="text-[min(9vw,7dvh)] sm:text-5xl">
              {c.burstCount === 1 ? "issue" : "issues"} in {plural(c.burstDays, "day")}.
            </Headline>
          </Reveal>
          <Reveal className="w-full">
            <ComebackTimeline year={r.year} data={c} />
          </Reveal>
          <Reveal>
            <Blurb>
              After {plural(c.quietDays, "quiet day")} with nothing closed ({formatDay(c.quietStart)} to {formatDay(c.quietEnd)}), you were back on {formatDay(c.returnDate)}.
            </Blurb>
          </Reveal>
        </>
      ) : (
        <>
          <Reveal>
            <Headline className={sunny}>No comeback yet.</Headline>
          </Reveal>
          <Reveal>
            <Missing>{COMEBACK_MISSING[c.reason]}</Missing>
          </Reveal>
        </>
      )}
      <Footnote>{COMEBACK_RULE}</Footnote>
    </>
  );
}

function Constellation({ r }: { r: Recap }) {
  const c = r.constellation;
  return (
    <>
      <Reveal>
        <Kicker>Your year as a constellation</Kicker>
      </Reveal>
      {c.stars.length > 0 ? (
        <>
          <Reveal>
            <Headline className={sunny}>
              {c.totalProjects} {c.totalProjects === 1 ? "project" : "projects"} lit up.
            </Headline>
          </Reveal>
          <Reveal className="w-full">
            <ConstellationChart stars={c.stars} />
          </Reveal>
          <Reveal>
            <Blurb>Star size follows the issues you closed in each project{c.totalProjects > c.stars.length ? `. The ${c.stars.length} biggest are shown` : ""}.</Blurb>
          </Reveal>
        </>
      ) : (
        <Reveal>
          <Missing>None of your closed issues belong to a project, so there are no stars to draw.</Missing>
        </Reveal>
      )}
      {c.withoutProject > 0 && <Footnote>{plural(c.withoutProject, "closed issue")} had no project, so they aren&apos;t stars.</Footnote>}
    </>
  );
}

function Scope({ r }: { r: Recap }) {
  const s = r.scope;
  const note = "Projects and labels are the ones on issues now, grouped by the quarter each closed. A shift of 0% means the same mix, 100% an entirely different one. Issues with several labels count once per label.";
  if (s.status !== "ok") {
    return (
      <>
        <Reveal>
          <Kicker>Scope Shapeshifter</Kicker>
        </Reveal>
        <Reveal>
          <Headline className={sunny}>Too early to tell.</Headline>
        </Reveal>
        <Reveal>
          <Missing>
            Comparing quarters needs at least two with 5+ closed issues each. Yours: {s.quarterClosed.map((n, i) => `Q${i + 1} ${n}`).join(", ")}.
          </Missing>
        </Reveal>
        <Footnote>{note}</Footnote>
      </>
    );
  }
  const top = Math.max(s.projectShiftPercent, s.labelShiftPercent);
  return (
    <>
      <Reveal>
        <Kicker>Scope Shapeshifter</Kicker>
      </Reveal>
      <Reveal>
        <Headline className={sunny}>{top >= 50 ? "Full shapeshift." : top >= 25 ? "Shifting scope." : "Steady scope."}</Headline>
      </Reveal>
      <Reveal className="w-full">
        <ScopeChart scope={s} />
      </Reveal>
      <Reveal>
        <Blurb>
          Between Q{s.fromQuarter} and Q{s.toQuarter}, your project mix shifted {s.projectShiftPercent}% and your label mix {s.labelShiftPercent}%.
        </Blurb>
      </Reveal>
      <Footnote>{note}</Footnote>
    </>
  );
}

function Signature({ r }: { r: Recap }) {
  const g = r.signature;
  const coverage = `Based on ${g.eligible.toLocaleString("en-US")} of your ${r.totalClosed.toLocaleString("en-US")} closed issues: the ones with both a project and a label. Compared only with your own work, not with anyone else.`;
  return (
    <>
      <Reveal>
        <Kicker>Signature move</Kicker>
      </Reveal>
      {g.status === "ok" ? (
        <>
          <Reveal>
            <Headline className={`break-words text-[min(10vw,8dvh)] sm:text-6xl ${sunny}`}>
              {g.project} + {g.label}
            </Headline>
          </Reveal>
          <Reveal className="flex w-full flex-col gap-4">
            <Meter value={g.labelInProjectPercent / 100} label={`${g.labelInProjectPercent}% of your ${g.label} issues were in ${g.project}`} caption={`${g.labelInProjectPercent}% of ${g.label} issues are in ${g.project}`} />
            <Meter value={g.projectSharePercent / 100} label={`${g.project} is ${g.projectSharePercent}% of your labeled project work`} caption={`${g.project} is ${g.projectSharePercent}% of all your labeled project work`} />
          </Reveal>
          <Reveal>
            <Blurb>
              {plural(g.pairCount, "issue")} with this pair, {g.lift.toFixed(1)}x as often as the project and label alone would suggest.
            </Blurb>
          </Reveal>
        </>
      ) : (
        <>
          <Reveal>
            <Headline className={sunny}>No signature yet.</Headline>
          </Reveal>
          <Reveal>
            <Missing>
              A signature move needs a project and label pair on 3+ issues that clearly stands out in your own mix. None did
              {g.eligible === 0 ? ", since none of your closed issues have both a project and a label" : ""}.
            </Missing>
          </Reveal>
        </>
      )}
      <Footnote>{coverage}</Footnote>
    </>
  );
}

function PhotoFinish({ r }: { r: Recap }) {
  const f = r.photoFinish;
  return (
    <>
      <Reveal>
        <Kicker>Photo finish</Kicker>
      </Reveal>
      {f ? (
        <>
          <Reveal className="flex max-w-full items-center gap-3 sm:gap-5">
            <ClockFace time={f.time} />
            <Huge className={`!text-[min(14vw,12dvh)] sm:!text-[min(7rem,13dvh)] ${sunny}`}>{f.time}</Huge>
          </Reveal>
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-widest text-ph/70">The last thing you closed</p>
            <Headline className="mt-2 break-words text-[min(8vw,6dvh)] sm:text-5xl">{f.title ?? "An issue"}</Headline>
          </Reveal>
          <Reveal className="w-full">
            <FinishLine year={r.year} date={f.date} label={`Last completion of ${r.year}: ${formatDay(f.date)} at ${f.time}`} />
          </Reveal>
          <Reveal>
            <Blurb>
              {f.daysBeforeYearEnd === null
                ? `Your latest close so far was ${formatDay(f.date)}. ${r.year} isn't over, so this can still change.`
                : f.daysBeforeYearEnd === 0
                  ? `${formatDay(f.date)}: you closed one on the very last day of ${r.year}.`
                  : `${formatDay(f.date)}, ${plural(f.daysBeforeYearEnd, "day")} before ${r.year} ended.`}
            </Blurb>
          </Reveal>
        </>
      ) : (
        <Reveal>
          <Missing>Nothing closed in {r.year} yet, so there&apos;s no finish to photograph.</Missing>
        </Reveal>
      )}
      <Footnote>Latest completion in {r.year}, by time in your Linear timezone.</Footnote>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ph/40 py-1.5 last:border-0">
      <dt className="font-mono text-sm uppercase tracking-widest text-ph/70">{k}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium">{v}</dd>
    </div>
  );
}

function Summary({ r }: { r: Recap }) {
  const none = "n/a";
  return (
    <>
      <Reveal className="mx-auto">
        <Kicker>
          {r.viewer.name}&apos;s {r.year} in Linear
        </Kicker>
      </Reveal>
      <Reveal className="mx-auto flex w-full justify-center">
        <DiskCard recap={r} />
      </Reveal>
      <Reveal className="mx-auto">
        <p className="text-center text-xs text-ph/70">Tilt the disk, or touch and drag. Download it from Share.</p>
      </Reveal>
      <Reveal className="mx-auto w-full max-w-sm">
        <details className="panel px-4 py-2 text-left" data-no-nav>
          <summary className="cursor-pointer py-1 font-mono text-sm uppercase tracking-widest text-ph/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber">
            All your numbers
          </summary>
          <dl className="mt-1">
            <Row k="Issues closed" v={r.totalClosed.toLocaleString("en-US")} />
            <Row k="Archetype" v={r.archetype.name} />
            <Row k="Peak month" v={r.peakMonth ? `${monthName(r.peakMonth.month)} (${plural(r.peakMonth.count, "issue")})` : none} />
            <Row k="Longest streak" v={r.longestStreak ? plural(r.longestStreak.days, "day") : none} />
            <Row k="Active days" v={r.activeDays.toLocaleString("en-US")} />
            <Row k="Biggest project" v={r.biggestProject ? `${r.biggestProject.name} (${r.biggestProject.closedCount})` : none} />
            <Row k="Top collaborator" v={r.topCollaborator?.name ?? none} />
            <Row k="Comeback" v={r.comeback.status === "ok" ? `${plural(r.comeback.burstCount, "issue")} in ${plural(r.comeback.burstDays, "day")} after ${plural(r.comeback.quietDays, "quiet day")}` : none} />
            <Row k="Signature move" v={r.signature.status === "ok" ? `${r.signature.project} + ${r.signature.label}` : none} />
            <Row k="Photo finish" v={r.photoFinish ? `${formatDay(r.photoFinish.date)}, ${r.photoFinish.time}` : none} />
            <Row k="Label of the year" v={r.labelOfYear?.name ?? none} />
            <Row k="One that got away" v={r.oldestOpenIssue ? `${r.oldestOpenIssue.identifier}, ${plural(r.oldestOpenIssue.ageDays, "day")} open` : none} />
          </dl>
        </details>
      </Reveal>
      {r.truncated && <Footnote>Linear returned more issues than we fetch, so counts may be undercounts.</Footnote>}
      <Reveal className="mx-auto">
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="panel px-5 py-2 text-sm font-medium text-ph/80 transition hover:text-ph focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber">
            Sign out
          </button>
        </form>
      </Reveal>
    </>
  );
}

const RENDERERS: Record<CardId, (props: { r: Recap }) => ReactNode> = {
  intro: Intro,
  total: Total,
  archetype: Archetype,
  peak: Peak,
  streak: Streak,
  comeback: Comeback,
  project: Project,
  constellation: Constellation,
  scope: Scope,
  collaborator: Collaborator,
  integrations: Integrations,
  "got-away": GotAway,
  label: Label,
  signature: Signature,
  "photo-finish": PhotoFinish,
  summary: Summary,
};

export { CARD_IDS };

export function CardBody({ id, recap }: { id: CardId; recap: Recap }) {
  const Render = RENDERERS[id];
  return <Render r={recap} />;
}
