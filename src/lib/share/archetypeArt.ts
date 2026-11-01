import type { ArchetypeId } from "../stats/types.ts";

/**
 * The supplied halftone badge for each archetype, as local, pre-optimized files in
 * `public/archetypes`: a 720px WebP with a transparent background for the web UI
 * and a 640px JPEG, flattened on the printout's paper colour, for the share images (Satori embeds it as a data URI read from disk, so nothing is
 * ever fetched from a URL). The art is public by design: it depends only on
 * the archetype id, which every share of that card already shows.
 * One entry per archetype; the mapping is by the artwork itself. The Steady Builder
 * badge was not supplied on its own: it is the stairs badge cut cleanly out of the
 * supplied report image (the circle only, none of that report's text).
 */
export interface ArchetypeArt {
  /** URL path of the web image. */
  web: string;
  /** Path of the share image, relative to `public/`. */
  share: string;
  alt: string;
}

const entry = (id: ArchetypeId, alt: string): ArchetypeArt => ({ web: `/archetypes/${id}.webp`, share: `archetypes/share/${id}.jpg`, alt });

export const ARCHETYPE_ART: Record<ArchetypeId, ArchetypeArt> = {
  "early-bird": entry("early-bird", "Halftone badge of the Early Bird: a small bird mid-song on a branch in front of a rising sun."),
  "friday-shipper": entry("friday-shipper", "Halftone badge of the Friday Shipper: a rocket launching through clouds under a sunburst."),
  "weekend-warrior": entry("weekend-warrior", "Halftone badge of the Weekend Warrior: a plumed knight raising a sword, with a lightning-bolt shield."),
  "steady-builder": entry("steady-builder", "Halftone badge of the Steady Builder: a staircase of stone blocks in front of a rising sun."),
  "night-owl": entry("night-owl", "Halftone badge of the Night Owl: a horned owl perched on a branch before a crescent moon."),
};

/** Native size of the shipped images, for stable layout while they load. */
export const ART_SIZE = { web: 720, share: 640 } as const;
