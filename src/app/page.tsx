import type { Metadata } from "next";
import { PetLanding } from "@/components/retro/PetLanding";
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
    description: "Your year in Linear, wrapped. Insert the floppy, sign in with read-only access and see what you closed, your work archetype, your peak month and more.",
  },
};

const DIRECTORY = [
  { name: "ISSUES CLOSED", value: "???" },
  { name: "WORK ARCHETYPE", value: "YOU'LL SEE" },
  { name: "PEAK MONTH", value: "SPOILERS" },
  { name: "LONGEST STREAK", value: "DAYS?!" },
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
    <main className="desk relative min-h-dvh overflow-x-hidden">
      <section className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-4 pb-12 pt-6 sm:px-8">
        <header className="flex items-start justify-between gap-4 text-amber">
          <div>
            <h1 className="text-3xl leading-none tracking-wide sm:text-5xl">LINEAR WRAPPED {YEAR}</h1>
            <p className="mt-2 max-w-lg text-lg leading-snug text-ph/80 sm:text-xl">
              Your year in Linear, loaded from a single floppy disk. Every issue you closed, every streak you kept alive.
            </p>
          </div>
        </header>

        {errorMessage && (
          <p role="alert" className="panel max-w-xl px-4 py-3 text-lg text-amber">
            ?ERROR: {errorMessage.toUpperCase()}
          </p>
        )}

        <PetLanding year={YEAR} startPath={START_PATH} />

        <div className="flex flex-wrap items-start justify-between gap-8 border-t-2 border-dashed border-ph/30 pt-6">
          <SignInButton href={START_PATH} />
          <section aria-labelledby="directory" className="panel w-full max-w-xl p-4 text-lg sm:text-xl">
            <h2 id="directory" className="text-amber">
              LOAD &quot;$&quot;,8 <span className="sr-only">: disk directory, a sneak peek</span>
            </h2>
            <ul className="mt-2">
              {DIRECTORY.map((d) => (
                <li key={d.name} className="flex items-baseline gap-2">
                  <span className="shrink-0 text-ph/70">PRG</span>
                  <span>&quot;{d.name}&quot;</span>
                  <span aria-hidden className="min-w-4 flex-1 overflow-hidden whitespace-nowrap text-ph/30">
                    ..............................
                  </span>
                  <span className="text-amber">{d.value}</span>
                </li>
              ))}
              <li className="text-ph/70">12 MORE FILES ON THIS DISK.</li>
            </ul>
          </section>
        </div>

        <noscript>
          <p className="panel p-4 text-lg">
            The floppy disk needs JavaScript. <a href={START_PATH} className="text-amber underline">Sign in with Linear</a> to go straight to your recap.
          </p>
        </noscript>
      </section>
    </main>
  );
}
