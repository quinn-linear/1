import { ARCHETYPE_ART, ART_SIZE } from "@/lib/share/archetypeArt";
import type { ArchetypeId } from "@/lib/stats/types";

/**
 * The archetype's engraving, shown whole (never cropped) in a square frame. The
 * frame is parchment-coloured and takes its space from `aspect-square`, so the
 * layout is fixed before the image arrives and a slow load never shifts or hides
 * anything. A thin phosphor edge and soft glow tie it to the screen around it;
 * the art itself is left untouched (no filter, no scanlines over it).
 */
export function ArchetypeArt({ id, className = "", priority = false }: { id: ArchetypeId; className?: string; priority?: boolean }) {
  const art = ARCHETYPE_ART[id];
  return (
    <div className={`aspect-square overflow-hidden border-2 border-ph/70 bg-[#e8e0c4] shadow-[0_0_24px_rgb(184_168_255/0.28)] ${className}`}>
      {/* Pre-optimized local asset with explicit dimensions; next/image would only re-encode it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art.web} alt={art.alt} width={ART_SIZE.web} height={ART_SIZE.web} decoding="async" fetchPriority={priority ? "high" : "auto"} draggable={false} className="block h-full w-full object-contain" />
    </div>
  );
}
