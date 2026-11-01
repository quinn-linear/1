import { CASSETTE_ART } from "@/lib/retro/art";

/**
 * The supplied halftone cassette, shown whole at its own aspect ratio (the file is
 * transparent around the tape, so it sits on whatever is behind it). Decorative:
 * the control that carries it has the accessible name.
 */
export function Cassette({ className = "" }: { className?: string }) {
  // Pre-optimized local asset with explicit dimensions; next/image would only re-encode it.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={CASSETTE_ART.src} alt="" width={CASSETTE_ART.width} height={CASSETTE_ART.height} draggable={false} decoding="async" fetchPriority="high" className={className} />;
}
