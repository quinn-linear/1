import type { ArchetypeId } from "../stats/types.ts";

/**
 * The supplied engraving for each archetype, as local, pre-optimized files in
 * `public/archetypes`: a 1000px WebP for the web UI and a 900px JPEG for the
 * share images (Satori embeds it as a data URI read from disk, so nothing is
 * ever fetched from a URL). The art is public by design: it depends only on
 * the archetype id, which every share of that card already shows.
 * One entry per archetype; the mapping is by the artwork itself.
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
  "early-bird": entry("early-bird", "Engraving of the Early Bird: a hawk-headed adventurer with a sun halo, a cloak and a walking staff, standing on a rock."),
  "friday-shipper": entry("friday-shipper", "Engraving of the Friday Shipper: a grinning pilot in goggles and a flight suit, blasting off on two rocket packs."),
  "weekend-warrior": entry("weekend-warrior", "Engraving of the Weekend Warrior: a battle-worn knight in black armor marked with lightning bolts."),
  "steady-builder": entry("steady-builder", "Engraving of the Steady Builder: a crystalline stone golem with a castle on its shoulders, holding a glowing crystal."),
  "night-owl": entry("night-owl", "Engraving of the Night Owl: an owl-headed knight in a feathered cloak and moon-crest armor, before a full moon."),
};

/** Native size of the shipped images, for stable layout while they load. */
export const ART_SIZE = { web: 1000, share: 900 } as const;
