import { LOADING_HINT } from "@/lib/sparse";
import { LoadingMessage } from "./LoadingMessage";

/**
 * Suspense fallback for `/wrapped` while stats are computed. A server component
 * with CSS-only motion (off under reduced motion) and an indeterminate look on
 * purpose: we don't know how far along the Linear API calls are, so no progress
 * bar or percentage is shown. The disk drive spins up and the cursor blinks.
 */
export function WrappedLoading({ year }: { year: number }) {
  return (
    <main className="desk flex min-h-dvh items-center px-2 py-4 sm:px-6">
      <div className="case mx-auto w-full max-w-3xl rounded-[14px] p-3 sm:p-5">
        <div className="crt relative min-h-[22rem] overflow-hidden rounded-[2.5%/3.5%] border-4 border-[#0d0c08] p-5 text-ph phosphor sm:p-8" role="status">
          <span className="sr-only">Wrapping your {year} in Linear. This can take a moment.</span>
          <div aria-hidden className="flex min-h-[19rem] flex-col justify-end gap-1 text-xl uppercase sm:text-3xl">
            <p>LOAD &quot;LINEAR WRAPPED {year}&quot;,8</p>
            <p>SEARCHING FOR YOUR YEAR</p>
            <p className="text-amber">LOADING</p>
            <LoadingMessage />
            <p className="mt-3 max-w-md text-base normal-case text-ph/80 sm:text-xl">{LOADING_HINT}</p>
            <p>
              <span className="cursor-block" />
            </p>
          </div>
          <div aria-hidden className="absolute right-5 top-5 flex items-center gap-2 text-base uppercase text-amber sm:text-xl">
            Drive busy <span className="h-3 w-3 bg-[var(--led)] shadow-[0_0_8px_var(--led)]" />
          </div>
        </div>
      </div>
    </main>
  );
}
