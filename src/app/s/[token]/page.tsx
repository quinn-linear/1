import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { describe } from "@/lib/share/copy";
import { decodeToken } from "@/lib/share/snapshot";
import { shareSecret } from "@/lib/share/server";
import { IMAGE_FORMATS } from "@/lib/share/theme";

// Public and cookie-free: this page never reads the session, so it can't leak or mix up anyone's account.
// Preview meta tags (og:image etc.) are step 7; for now just keep shared links out of search indexes.
export const metadata: Metadata = { robots: { index: false } };

export default async function SharedCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const secret = shareSecret();
  const snapshot = secret ? decodeToken(token, secret) : null;
  if (!snapshot) notFound();

  const copy = describe(snapshot);
  const { width, height } = IMAGE_FORMATS.story;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-8">
      <h1 className="sr-only">{copy.kicker}: {copy.headline}</h1>
      {/* Same-origin generated image; next/image would only add a pointless optimizer hop. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/s/${token}/image?f=story`}
        width={width}
        height={height}
        alt={copy.alt}
        className="h-auto max-h-[78dvh] w-auto max-w-full rounded-3xl shadow-2xl ring-1 ring-white/20"
      />
      <p className="max-w-sm text-center text-sm font-medium text-white/70">One card, shared by link. Nothing else from this recap is public.</p>
      <Link href="/" className="rounded-full bg-white px-6 py-3 text-sm font-extrabold text-indigo-950 transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        Get your own Linear Wrapped
      </Link>
    </main>
  );
}
