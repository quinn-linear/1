"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { CARD_IDS, formatDay, monthName, plural, prettyService, type CardId, type Recap } from "@/lib/recap";
import { daysInYear, sigil } from "@/lib/share/art";
import { CARD_ACCENTS } from "@/lib/share/theme";
import { SPARSE_NOTE, recapDensity } from "@/lib/sparse";
import { AgeTrack, DayChain, Meter, MonthChart, Ring, YearSpark } from "./charts";
import { HoloCard } from "./HoloCard";
import { Avatar, Blurb, CountUp, Footnote, Headline, Huge, Kicker, Reveal, sunny } from "./primitives";

export const CARD_TITLES: Record<CardId, string> = {
  intro: "Intro",
  total: "Issues closed",
  archetype: "Your archetype",
  peak: "Peak month",
  streak: "Longest streak",
  project: "Biggest project",
  collaborator: "Top collaborator",
  integrations: "Integrations",
  "got-away": "The one that got away",
  label: "Label of the year",
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
        <h1 className="text-[16vw] font-semibold leading-[0.88] tracking-[-0.055em] sm:text-[8.5rem]">
          Your {r.year}
          <span className={`block ${sunny}`}>in Linear</span>
        </h1>
      </Reveal>
      <Reveal>
        <YearSpark monthly={r.monthly} />
      </Reveal>
      <Reveal>
        <Blurb>Tap to see what you shipped. Snacks optional.</Blurb>
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
          <Huge className={`text-[17vw] sm:text-[6.5rem] ${sunny}`}>
            <CountUp to={r.totalClosed} />
          </Huge>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.25em] text-white/50">{r.totalClosed === 1 ? "issue" : "issues"}</p>
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
        <motion.div aria-hidden className="h-44 w-44 sm:h-60 sm:w-60" animate={{ rotate: 360 }} transition={{ duration: 90, ease: "linear", repeat: Infinity }}>
          <div className="h-full w-full drop-shadow-[0_0_30px_var(--a1)] [&>svg]:h-full [&>svg]:w-full">{sigil(r.archetype.id, 240, CARD_ACCENTS.archetype, "arc-sigil")}</div>
        </motion.div>
      </Reveal>
      <Reveal>
        <Headline className={`text-[15vw] sm:text-8xl ${sunny}`}>{r.archetype.name}</Headline>
      </Reveal>
      <Reveal>
        <p className="text-xl font-medium tracking-tight text-white/90 sm:text-3xl">{r.archetype.tagline}</p>
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
            <Huge className="text-white">
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
            <Huge className="text-[22vw] sm:text-[9rem]">
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
              <div className="relative h-px flex-1 overflow-visible bg-gradient-to-r from-[var(--a1)] to-[var(--a2)]">
                <motion.span className="absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-white shadow-[0_0_14px_var(--a1)]" animate={{ left: ["0%", "100%", "0%"] }} transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }} />
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
            <div aria-hidden className="absolute inset-[12%] rounded-full border border-dashed border-white/25" />
            <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full glass text-center font-mono text-[10px] font-medium uppercase leading-tight tracking-widest shadow-[0_0_70px_-10px_var(--a1)]">
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
                      className="glass absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium text-white shadow-[0_0_24px_-6px_var(--a1)] sm:text-sm"
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
            <p className="font-mono text-lg font-medium text-white/50 sm:text-2xl">{o.identifier}</p>
            <Headline className={`mt-2 break-words text-[9vw] sm:text-6xl ${sunny}`}>{o.title}</Headline>
          </Reveal>
          <Reveal>
            <Huge className="text-[20vw] sm:text-[8rem]">
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
            <Headline className={`break-words text-[16vw] sm:text-8xl ${sunny}`}>{l.name}</Headline>
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/10 py-1.5 last:border-0">
      <dt className="font-mono text-[11px] uppercase tracking-widest text-white/45">{k}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium">{v}</dd>
    </div>
  );
}

function Summary({ r }: { r: Recap }) {
  const none = "n/a";
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <Reveal>
        <Kicker>
          {r.viewer.name}&apos;s {r.year} in Linear
        </Kicker>
      </Reveal>
      <HoloCard recap={r} />
      <Reveal>
        <p className="text-center text-xs text-white/45">Tilt it, or touch and drag. Download it from Share.</p>
      </Reveal>
      <Reveal className="w-full max-w-sm">
        <details className="glass rounded-2xl px-4 py-2 text-left" data-no-nav>
          <summary className="cursor-pointer py-1 font-mono text-[11px] uppercase tracking-widest text-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
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
            <Row k="Label of the year" v={r.labelOfYear?.name ?? none} />
            <Row k="One that got away" v={r.oldestOpenIssue ? `${r.oldestOpenIssue.identifier}, ${plural(r.oldestOpenIssue.ageDays, "day")} open` : none} />
          </dl>
        </details>
      </Reveal>
      {r.truncated && <Footnote>Linear returned more issues than we fetch, so counts may be undercounts.</Footnote>}
      <Reveal>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="glass rounded-full px-5 py-2 text-sm font-medium text-white/80 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            Sign out
          </button>
        </form>
      </Reveal>
    </div>
  );
}

const RENDERERS: Record<CardId, (props: { r: Recap }) => ReactNode> = {
  intro: Intro,
  total: Total,
  archetype: Archetype,
  peak: Peak,
  streak: Streak,
  project: Project,
  collaborator: Collaborator,
  integrations: Integrations,
  "got-away": GotAway,
  label: Label,
  summary: Summary,
};

export { CARD_IDS };

export function CardBody({ id, recap }: { id: CardId; recap: Recap }) {
  const Render = RENDERERS[id];
  return <Render r={recap} />;
}
