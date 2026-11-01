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

const errors: Record<string, string> = {
  config: "Sign-in isn't configured yet.",
  state: "That sign-in attempt expired or looked off. Try again.",
  denied: "Sign-in was cancelled.",
  token: "Linear didn't complete the sign-in. Try again.",
};

/**
 * The landing is one screen: everything essential (title, computer, drive and
 * floppy, keys, the plain sign-in link) is sized from the viewport so nothing
 * needs scrolling. The page only scrolls as a last resort, when the viewport is
 * so small (extreme zoom) that the content can't shrink any further.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? errors[error] : undefined;

  return (
    <main className="desk h-dvh overflow-y-auto overflow-x-hidden">
      <section className="mx-auto flex h-full min-h-[20rem] max-w-[110rem] flex-col gap-2 px-3 py-2 sm:px-6 sm:py-3">
        <header className="landing-header flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <div className="min-w-0">
            <h1 className="text-[clamp(1.5rem,min(7vw,5dvh),3rem)] leading-none tracking-wide text-amber">LINEAR WRAPPED {YEAR}</h1>
            <p className="landing-tagline mt-1 max-w-xl text-lg leading-snug text-ph/80">Your year in Linear, loaded from a single cassette tape.</p>
          </div>
          <SignInButton href={START_PATH} />
        </header>

        {errorMessage && (
          <p role="alert" className="panel max-w-xl px-3 py-1 text-lg text-amber">
            ?ERROR: {errorMessage.toUpperCase()}
          </p>
        )}

        <PetLanding year={YEAR} startPath={START_PATH} />

        <noscript>
          <p className="panel p-3 text-lg">
            The cassette needs JavaScript. <a href={START_PATH} className="text-amber underline">Sign in with Linear</a> to go straight to your recap.
          </p>
        </noscript>
      </section>
    </main>
  );
}
