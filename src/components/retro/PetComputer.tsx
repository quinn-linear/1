import { DustMotes } from "./DustMotes";
import type { CSSProperties, ReactNode, Ref } from "react";
import { PET_ART, PET_BEAM, PET_DROP, PET_SCREEN, type Rect } from "@/lib/retro/art";
import type { Placement } from "@/lib/retro/cover";

const vars = (prefix: string, r: Rect) => ({ [`--${prefix}x`]: r.x, [`--${prefix}y`]: r.y, [`--${prefix}w`]: r.w, [`--${prefix}h`]: r.h });
const pct = (r: Rect) => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });

/**
 * The landing scene: the supplied Commodore PET photograph fills the whole viewport
 * edge to edge ("cover": scaled uniformly, cropped on one axis, never stretched), with
 * the interactive terminal laid exactly over its blank CRT. The picture's box is placed
 * by `lib/retro/cover.ts` (`placement`; before it is measured, a centred cover in
 * globals.css) and everything on it, the terminal, the dust and the drop target, is a
 * fraction of that box, so the overlay stays pinned to the glass at any size or crop.
 */
/** `idle` dark glass, `hover` the cassette is held over it, `granted` accepted. `viewRef` is the whole computer, the drop target. */
export type PetState = "idle" | "hover" | "granted";

const GLOW: Record<PetState, string> = {
  idle: "0 0 0 0 rgb(184 168 255 / 0)",
  hover: "0 0 90px 44px rgb(184 168 255 / 0.3)",
  granted: "0 0 100px 48px rgb(184 168 255 / 0.4)",
};

export function PetComputer({ state, viewRef, placement, children }: { state: PetState; viewRef?: Ref<HTMLDivElement>; placement: Placement | null; children: ReactNode }) {
  const style = { ...vars("s", PET_SCREEN), ...vars("b", PET_BEAM), "--art-ar": PET_ART.width / PET_ART.height, ...(placement && { left: placement.left, top: placement.top, width: placement.width, height: placement.height }) } as CSSProperties;
  return (
    <div className="pet-view absolute" style={style} data-gap-x={placement?.gapX ? "" : undefined} data-gap-y={placement?.gapY ? "" : undefined}>
      {/* Supplied artwork (public/retro/pet.webp); decorative. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PET_ART.src} alt={PET_ART.alt} width={PET_ART.width} height={PET_ART.height} fetchPriority="high" draggable={false} className="pet-img pointer-events-none absolute max-w-none select-none" />
      {/* The drop target: the computer (not the notepad the tape lies on). */}
      <div ref={viewRef} aria-hidden data-pet data-state={state} className="pointer-events-none absolute" style={pct(PET_DROP)} />
      {/* A few dust motes in the lamp's beam, behind the screen and the cassette. */}
      <DustMotes />
      {/* The tube lights the room while a cassette is held over it and once it is accepted: a slow, single glow, never a flash. */}
      <div aria-hidden className={`pet-screen-zone pointer-events-none absolute transition-[opacity,box-shadow] duration-700 motion-reduce:transition-none ${state === "idle" ? "opacity-0" : "opacity-100"}`} style={{ boxShadow: GLOW[state], mixBlendMode: "screen" }} />
      <div className="crt pet-screen-zone absolute overflow-hidden rounded-[13%/17%]">
        <div aria-hidden className={`pointer-events-none absolute inset-0 z-20 bg-ph transition-opacity duration-700 motion-reduce:transition-none ${state === "idle" ? "opacity-0" : "opacity-[0.07]"}`} />
        <div className="pet-terminal relative z-10 flex h-full w-full flex-col justify-end font-term uppercase text-ph phosphor">{children}</div>
      </div>
    </div>
  );
}
