import Link from "next/link";
import { plural, prettyService, type Recap } from "@/lib/recap";
import { COUNTING_RULE } from "@/lib/sparse";

const button =
  "rounded-full px-5 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * Shown on `/wrapped` when nothing was closed in the year. Keeps whatever real
 * metrics we do have (oldest open issue, integrations) and explains the zero
 * instead of walking through sixteen empty cards. Nothing here is estimated.
 */
export function EmptyRecap({ recap }: { recap: Recap }) {
  const { oldestOpenIssue: oldest, integrations } = recap;
  const services = integrations.status === "ok" ? integrations.services : [];

  return (
    <main className="relative isolate flex min-h-dvh items-center overflow-hidden px-6 py-12 sm:px-10">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -left-1/4 -top-1/3 h-[60vmax] w-[60vmax] rounded-full bg-slate-400/15 blur-[140px]" />
        <div className="grid-fade absolute inset-0" />
        <div className="grain absolute inset-0" />
      </div>
      <div className="animate-rise mx-auto flex w-full max-w-2xl flex-col items-start gap-5">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-white/60">Hey {recap.viewer.name}</p>
        <h1 className="text-[12vw] font-semibold leading-[0.92] tracking-[-0.045em] sm:text-7xl">
          A quiet {recap.year} so far.
        </h1>
        <p className="max-w-lg text-lg leading-relaxed text-white/65 sm:text-2xl">
          No closed issues to wrap up yet, so there&apos;s no streak, peak month or archetype pattern to show.
        </p>
        <p className="max-w-lg text-sm text-white/50">{COUNTING_RULE(recap.year)}</p>
        {recap.truncated && (
          <p className="max-w-lg text-sm text-white/50">
            Linear returned more issues than we fetch, so this may be incomplete.
          </p>
        )}

        {(oldest || services.length > 0) && (
          <ul className="flex max-w-lg flex-col gap-2 glass rounded-3xl p-5 text-base text-white/85">
            {oldest && (
              <li>
                Still on your plate: <span className="font-extrabold">{oldest.identifier}</span> {oldest.title}, open for{" "}
                {plural(oldest.ageDays, "day")}.
              </li>
            )}
            {services.length > 0 && (
              <li>
                Workspace integrations: {services.map(prettyService).join(", ")}.
              </li>
            )}
          </ul>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <a href="https://linear.app" target="_blank" rel="noopener noreferrer" className={`${button} bg-white text-black hover:bg-white/90`}>
            Open Linear
          </a>
          <Link href="/wrapped?cards=1" className={`${button} border border-white/30 text-white/90 hover:bg-white/10`}>
            Peek at the cards anyway
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className={`${button} text-white/70 hover:bg-white/10`}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
