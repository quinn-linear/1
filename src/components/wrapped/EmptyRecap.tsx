import Link from "next/link";
import { plural, prettyService, type Recap } from "@/lib/recap";
import { COUNTING_RULE } from "@/lib/sparse";

const button =
  "rounded-full px-5 py-3 text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * Shown on `/wrapped` when nothing was closed in the year. Keeps whatever real
 * metrics we do have (oldest open issue, integrations) and explains the zero
 * instead of walking through eleven empty cards. Nothing here is estimated.
 */
export function EmptyRecap({ recap }: { recap: Recap }) {
  const { oldestOpenIssue: oldest, integrations } = recap;
  const services = integrations.status === "ok" ? integrations.services : [];

  return (
    <main className="relative isolate flex min-h-dvh items-center overflow-hidden px-6 py-12 sm:px-10">
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-600 via-zinc-800 to-black" />
      <div className="animate-rise mx-auto flex w-full max-w-2xl flex-col items-start gap-5">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-white/75">Hey {recap.viewer.name}</p>
        <h1 className="text-[13vw] font-black leading-[0.9] tracking-tighter sm:text-7xl">
          A quiet {recap.year} so far.
        </h1>
        <p className="max-w-lg text-lg font-medium text-white/85 sm:text-2xl">
          No closed issues to wrap up yet, so there&apos;s no streak, peak month or archetype pattern to show.
        </p>
        <p className="max-w-lg text-sm font-medium text-white/70">{COUNTING_RULE(recap.year)}</p>
        {recap.truncated && (
          <p className="max-w-lg text-sm font-medium text-white/70">
            Linear returned more issues than we fetch, so this may be incomplete.
          </p>
        )}

        {(oldest || services.length > 0) && (
          <ul className="flex max-w-lg flex-col gap-2 rounded-3xl bg-white/10 p-5 text-base font-medium ring-1 ring-white/20">
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
          <a href="https://linear.app" target="_blank" rel="noopener noreferrer" className={`${button} bg-white text-indigo-950 hover:bg-white/90`}>
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
