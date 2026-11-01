import type { CardId } from "../recap.ts";

/** Hex versions of the story card gradients (`CARD_BACKGROUNDS`), since the image renderer can't use Tailwind classes. */
export const CARD_GRADIENTS: Record<CardId, [string, string, string]> = {
  intro: ["#a21caf", "#3730a3", "#020617"],
  total: ["#f97316", "#e11d48", "#581c87"],
  archetype: ["#7c3aed", "#a21caf", "#020617"],
  peak: ["#10b981", "#0f766e", "#020617"],
  streak: ["#fbbf24", "#ea580c", "#7f1d1d"],
  project: ["#0ea5e9", "#4338ca", "#020617"],
  collaborator: ["#ec4899", "#be123c", "#1e1b4b"],
  integrations: ["#06b6d4", "#1e40af", "#020617"],
  "got-away": ["#475569", "#27272a", "#000000"],
  label: ["#a3e635", "#047857", "#020617"],
  summary: ["#c026d3", "#6b21a8", "#1e1b4b"],
};

export const IMAGE_FORMATS = {
  story: { width: 1080, height: 1920 },
  og: { width: 1200, height: 630 },
} as const;

export type ImageFormat = keyof typeof IMAGE_FORMATS;

export function parseFormat(raw: string | null): ImageFormat | null {
  if (raw === null) return "story";
  return raw === "story" || raw === "og" ? raw : null;
}
