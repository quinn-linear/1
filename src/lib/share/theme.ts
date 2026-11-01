import type { CardId } from "../recap.ts";

/**
 * Per-card accent pair, shared by the story UI (CSS variables) and the share
 * images (inline styles) so both stay one palette. Surfaces are near-black;
 * the accent is the only color that changes from card to card.
 */
export const CARD_ACCENTS: Record<CardId, [string, string]> = {
  intro: ["#8b8bff", "#c084fc"],
  total: ["#ff8a5b", "#ff4d8d"],
  archetype: ["#a78bfa", "#f0abfc"],
  peak: ["#34d399", "#22d3ee"],
  streak: ["#fbbf24", "#fb7185"],
  comeback: ["#f97316", "#facc15"],
  project: ["#38bdf8", "#818cf8"],
  constellation: ["#818cf8", "#e879f9"],
  scope: ["#2dd4bf", "#a78bfa"],
  collaborator: ["#f472b6", "#fb923c"],
  integrations: ["#22d3ee", "#60a5fa"],
  "got-away": ["#94a3b8", "#e2e8f0"],
  label: ["#a3e635", "#2dd4bf"],
  signature: ["#fb7185", "#fbbf24"],
  "photo-finish": ["#e2e8f0", "#38bdf8"],
  summary: ["#c4b5fd", "#67e8f9"],
};

export const SURFACE = "#07080b";

export const IMAGE_FORMATS = {
  story: { width: 1080, height: 1920 },
  og: { width: 1200, height: 630 },
} as const;

export type ImageFormat = keyof typeof IMAGE_FORMATS;

/**
 * Bump whenever the share image design changes. It is part of every image URL
 * (`r=`): image responses are cached immutably per URL, and a token alone never
 * changes when only the artwork does (summary snapshots are identical before and
 * after the holographic redesign), so without it old PNGs keep being served.
 */
export const IMAGE_VERSION = "holo2";

/** Query string for an image URL: format plus the current design version. */
export const imageQuery = (format: ImageFormat) => `f=${format}&r=${IMAGE_VERSION}`;

export function parseFormat(raw: string | null): ImageFormat | null {
  if (raw === null) return "story";
  return raw === "story" || raw === "og" ? raw : null;
}
