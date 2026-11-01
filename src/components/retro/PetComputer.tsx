import type { CSSProperties, ReactNode } from "react";
import { PET_ART, PET_SCREEN, PET_VIEWS, type Rect } from "@/lib/retro/art";

const vars = (prefix: string, r: Rect) => ({ [`--${prefix}x`]: r.x, [`--${prefix}y`]: r.y, [`--${prefix}w`]: r.w, [`--${prefix}h`]: r.h });

/**
 * The landing hero: the supplied Commodore PET photograph with the interactive
 * terminal laid exactly over its blank CRT. Everything is positioned from
 * fractions of the original image (`lib/retro/art.ts`), so the overlay stays
 * pinned to the glass at any width. On phones (see `.pet-view` in globals.css)
 * the box crops in on the monitor rather than scaling the whole desk down; the
 * photo is never stretched.
 */
export function PetComputer({ on, children }: { on: boolean; children: ReactNode }) {
  const style = { ...vars("wide-", PET_VIEWS.wide), ...vars("tight-", PET_VIEWS.tight), ...vars("s", PET_SCREEN), "--art-ar": PET_ART.width / PET_ART.height } as CSSProperties;
  return (
    <div className="pet-view relative mx-auto w-full overflow-hidden border-2 border-black bg-black" style={style}>
      {/* Supplied artwork (public/retro/pet.png); decorative. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PET_ART.src} alt={PET_ART.alt} width={PET_ART.width} height={PET_ART.height} fetchPriority="high" draggable={false} className="pet-img pointer-events-none absolute max-w-none select-none" />
      {/* The tube lights the room when a program is running. */}
      <div aria-hidden className={`pet-screen-zone pointer-events-none absolute transition-opacity duration-700 motion-reduce:transition-none ${on ? "opacity-100" : "opacity-0"}`} style={{ boxShadow: "0 0 90px 40px rgb(93 255 143 / 0.14)", mixBlendMode: "screen" }} />
      <div className="crt pet-screen-zone absolute overflow-hidden rounded-[3%/5%]">
        <div className="pet-terminal relative z-10 flex h-full w-full flex-col justify-end font-term uppercase text-ph phosphor">{children}</div>
      </div>
    </div>
  );
}
