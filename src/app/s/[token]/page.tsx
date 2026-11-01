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
    <main className="desk flex min-h-dvh flex-col items-center justify-center gap-5 px-3 py-6">
      <h1 className="sr-only">{copy.kicker}: {copy.headline}</h1>
      {/* Same-origin generated image; next/image would only add a pointless optimizer hop. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/s/${token}/image?${imageQuery("story")}`}
        width={width}
        height={height}
        alt={copy.alt}
        className="h-auto max-h-[74dvh] w-auto max-w-full border-2 border-black shadow-[8px_10px_0_rgb(0_0_0/0.55)]"
      />
      <p className="max-w-sm text-center text-lg text-ph/80">One card, shared by link. Nothing else from this recap is public.</p>
      <Link href="/" className="term-btn">
        Get your own Linear Wrapped
      </Link>
    </main>
  );
}
