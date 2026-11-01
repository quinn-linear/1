import type { CSSProperties, ReactNode, Ref } from "react";
import { PET_ART, PET_SCREEN, PET_VIEWS, type Rect } from "@/lib/retro/art";

const vars = (prefix: string, r: Rect) => ({ [`--${prefix}x`]: r.x, [`--${prefix}y`]: r.y, [`--${prefix}w`]: r.w, [`--${prefix}h`]: r.h });

/**
 * The landing hero: the supplied Commodore PET photograph with the interactive
 * terminal laid exactly over its blank CRT. Everything is positioned from
 * fractions of the original image (`lib/retro/art.ts`), so the overlay stays
 * pinned to the glass at any size. The picture is as large as its parent allows
 * in both directions (`.pet-stage` / `.pet-view` in globals.css), so it never
 * pushes the page past the viewport. On narrow screens the box crops in on the
 * monitor rather than scaling the whole desk down; the photo is never stretched.
 */
/** `idle` dark glass, `hover` the cassette is held over it, `granted` accepted. `viewRef` is the whole computer, the drop target. */
export type PetState = "idle" | "hover" | "granted";

const GLOW: Record<PetState, string> = {
  idle: "0 0 0 0 rgb(184 168 255 / 0)",
  hover: "0 0 90px 44px rgb(184 168 255 / 0.3)",
  granted: "0 0 100px 48px rgb(184 168 255 / 0.4)",
};

export function PetComputer({ state, viewRef, children }: { state: PetState; viewRef?: Ref<HTMLDivElement>; children: ReactNode }) {
  const style = { ...vars("wide-", PET_VIEWS.wide), ...vars("tight-", PET_VIEWS.tight), ...vars("s", PET_SCREEN), "--art-ar": PET_ART.width / PET_ART.height } as CSSProperties;
  return (
    <div className="pet-stage" style={style}>
      <div ref={viewRef} data-pet data-state={state} className="pet-view relative overflow-hidden border-2 border-black bg-black">
        {/* Supplied artwork (public/retro/pet.png); decorative. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PET_ART.src} alt={PET_ART.alt} width={PET_ART.width} height={PET_ART.height} fetchPriority="high" draggable={false} className="pet-img pointer-events-none absolute max-w-none select-none" />
        {/* The tube lights the room while a cassette is held over it and once it is accepted: a slow, single glow, never a flash. */}
        <div aria-hidden className={`pet-screen-zone pointer-events-none absolute transition-[opacity,box-shadow] duration-700 motion-reduce:transition-none ${state === "idle" ? "opacity-0" : "opacity-100"}`} style={{ boxShadow: GLOW[state], mixBlendMode: "screen" }} />
        <div className="crt pet-screen-zone absolute overflow-hidden rounded-[3%/5%]">
          <div aria-hidden className={`pointer-events-none absolute inset-0 z-20 bg-ph transition-opacity duration-700 motion-reduce:transition-none ${state === "idle" ? "opacity-0" : "opacity-[0.07]"}`} />
          <div className="pet-terminal relative z-10 flex h-full w-full flex-col justify-end font-term uppercase text-ph phosphor">{children}</div>
        </div>
      </div>
    </div>
  );
}
