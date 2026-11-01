"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ACCESS_GRANTED, CONNECTING, grantHold, grantReducer } from "@/lib/retro/cassette";
import { TAP_SLOP_PX, centeredOffset, clampOffset, containsPoint, type Box } from "@/lib/retro/drag";
import { CASSETTE_REST, PET_ART, PET_FOCUS, PET_SCREEN } from "@/lib/retro/art";
import { coverPlacement, restingBox } from "@/lib/retro/cover";
import { BOOT_LABEL, LOGO_RADIUS, LOGO_VIEWBOX, logoRows, logoSchedule } from "@/lib/retro/logo";
import { Cassette } from "./Cassette";
import { PetComputer, type PetState } from "./PetComputer";
import { useSound } from "./Sound";

/** Above everything on the page, whatever stacking context or clipping box it would otherwise live in. */
const TOP_LAYER = 2147483647;

const toBox = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });

const LOGO_ROWS = logoRows();

/**
 * The landing screen: the PET photograph fills the whole viewport, its screen
 * shows only the Linear mark and a blinking cursor, and a cassette tape lies on
 * the notepad at the lower right. Drag the cassette onto the
 * computer (the screen glows while it is over it) and let go: the screen says
 * ACCESS GRANTED and, a moment later, this tab goes to Linear's real read-only
 * authorization page (`startPath`). The cassette is also a single focusable
 * control: Enter, Space or a tap does the same without dragging. There is no
 * popup and no embedded Linear: OAuth is a full-page redirect.
 *
 * The cassette is drawn in a portal on `document.body` at the highest z-index, so
 * it is above the computer and every clipping or stacking context while it is
 * dragged. Its resting spot is the notepad's place on the picture, mapped through
 * the same cover crop as the screen overlay (`lib/retro/cover.ts`) and kept whole
 * inside the viewport; the drop target (the computer) is measured at the moment of
 * every move and release, so hit testing follows the crop. A drop elsewhere springs it back. The
 * grant can only happen once, so a second drop, tap or key press never starts a
 * second redirect.
 */
export function PetLanding({ year, startPath }: { year: number; startPath: string }) {
  const reduce = !!useReducedMotion();
  const { play } = useSound();
  const [phase, dispatch] = useReducer(grantReducer, "idle");
  const [bootSkipped, setBootSkipped] = useState(false);
  const timers = useRef<number[]>([]);
  const launched = useRef(false);

  const petRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<{ width: number; height: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const press = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const tilt = useMotionValue(-4);
  const opacity = useMotionValue(1);

  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  // The picture covers the viewport; follow its size (and the mobile browser bars) to place the overlay and the tape.
  useLayoutEffect(() => {
    const read = () => setView({ width: window.innerWidth, height: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  const placement = useMemo(() => (view ? coverPlacement(view, PET_ART, PET_FOCUS, PET_SCREEN) : null), [view]);
  const rest = useMemo<Box | null>(() => (view && placement ? restingBox(placement, CASSETTE_REST, view) : null), [view, placement]);

  // The mark's scanline sweep is skipped by any key press or touch. (Reduced motion skips it in CSS.)
  useEffect(() => {
    if (bootSkipped) return;
    const skip = () => setBootSkipped(true);
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [bootSkipped]);

  const move = useCallback(
    (to: { x: number; y: number }, spring = false) => {
      const opts = reduce ? { duration: 0.01 } : spring ? { type: "spring" as const, stiffness: 300, damping: 24 } : { duration: 0.6, ease: [0.3, 0.7, 0.3, 1] as [number, number, number, number] };
      void animate(x, to.x, opts);
      void animate(y, to.y, opts);
    },
    [reduce, x, y],
  );

  const home = useCallback(() => {
    move({ x: 0, y: 0 }, true);
    void animate(tilt, -4, { duration: reduce ? 0.01 : 0.3 });
  }, [move, reduce, tilt]);

  // Accepted: the cassette goes into the computer, the screen says so, then the real OAuth redirect (once).
  const grant = useCallback(() => {
    if (launched.current) return;
    launched.current = true;
    setBootSkipped(true);
    play("ready");
    const pet = petRef.current?.getBoundingClientRect();
    if (pet && rest) {
      move(centeredOffset(rest, toBox(pet)));
      void animate(tilt, 0, { duration: reduce ? 0.01 : 0.3 });
      void animate(opacity, 0, { duration: reduce ? 0.01 : 0.35, delay: reduce ? 0 : 0.45 });
    }
    timers.current.push(
      window.setTimeout(() => {
        dispatch({ type: "launch" });
        window.location.assign(startPath);
      }, grantHold(reduce)),
    );
  }, [move, opacity, play, reduce, rest, startPath, tilt]);

  // Coming back to this page from the browser's back button (bfcache) must not leave it stuck mid sign-in.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      clearTimers();
      launched.current = false;
      dispatch({ type: "reset" });
      x.set(0);
      y.set(0);
      tilt.set(-4);
      opacity.set(1);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [clearTimers, opacity, tilt, x, y]);

  const overPet = (e: ReactPointerEvent) => {
    const r = petRef.current?.getBoundingClientRect();
    return !!r && containsPoint(toBox(r), e.clientX, e.clientY);
  };

  // Dragging: plain pointer events with capture, so the cassette follows the finger or cursor anywhere on screen.
  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (launched.current || !e.isPrimary || e.button > 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  };
  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || !rest) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < TAP_SLOP_PX) return;
    if (!p.moved) {
      p.moved = true;
      setDragging(true);
      dispatch({ type: "grab" });
    }
    const o = clampOffset(rest, dx, dy, { width: window.innerWidth, height: window.innerHeight });
    x.set(o.x);
    y.set(o.y);
    dispatch({ type: overPet(e) ? "enter" : "leave" });
  };
  const onUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    if (e.currentTarget.hasPointerCapture(p.id)) e.currentTarget.releasePointerCapture(p.id);
    if (!p.moved) return; // a tap: the click that follows does the grant
    setDragging(false);
    // The browser fires a click after a drag that ends on the same element; it must not count as a tap.
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 0);
    const over = overPet(e);
    dispatch({ type: "release", over });
    if (over) grant();
    else home();
  };
  const onCancel = () => {
    const p = press.current;
    press.current = null;
    if (!p || !p.moved) return;
    setDragging(false);
    dispatch({ type: "cancel" });
    home();
  };
  const onClick = () => {
    if (suppressClick.current || launched.current) return;
    dispatch({ type: "activate" });
    grant();
  };

  const petState: PetState = phase === "over" ? "hover" : phase === "granted" || phase === "launching" ? "granted" : "idle";
  const accepted = petState === "granted";

  // Spoken only: the page shows no instructions.
  const status =
    phase === "over"
      ? "Release the cassette to sign in."
      : accepted
        ? `${ACCESS_GRANTED}. ${CONNECTING}`
        : "Drag the cassette onto the computer, or press Enter or Space on it, to sign in with Linear.";

  const bandDelays = logoSchedule(false);

  return (
    <div className="contents">
      <PetComputer state={petState} viewRef={petRef} placement={placement}>
        {accepted ? (
          // One slow glow, then steady: never a strobe.
          <div aria-hidden className="flex h-full flex-col items-center justify-center whitespace-nowrap text-center">
            <p className="access-granted text-[1.15em] leading-none">{ACCESS_GRANTED}</p>
            <p className="mt-[0.6em] text-[0.62em] leading-none opacity-80">{CONNECTING}</p>
          </div>
        ) : (
          // The idle screen: only the mark, centred, and the cursor at the bottom right. The art is decorative; the group carries the name once.
          <div role="group" aria-label={BOOT_LABEL} className={`boot pet-idle ${bootSkipped ? "boot-skip" : ""}`} onClick={() => setBootSkipped(true)}>
            <svg aria-hidden focusable="false" viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`} className="boot-logo shrink-0 text-ph">
              <defs>
                <clipPath id="boot-logo-clip">
                  <circle cx={LOGO_VIEWBOX / 2} cy={LOGO_VIEWBOX / 2} r={LOGO_RADIUS} />
                </clipPath>
              </defs>
              <g clipPath="url(#boot-logo-clip)" fill="currentColor" shapeRendering="crispEdges">
                {LOGO_ROWS.map((row, i) => (
                  <g key={i} className="boot-line" style={{ animationDelay: `${bandDelays[i]}ms` }}>
                    {row.polygons.map((points, j) => (
                      <polygon key={j} points={points} />
                    ))}
                  </g>
                ))}
              </g>
            </svg>
            <span aria-hidden className="cursor-block" />
          </div>
        )}
      </PetComputer>
      <p className="sr-only" role="status">
        {status}
      </p>

      {rest &&
        createPortal(
          <motion.button
            type="button"
            data-cassette
            data-state={dragging ? "dragging" : accepted ? "accepted" : "resting"}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
            onClick={onClick}
            disabled={accepted}
            aria-label={`Linear Wrapped ${year} cassette tape. Drag it onto the computer, or press Enter or Space, to sign in with Linear. Read-only access.`}
            whileHover={reduce || accepted || dragging ? undefined : { scale: 1.04 }}
            className="cassette-btn block cursor-grab touch-none select-none active:cursor-grabbing disabled:cursor-default"
            style={{ position: "fixed", left: rest.left, top: rest.top, width: rest.width, height: rest.height, zIndex: TOP_LAYER, x, y, rotate: tilt, opacity, padding: 0, background: "none", border: 0 }}
          >
            <span className={`cassette-float block h-full w-full ${dragging || accepted ? "cassette-still" : ""}`}>
              <Cassette className="pointer-events-none block h-auto w-full drop-shadow-[0_8px_0_rgb(0_0_0/0.45)]" />
            </span>
          </motion.button>,
          document.body,
        )}
    </div>
  );
}
