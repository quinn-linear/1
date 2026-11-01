"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { CARD_IDS, formatDay, monthName, plural, prettyService, type CardId, type Recap } from "@/lib/recap";
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

/** Full-bleed background gradient per card. */
export const CARD_BACKGROUNDS: Record<CardId, string> = {
  intro: "from-fuchsia-700 via-indigo-800 to-slate-950",
  total: "from-orange-500 via-rose-600 to-purple-900",
  archetype: "from-violet-600 via-fuchsia-700 to-slate-950",
  peak: "from-emerald-500 via-teal-700 to-slate-950",
  streak: "from-amber-400 via-orange-600 to-red-900",
  project: "from-sky-500 via-indigo-700 to-slate-950",
  collaborator: "from-pink-500 via-rose-700 to-indigo-950",
  integrations: "from-cyan-500 via-blue-800 to-slate-950",
  "got-away": "from-slate-600 via-zinc-800 to-black",
  label: "from-lime-400 via-emerald-700 to-slate-950",
  summary: "from-fuchsia-600 via-purple-800 to-indigo-950",
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
        <h1 className="text-[17vw] font-black leading-[0.85] tracking-tighter sm:text-[9rem]">
          Your {r.year}
          <span className={`block ${sunny}`}>in Linear</span>
        </h1>
      </Reveal>
      <Reveal>
        <Blurb>Tap to see what you shipped. Snacks optional.</Blurb>
      </Reveal>
    </>
  );
}

function Total({ r }: { r: Recap }) {
  return (
    <>
      <Reveal>
        <Kicker>You closed</Kicker>
      </Reveal>
      <Reveal>
        <Huge className={sunny}>
          <CountUp to={r.totalClosed} />
        </Huge>
      </Reveal>
      <Reveal>
        <Headline>{r.totalClosed === 1 ? "issue." : "issues."}</Headline>
      </Reveal>
      <Reveal>
        <Blurb>
          {r.totalClosed === 0
            ? `Nothing closed in ${r.year} yet. The backlog is nervous.`
            : `Across ${plural(r.activeDays, "active day")}. That's a lot of green checkmarks.`}
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
      <Reveal>
        <Headline className={`text-[16vw] sm:text-8xl ${sunny}`}>{r.archetype.name}</Headline>
      </Reveal>
      <Reveal>
        <p className="text-2xl font-extrabold sm:text-4xl">{r.archetype.tagline}</p>
      </Reveal>
      <Reveal>
        <Blurb>{r.archetype.description}</Blurb>
      </Reveal>
      {r.archetype.insufficientData && <Footnote>Too few closed issues to read a pattern, so you get the default.</Footnote>}
    </>
  );
}

function Peak({ r }: { r: Recap }) {
  const max = Math.max(...r.monthly.map((m) => m.count), 1);
  const peak = r.peakMonth?.month;
  const label = r.monthly.map((m) => `${monthName(m.month, true)} ${m.count}`).join(", ");
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
            <Blurb>{plural(r.peakMonth.count, "issue")} closed. You were on one.</Blurb>
          </Reveal>
        </>
      ) : (
        <Reveal>
          <Missing>No closed issues, so no peak. Next year&apos;s chart has room to grow.</Missing>
        </Reveal>
      )}
      <Reveal className="w-full">
        <div role="img" aria-label={`Issues closed per month: ${label}`} className="flex h-52 w-full items-end gap-1.5 sm:h-64 sm:gap-2">
          {r.monthly.map((m, i) => {
            const isPeak = m.month === peak;
            return (
              <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1" aria-hidden>
                {isPeak && <span className="text-xs font-black sm:text-base">{m.count}</span>}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max((m.count / max) * 100, m.count > 0 ? 6 : 2)}%` }}
                  transition={{ delay: 0.5 + i * 0.05, type: "spring", stiffness: 120, damping: 16 }}
                  className={`w-full rounded-t-md ${isPeak ? "bg-gradient-to-t from-yellow-300 to-pink-300 shadow-[0_0_30px_rgba(253,224,71,0.7)]" : "bg-white/35"}`}
                />
                <span className={`text-[10px] font-bold sm:text-xs ${isPeak ? "text-yellow-200" : "text-white/70"}`}>{monthName(m.month, true)[0]}</span>
              </div>
            );
          })}
        </div>
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
          <Reveal>
            <Avatar name={c.name} src={c.avatarUrl} size="h-32 w-32" />
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
            <div aria-hidden className="absolute inset-[12%] rounded-full border border-dashed border-white/40" />
            <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-center text-xs font-black uppercase leading-tight shadow-[0_0_60px_rgba(255,255,255,0.35)] backdrop-blur">
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
                      className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-extrabold text-indigo-900 shadow-lg sm:text-sm"
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
            <p className="font-mono text-xl font-bold text-white/70 sm:text-3xl">{o.identifier}</p>
            <Headline className={`mt-2 break-words text-[10vw] sm:text-6xl ${sunny}`}>{o.title}</Headline>
          </Reveal>
          <Reveal>
            <Huge className="text-[20vw] sm:text-[8rem]">
              <CountUp to={o.ageDays} />
            </Huge>
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

function Tile({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/12 p-3 ring-1 ring-white/20 backdrop-blur sm:p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/65 sm:text-xs">{k}</p>
      <p className="mt-1 break-words text-lg font-black leading-tight sm:text-2xl">{v}</p>
      {sub && <p className="text-xs font-medium text-white/70">{sub}</p>}
    </div>
  );
}

function Summary({ r }: { r: Recap }) {
  const none = "n/a";
  return (
    <>
      <Reveal>
        <Kicker>
          {r.viewer.name}&apos;s {r.year} in Linear
        </Kicker>
      </Reveal>
      <Reveal>
        <Headline className={sunny}>{plural(r.totalClosed, "issue")} closed.</Headline>
      </Reveal>
      <Reveal className="w-full">
        <div className="grid w-full grid-cols-2 gap-2.5 sm:gap-3">
          <Tile k="Archetype" v={r.archetype.name} />
          <Tile k="Peak month" v={r.peakMonth ? monthName(r.peakMonth.month) : none} sub={r.peakMonth ? plural(r.peakMonth.count, "issue") : undefined} />
          <Tile k="Longest streak" v={r.longestStreak ? plural(r.longestStreak.days, "day") : none} />
          <Tile k="Active days" v={r.activeDays.toLocaleString("en-US")} />
          <Tile k="Biggest project" v={r.biggestProject?.name ?? none} sub={r.biggestProject ? plural(r.biggestProject.closedCount, "issue") : undefined} />
          <Tile k="Top collaborator" v={r.topCollaborator?.name ?? none} />
          <Tile k="Label of the year" v={r.labelOfYear?.name ?? none} />
          <Tile k="One that got away" v={r.oldestOpenIssue?.identifier ?? none} sub={r.oldestOpenIssue ? plural(r.oldestOpenIssue.ageDays, "day") + " open" : undefined} />
        </div>
      </Reveal>
      <Reveal>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="rounded-full border border-white/40 px-5 py-2 text-sm font-bold text-white/90 transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
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
