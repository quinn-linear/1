import { SignInButton } from "@/components/SignInButton";

const YEAR = 2026;

const teasers = [
  { label: "Issues closed", value: "???", color: "from-fuchsia-500 to-pink-500" },
  { label: "Work archetype", value: "You'll see", color: "from-violet-500 to-indigo-500" },
  { label: "Peak month", value: "Spoilers", color: "from-amber-400 to-orange-500" },
  { label: "Longest streak", value: "Days?!", color: "from-emerald-400 to-cyan-500" },
];

export default function Home() {
  return (
    <main className="relative isolate min-h-dvh overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="animate-drift absolute -left-1/4 -top-1/4 h-[70vmax] w-[70vmax] rounded-full bg-fuchsia-600/60 blur-[120px]" />
        <div className="animate-drift absolute -bottom-1/4 -right-1/4 h-[70vmax] w-[70vmax] rounded-full bg-indigo-600/60 blur-[120px] [animation-delay:-7s]" />
        <div className="absolute left-1/3 top-1/2 h-[40vmax] w-[40vmax] rounded-full bg-orange-500/30 blur-[120px]" />
      </div>

      <section className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-between px-6 pb-10 pt-8 sm:px-10">
        <header className="animate-rise flex items-center justify-between text-sm font-semibold uppercase tracking-widest text-white/80">
          <span>Linear Wrapped</span>
          <span className="rounded-full border border-white/30 px-3 py-1">{YEAR}</span>
        </header>

        <div className="py-12">
          <h1 className="animate-rise text-[22vw] font-black leading-[0.85] tracking-tighter sm:text-[10rem]">
            <span className="block">Your</span>
            <span className="block bg-gradient-to-r from-yellow-200 via-pink-300 to-cyan-200 bg-clip-text text-transparent">
              {YEAR}
            </span>
            <span className="block">in Linear.</span>
          </h1>
          <p className="animate-rise mt-8 max-w-md text-xl font-medium text-white/85 [animation-delay:150ms] sm:text-2xl">
            Every issue you crushed, every streak you kept alive. Wrapped up and
            ready to flex.
          </p>
          <div className="animate-rise mt-10 [animation-delay:300ms]">
            <SignInButton />
          </div>
        </div>

        <div className="animate-rise [animation-delay:450ms]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/60">
            Sneak peek
          </p>
          <ul className="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
            {teasers.map((t, i) => (
              <li
                key={t.label}
                className={`aspect-[3/4] w-40 shrink-0 snap-start rounded-3xl bg-gradient-to-br ${t.color} p-4 shadow-xl sm:w-auto ${
                  i % 2 ? "sm:translate-y-4 sm:-rotate-2" : "sm:rotate-2"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-wider text-black/70">
                  {t.label}
                </p>
                <p className="mt-6 text-4xl font-black leading-none tracking-tight text-black">
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
