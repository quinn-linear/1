import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { SignInButton } from "@/components/SignInButton";
import { START_PATH } from "@/lib/auth";

const YEAR = 2026;

// Only the root page is canonical "/"; other routes must not inherit it. The image comes from `opengraph-image.tsx`.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Linear Wrapped",
    title: `Linear Wrapped ${YEAR}`,
    description: "Your year in Linear, wrapped. Sign in with read-only access to see what you closed, your work archetype, your peak month and more.",
  },
};

const teasers = [
  { label: "Issues closed", value: "???", a: "#ff8a5b", b: "#ff4d8d" },
  { label: "Work archetype", value: "You'll see", a: "#a78bfa", b: "#f0abfc" },
  { label: "Peak month", value: "Spoilers", a: "#34d399", b: "#22d3ee" },
  { label: "Longest streak", value: "Days?!", a: "#fbbf24", b: "#fb7185" },
];

const errors: Record<string, string> = {
  config: "Sign-in isn't configured yet.",
  state: "That sign-in attempt expired or looked off. Try again.",
  denied: "Sign-in was cancelled.",
  token: "Linear didn't complete the sign-in. Try again.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? errors[error] : undefined;

  return (
    <main className="relative isolate min-h-dvh overflow-hidden" style={{ "--a1": "#8b8bff", "--a2": "#c084fc" } as CSSProperties}>
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="animate-drift absolute -left-1/4 -top-1/3 h-[70vmax] w-[70vmax] rounded-full bg-indigo-500/25 blur-[140px]" />
        <div className="animate-drift absolute -bottom-1/3 -right-1/4 h-[60vmax] w-[60vmax] rounded-full bg-fuchsia-500/15 blur-[140px] [animation-delay:-7s]" />
        <div className="grid-fade absolute inset-0" />
        <div className="grain absolute inset-0" />
      </div>

      <section className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-between px-6 pb-10 pt-8 sm:px-10">
        <header className="animate-rise flex items-center justify-between font-mono text-xs uppercase tracking-[0.28em] text-white/60">
          <span>Linear Wrapped</span>
          <span className="glass rounded-full px-3 py-1">{YEAR}</span>
        </header>

        <div className="py-12">
          <h1 className="animate-rise text-[20vw] font-semibold leading-[0.86] tracking-[-0.06em] sm:text-[9.5rem]">
            <span className="block">Your</span>
            <span className="accent-text animate-sheen block bg-[linear-gradient(100deg,#67e8f9,#c4b5fd,#f0abfc,#fde68a,#86efac,#67e8f9)]">{YEAR}</span>
            <span className="block">in Linear.</span>
          </h1>
          <p className="animate-rise mt-8 max-w-md text-lg leading-relaxed text-white/60 [animation-delay:150ms] sm:text-xl">
            Every issue you crushed, every streak you kept alive. Wrapped up in a holographic card you can flex.
          </p>
          <div className="animate-rise mt-10 [animation-delay:300ms]">
            <SignInButton href={START_PATH} />
            {errorMessage && (
              <p role="alert" className="mt-4 text-sm font-medium text-amber-200">
                {errorMessage}
              </p>
            )}
          </div>
        </div>

        <div className="animate-rise [animation-delay:450ms]">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-white/45">Sneak peek</p>
          <ul className="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
            {teasers.map((t, i) => (
              <li
                key={t.label}
                className={`glass relative aspect-[3/4] w-40 shrink-0 snap-start overflow-hidden rounded-3xl p-4 sm:w-auto ${i % 2 ? "sm:translate-y-4" : ""}`}
              >
                <div aria-hidden className="absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-40 blur-3xl" style={{ backgroundImage: `linear-gradient(135deg, ${t.a}, ${t.b})` }} />
                <p className="relative font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">{t.label}</p>
                <p className="relative mt-6 text-3xl font-semibold leading-none tracking-[-0.04em]" style={{ color: t.a }}>
                  {t.value}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
