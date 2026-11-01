import { notFound } from "next/navigation";
import { Story } from "@/components/story/Story";
import { CARD_IDS } from "@/lib/recap";
import { ARCHETYPE_COPY } from "@/lib/stats/archetype";
import type { ArchetypeId } from "@/lib/stats/types";
import { FIXTURE_NAMES, fixtureRecap, type FixtureName } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

/**
 * Layout-check route: renders the story from a built-in fixture (`full`,
 * `sparse`, `zero`, `long`), starting at `?card=<id>` (`?gate=1` shows the Enter recap screen, `?archetype=<id>` swaps the archetype). It exists only when the
 * server is started with `PREVIEW_FIXTURES=1`; otherwise it is a plain 404, so
 * production never exposes it. No account, token or Linear data is involved.
 */
export default async function PreviewPage({ params, searchParams }: { params: Promise<{ fixture: string }>; searchParams: Promise<{ card?: string; gate?: string; archetype?: string }> }) {
  if (process.env.PREVIEW_FIXTURES !== "1") notFound();
  const { fixture } = await params;
  if (!FIXTURE_NAMES.includes(fixture as FixtureName)) notFound();
  const { card, gate, archetype } = await searchParams;
  // `?archetype=<id>` previews the other archetypes' art and copy on the same fixture data.
  const recap = fixtureRecap(fixture as FixtureName);
  if (archetype && archetype in ARCHETYPE_COPY) {
    const copy = ARCHETYPE_COPY[archetype as ArchetypeId];
    recap.archetype = { ...recap.archetype, id: archetype as ArchetypeId, name: copy.name, tagline: copy.tagline, description: copy.description };
  }
  const start = Math.max(0, CARD_IDS.findIndex((id) => id === card));
  return <Story recap={recap} initialIndex={start} gate={gate === "1"} />;
}
