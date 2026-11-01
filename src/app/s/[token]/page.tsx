import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { describe } from "@/lib/share/copy";
import { decodeToken } from "@/lib/share/snapshot";
import { shareMetadata } from "@/lib/share/meta";
import { shareSecret } from "@/lib/share/server";
import { IMAGE_FORMATS, imageQuery } from "@/lib/share/theme";
import { resolveSiteOrigin } from "@/lib/site";

// Public and cookie-free: this page never reads the session, so it can't leak or mix up anyone's account.
// Preview tags (og:/twitter: with the wide image) are built only after the token verifies; links stay noindex.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return shareMetadata(token, shareSecret(), resolveSiteOrigin());
}

export default async function SharedCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const secret = shareSecret();
  const snapshot = secret ? decodeToken(token, secret) : null;
  if (!snapshot) notFound();

  const copy = describe(snapshot);
  const { width, height } = IMAGE_FORMATS.story;

  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden px-4 py-8">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="animate-drift absolute -left-1/4 -top-1/3 h-[70vmax] w-[70vmax] rounded-full bg-indigo-500/20 blur-[140px]" />
        <div className="grain absolute inset-0" />
      </div>
      <h1 className="sr-only">{copy.kicker}: {copy.headline}</h1>
      {/* Same-origin generated image; next/image would only add a pointless optimizer hop. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/s/${token}/image?${imageQuery("story")}`}
        width={width}
        height={height}
        alt={copy.alt}
        className="h-auto max-h-[78dvh] w-auto max-w-full rounded-3xl shadow-[0_30px_90px_-30px_rgba(139,92,246,0.6)] ring-1 ring-white/15"
      />
      <p className="max-w-sm text-center text-sm text-white/55">One card, shared by link. Nothing else from this recap is public.</p>
      <Link href="/" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        Get your own Linear Wrapped
      </Link>
    </main>
  );
}
