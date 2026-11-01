import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Story } from "@/components/story/Story";
import { toRecap } from "@/lib/recap";
import { getAccessToken } from "@/lib/session";
import { getWrappedStats, type WrappedStats } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

export default async function WrappedPage() {
  const token = await getAccessToken();
  if (!token) redirect("/");

  // Computed server-side; only the safe `Recap` projection crosses to the client.
  let stats: WrappedStats | null = null;
  try {
    stats = await getWrappedStats(token);
  } catch {
    stats = null;
  }

  if (stats) return <Story recap={toRecap(stats)} />;

  return (
    <main className="flex min-h-dvh flex-col items-start justify-center gap-6 px-6 sm:px-10">
      <p className="max-w-md text-xl font-medium text-white/85 sm:text-2xl">
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
