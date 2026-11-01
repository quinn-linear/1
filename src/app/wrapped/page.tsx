import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/session";
import { getWrappedStats, type WrappedStats } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

export default async function WrappedPage() {
  const token = await getAccessToken();
  if (!token) redirect("/");

  // Computed server-side from the Linear API on first visit after login; the
  // result is never put in a cookie or client component (cards come later).
  let stats: WrappedStats | null = null;
  try {
    stats = await getWrappedStats(token);
  } catch {
    stats = null;
  }

  return (
    <main className="relative isolate flex min-h-dvh flex-col justify-between overflow-hidden px-6 pb-10 pt-8 sm:px-10">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="animate-drift absolute -left-1/4 -top-1/4 h-[70vmax] w-[70vmax] rounded-full bg-fuchsia-600/60 blur-[120px]" />
        <div className="animate-drift absolute -bottom-1/4 -right-1/4 h-[70vmax] w-[70vmax] rounded-full bg-indigo-600/60 blur-[120px] [animation-delay:-7s]" />
      </div>

      <header className="flex items-center justify-between text-sm font-semibold uppercase tracking-widest text-white/80">
        <span>Linear Wrapped</span>
        <span className="rounded-full border border-white/30 px-3 py-1">2026</span>
      </header>

      <div className="mx-auto w-full max-w-5xl py-12">
        <h1 className="animate-rise text-[20vw] font-black leading-[0.85] tracking-tighter sm:text-[9rem]">
          <span className="block">You&apos;re</span>
          <span className="block bg-gradient-to-r from-yellow-200 via-pink-300 to-cyan-200 bg-clip-text text-transparent">
            in.
          </span>
        </h1>
        <p className="animate-rise mt-8 max-w-md text-xl font-medium text-white/85 [animation-delay:150ms] sm:text-2xl">
          {stats
            ? `${stats.totalClosed} issues closed in ${stats.year}. Your recap is cooking.`
            : "Signed in with read-only access, but we couldn't load your stats. Try again shortly."}
        </p>
      </div>

      <form action="/api/auth/logout" method="post" className="mx-auto w-full max-w-5xl">
        <button
          type="submit"
          className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
