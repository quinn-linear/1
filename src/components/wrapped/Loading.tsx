import { LOADING_HINT } from "@/lib/sparse";
import { LoadingMessage } from "./LoadingMessage";

const stackCards = [
  "from-indigo-400 to-fuchsia-400 [animation-delay:0s]",
  "from-cyan-300 to-violet-400 [animation-delay:-0.4s]",
  "from-amber-200 to-pink-400 [animation-delay:-0.8s]",
];

/**
 * Suspense fallback for `/wrapped` while stats are computed. It's a server
 * component with CSS-only motion (off under reduced motion) and an indeterminate
 * look on purpose: we don't know how far along the Linear API calls are, so no
 * progress bar or percentage is shown.
 */
export function WrappedLoading({ year }: { year: number }) {
  return (
    <main className="relative isolate flex min-h-dvh items-center overflow-hidden px-6 sm:px-10">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="animate-drift absolute -left-1/4 -top-1/4 h-[60vmax] w-[60vmax] rounded-full bg-indigo-500/25 blur-[140px]" />
        <div className="grid-fade absolute inset-0" />
        <div className="grain absolute inset-0" />
      </div>

      <div role="status" className="mx-auto flex w-full max-w-2xl flex-col items-start gap-6">
        <span className="sr-only">Wrapping your {year} in Linear. This can take a moment.</span>

        <div aria-hidden className="relative h-32 w-24">
          {stackCards.map((card, i) => (
            <div
              key={card}
              className={`animate-wobble absolute inset-0 rounded-2xl bg-gradient-to-br opacity-80 shadow-[0_0_40px_-8px_rgba(167,139,250,0.7)] ring-1 ring-white/30 ${card}`}
              style={{ transform: `rotate(${(i - 1) * 9}deg)` }}
            />
          ))}
        </div>

        <h1 aria-hidden className="text-[12vw] font-semibold leading-[0.92] tracking-[-0.045em] sm:text-7xl">
          Wrapping your {year}
        </h1>
        <LoadingMessage />
        <p aria-hidden className="max-w-md text-sm text-white/45">
          {LOADING_HINT}
        </p>
      </div>
    </main>
  );
}
