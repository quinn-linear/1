import { LOGO_RADIUS, LOGO_VIEWBOX, logoRows, logoSchedule } from "@/lib/retro/logo";

const ROWS = logoRows();
const DELAYS = logoSchedule(false);

/**
 * The PET boot screen's Linear mark: 17 scanline bands that sweep in once, top
 * to bottom, then hold still (static under reduced motion). Shared by the
 * landing computer and the loading screen so the two can never drift apart.
 * Decorative: the caller supplies the accessible name. `clipId` keeps the clip
 * path unique if two marks are ever on one page.
 */
export function LinearLogo({ clipId = "boot-logo-clip", className = "" }: { clipId?: string; className?: string }) {
  return (
    <svg aria-hidden focusable="false" viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`} className={`boot-logo shrink-0 text-ph ${className}`}>
      <defs>
        <clipPath id={clipId}>
          <circle cx={LOGO_VIEWBOX / 2} cy={LOGO_VIEWBOX / 2} r={LOGO_RADIUS} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`} fill="currentColor" shapeRendering="crispEdges">
        {ROWS.map((row, i) => (
          <g key={i} className="boot-line" style={{ animationDelay: `${DELAYS[i]}ms` }}>
            {row.polygons.map((points, j) => (
              <polygon key={j} points={points} />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}
