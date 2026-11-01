import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Story } from "@/components/story/Story";
import { EmptyRecap } from "@/components/wrapped/EmptyRecap";
import { WrappedLoading } from "@/components/wrapped/Loading";
import { toRecap } from "@/lib/recap";
import { getAccessToken } from "@/lib/session";
import { recapDensity } from "@/lib/sparse";
import { DEFAULT_YEAR, getWrappedStats, type WrappedStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

// Static and generic on purpose: nothing about the signed-in viewer ever goes in metadata.
export const metadata: Metadata = {
  title: { absolute: "Your Linear Wrapped" },
  robots: { index: false, follow: false },
  openGraph: { title: "Linear Wrapped", description: "Your year in Linear, wrapped." },
  twitter: { title: "Linear Wrapped", description: "Your year in Linear, wrapped." },
};

export default async function WrappedPage({ searchParams }: { searchParams: Promise<{ cards?: string }> }) {
  // Cheap cookie check first, so signed-out visitors redirect before any streaming starts.
  const token = await getAccessToken();
  if (!token) redirect("/");
  const { cards } = await searchParams;

  // The slow Linear crawl happens inside the boundary, so the loading screen is sent right away and replaced when stats arrive.
  return (
    <Suspense fallback={<WrappedLoading year={DEFAULT_YEAR} />}>
      <WrappedContent token={token} showCards={cards === "1"} />
    </Suspense>
  );
}

async function WrappedContent({ token, showCards }: { token: string; showCards: boolean }) {
  // Computed server-side; only the safe `Recap` projection crosses to the client.
  let stats: WrappedStats | null = null;
  try {
    stats = await getWrappedStats(token);
  } catch {
    stats = null;
  }

  if (stats) {
    const recap = toRecap(stats);
    if (recapDensity(recap) === "empty" && !showCards) return <EmptyRecap recap={recap} />;
    return <Story recap={recap} />;
  }

  return (
    <main className="flex min-h-dvh flex-col items-start justify-center gap-6 px-6 sm:px-10">
      <p className="max-w-md text-xl leading-relaxed text-white/65 sm:text-2xl">
        Signed in with read-only access, but we couldn&apos;t load your stats. Try again shortly.
      </p>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10">
          Sign out
        </button>
      </form>
    </main>
  );
}
