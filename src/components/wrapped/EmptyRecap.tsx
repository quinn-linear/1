import Link from "next/link";
import { plural, prettyService, type Recap } from "@/lib/recap";
import { COUNTING_RULE } from "@/lib/sparse";

/**
 * Shown on `/wrapped` when nothing was closed in the year. Keeps whatever real
 * metrics we do have (oldest open issue, integrations) and explains the zero
 * instead of walking through sixteen empty cards. Nothing here is estimated.
 */
export function EmptyRecap({ recap }: { recap: Recap }) {
  const { oldestOpenIssue: oldest, integrations } = recap;
  const services = integrations.status === "ok" ? integrations.services : [];

  return (
    <main className="desk flex min-h-dvh items-center px-2 py-4 sm:px-6">
      <div className="case mx-auto w-full max-w-3xl rounded-[14px] p-3 sm:p-5">
        <div className="crt relative overflow-hidden rounded-[2.5%/3.5%] border-4 border-[#0d0c08] p-5 text-ph phosphor sm:p-8">
          <div className="animate-rise flex w-full flex-col items-start gap-4">
            <p className="text-lg uppercase tracking-[0.18em] text-amber sm:text-2xl">&gt; Hey {recap.viewer.name}</p>
            <h1 className="text-6xl uppercase leading-[0.9] sm:text-8xl">A quiet {recap.year} so far.</h1>
            <p className="max-w-lg text-xl leading-snug sm:text-3xl">
              ?FILE NOT FOUND. No closed issues to wrap up yet, so there&apos;s no streak, peak month or archetype pattern to show.
            </p>
            <p className="max-w-lg text-lg text-ph/80">{COUNTING_RULE(recap.year)}</p>
            {recap.truncated && <p className="max-w-lg text-lg text-ph/80">Linear returned more issues than we fetch, so this may be incomplete.</p>}

            {(oldest || services.length > 0) && (
              <ul className="panel flex max-w-lg flex-col gap-2 p-4 text-xl">
                {oldest && (
                  <li>
                    Still on your plate: <span className="text-amber">{oldest.identifier}</span> {oldest.title}, open for {plural(oldest.ageDays, "day")}.
                  </li>
                )}
                {services.length > 0 && <li>Workspace integrations: {services.map(prettyService).join(", ")}.</li>}
              </ul>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <a href="https://linear.app" target="_blank" rel="noopener noreferrer" className="term-btn">
                Open Linear
              </a>
              <Link href="/wrapped?cards=1" className="term-btn">
                Peek at the cards anyway
              </Link>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="term-btn">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
