import type { CardId } from "../recap.ts";
import { PALETTE } from "../retro/palette.ts";

/**
 * Per-card accent pair (primary, secondary), shared by the story UI (CSS
 * variables) and the share images (inline styles) so both stay one palette:
 * a lavender or amber accent, never anything outside `PALETTE`.
 */
const G = PALETTE.lavender;
const A = PALETTE.amber;

export const CARD_ACCENTS: Record<CardId, [string, string]> = {
  intro: [G, A],
  total: [A, G],
  archetype: [G, A],
  peak: [G, A],
  streak: [A, G],
  comeback: [A, G],
  project: [G, A],
  constellation: [G, A],
  scope: [A, G],
  collaborator: [G, A],
  integrations: [G, A],
  "got-away": [A, G],
  label: [G, A],
  signature: [A, G],
  "photo-finish": [G, A],
  summary: [G, A],
};

export const SURFACE = PALETTE.screen;

export const IMAGE_FORMATS = {
  story: { width: 1080, height: 1920 },
  og: { width: 1200, height: 630 },
} as const;

export type ImageFormat = keyof typeof IMAGE_FORMATS;

/**
 * Bump whenever the share image design changes. It is part of every image URL
 * (`r=`): image responses are cached immutably per URL, and a token alone never
 * changes when only the artwork does (snapshots are identical before and after a
 * redesign), so without it old PNGs keep being served.
 */
export const IMAGE_VERSION = "ht1";

/**
 * Versions that were ever minted into links. They stay valid (links people
 * already shared keep working) but are answered with the current design.
 */
export const LEGACY_IMAGE_VERSIONS: readonly string[] = ["pet3", "pet2", "pet1", "holo2"];

/** `r` absent (links from before versioning), current, or a known legacy version. */
export const isAcceptedVersion = (version: string | null) => version === null || version === IMAGE_VERSION || LEGACY_IMAGE_VERSIONS.includes(version);

/** Immutable only when the URL pins the current design; anything else must revalidate so a redesign can't stay stuck in caches. */
export const imageCacheControl = (version: string | null) =>
  version === IMAGE_VERSION ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate";

/** Query string for an image URL: format plus the current design version. */
export const imageQuery = (format: ImageFormat) => `f=${format}&r=${IMAGE_VERSION}`;

export function parseFormat(raw: string | null): ImageFormat | null {
  if (raw === null) return "story";
  return raw === "story" || raw === "og" ? raw : null;
}
