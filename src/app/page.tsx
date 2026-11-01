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
    description: "Your year in Linear, wrapped. Drag the cassette onto the computer, sign in with read-only access and see what you closed, your work archetype, your peak month and more.",
  },
};

const errors: Record<string, string> = {
  config: "Sign-in isn't configured yet.",
  state: "That sign-in attempt expired or looked off. Try again.",
  denied: "Sign-in was cancelled.",
  token: "Linear didn't complete the sign-in. Try again.",
};

/**
 * The landing is one screen: the picture fills the viewport and the cassette lies on
 * its notepad, so nothing scrolls. The only other things on the page are out of sight
 * until needed: a plain sign-in link for keyboards (and no-JavaScript visitors), and
 * a sign-in error, if there is one.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? errors[error] : undefined;

  return (
    <main className="scene">
      <h1 className="sr-only">Linear Wrapped {YEAR}</h1>
      <SignInButton href={START_PATH} />

      {errorMessage && (
        <p role="alert" className="landing-error">
          ?ERROR: {errorMessage.toUpperCase()}
        </p>
      )}

      <PetLanding year={YEAR} startPath={START_PATH} />

      <noscript>
        <p className="landing-error" style={{ left: "0.75rem", right: "auto", top: "auto", bottom: "0.75rem" }}>
          The cassette needs JavaScript. <a href={START_PATH} className="text-amber underline">Sign in with Linear</a> to go straight to your recap.
        </p>
      </noscript>
    </main>
  );
}
