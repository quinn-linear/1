import { ARCHETYPE_ART, ART_SIZE } from "@/lib/share/archetypeArt";
import type { ArchetypeId } from "@/lib/stats/types";

/**
 * The archetype's halftone badge, shown whole (never cropped) as a square. Its space
 * comes from `aspect-square`, so the layout is fixed before the image arrives and a
 * slow load never shifts or hides anything. The badge has its own dotted ring and a
 * transparent corner, so it sits straight on the dark screen with a faint glow.
 */
export function ArchetypeArt({ id, className = "", priority = false }: { id: ArchetypeId; className?: string; priority?: boolean }) {
  const art = ARCHETYPE_ART[id];
  return (
    <div className={`aspect-square ${className}`}>
      {/* Pre-optimized local asset with explicit dimensions; next/image would only re-encode it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art.web} alt={art.alt} width={ART_SIZE.web} height={ART_SIZE.web} decoding="async" fetchPriority={priority ? "high" : "auto"} draggable={false} className="block h-full w-full object-contain drop-shadow-[0_0_22px_rgb(233_229_255/0.22)]" />
    </div>
  );
}
