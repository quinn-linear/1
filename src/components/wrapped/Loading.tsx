import { LOADING_HINT } from "@/lib/sparse";
import { LoadingMessage } from "./LoadingMessage";

const stackCards = [
  "from-fuchsia-500 to-pink-500 [animation-delay:0s]",
  "from-amber-400 to-orange-500 [animation-delay:-0.4s]",
  "from-cyan-400 to-indigo-500 [animation-delay:-0.8s]",
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
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-br from-fuchsia-700 via-indigo-800 to-slate-950">
        <div className="animate-drift absolute -left-1/4 -top-1/4 h-[60vmax] w-[60vmax] rounded-full bg-orange-500/30 blur-[120px]" />
      </div>

      <div role="status" className="mx-auto flex w-full max-w-2xl flex-col items-start gap-6">
        <span className="sr-only">Wrapping your {year} in Linear. This can take a moment.</span>

        <div aria-hidden className="relative h-32 w-24">
          {stackCards.map((card, i) => (
            <div
              key={card}
              className={`animate-wobble absolute inset-0 rounded-2xl bg-gradient-to-br shadow-xl ${card}`}
              style={{ transform: `rotate(${(i - 1) * 9}deg)` }}
            />
          ))}
        </div>

        <h1 aria-hidden className="text-[13vw] font-black leading-[0.9] tracking-tighter sm:text-7xl">
          Wrapping your {year}
        </h1>
        <LoadingMessage />
        <p aria-hidden className="max-w-md text-sm font-medium text-white/70">
          {LOADING_HINT}
        </p>
      </div>
    </main>
  );
}
