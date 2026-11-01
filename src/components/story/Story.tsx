"use client";

import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CARD_IDS, type CardId, type Recap } from "@/lib/recap";
import { keyToAction, resolveGesture, step, type StoryAction } from "@/lib/storyNav";
import { CARD_ACCENTS } from "@/lib/share/theme";
import { ChevronLeft, ChevronRight, CloseX, EnterFullscreen, ExitFullscreen, ShareIcon } from "@/components/icons";
import { SoundToggle, useSound } from "@/components/retro/Sound";
import { FS_BLOCKED_NOTICE } from "@/lib/fullscreen";
import { CARD_TITLES, CardBody } from "./cards";
import { Fit } from "./Fit";
import { RevealStack } from "./primitives";
import { EnterRecap } from "./EnterRecap";
import { ShareDialog } from "./ShareDialog";
import { useFullscreen } from "./useFullscreen";

// `data-no-nav` marks areas with their own gestures (the disk card), so they never turn story pages.
const INTERACTIVE = "button, a, form, input, select, textarea, summary, [data-no-nav]";

const accentVars = (id: CardId) => ({ "--a1": CARD_ACCENTS[id][0], "--a2": CARD_ACCENTS[id][1] }) as CSSProperties;

const two = (n: number) => String(n).padStart(2, "0");

/**
 * The recap as a program on a full-screen CRT: no case or bezel, the tube is the
 * whole viewport. A thin status line on top, the card in the middle (laid out
 * by `Fit` so all of it is always visible), and the controls as on-screen
 * buttons below. Each card loads block by block like an old screen; tapping or
 * pressing Enter shows it at once, and moving to another card ends the reveal.
 * Card navigation (tap zones, swipe, arrows/space, progress segments) is unchanged.
 */
export function Story({ recap, initialIndex = 0, gate = false }: { recap: Recap; initialIndex?: number; gate?: boolean }) {
  const count = CARD_IDS.length;
  const [pos, setPos] = useState({ index: initialIndex, direction: 1 });
  const { index } = pos;
  const [sharing, setSharing] = useState(false);
  // The "Enter recap" screen (after sign-in): a real click there is what lets the browser allow full screen.
  const [entering, setEntering] = useState(gate);
  const fs = useFullscreen();
  // Which card the viewer has skipped the loading reveal on. Keyed by card so a new card always starts fresh.
  const [skippedId, setSkippedId] = useState<CardId | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const { play } = useSound();

  const go = useCallback(
    (action: StoryAction) => {
      const next = step(index, action, count);
      if (next === index) return;
      setPos({ index: next, direction: action === "next" ? 1 : -1 });
      play("advance");
    },
    [count, index, play],
  );

  const jump = (to: number) => {
    if (to === index) return;
    setPos({ index: to, direction: to > index ? 1 : -1 });
    play("advance");
  };

  const id = CARD_IDS[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sharing || entering) return; // the share dialog and the enter screen own the keyboard
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter" && !(e.target as HTMLElement | null)?.closest(INTERACTIVE)) {
        setSkippedId(id);
        return;
      }
      const action = keyToAction(e.key);
      if (!action) return;
      // Space on a focused control should activate it, not advance the story.
      if (e.key === " " && (e.target as HTMLElement | null)?.closest(INTERACTIVE)) return;
      e.preventDefault();
      go(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, id, sharing, entering]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="Your Linear Wrapped story"
        className="crt story-crt fixed inset-0 flex select-none flex-col text-ph phosphor"
        style={accentVars(id)}
      >
        <div aria-hidden className={`relative z-20 flex shrink-0 items-center justify-between gap-3 border-b-2 border-ph/30 bg-black/40 px-3 py-1 text-sm uppercase tracking-[0.12em] sm:px-5 sm:text-lg ${fs.active ? "pr-14 sm:pr-16" : ""}`}>
          <span className="shrink-0">Linear Wrapped {recap.year}</span>
          <span className="min-w-0 truncate text-[var(--a1)]">{CARD_TITLES[id]}</span>
        </div>
        {fs.active && (
          // A visible way out (Esc also works): always in the corner while the browser is in full screen.
          <button type="button" onClick={() => void fs.exit()} aria-label="Exit full screen" data-tip="Exit full screen" data-tip-below className="dock-btn dock-btn-close absolute right-2 top-2 z-30">
            <CloseX />
          </button>
        )}

        <nav aria-label="Story progress" className="relative z-20 shrink-0 px-3 sm:px-5">
          <ol className="mx-auto flex max-w-2xl gap-[3px]">
            {CARD_IDS.map((cardId, i) => (
              <li key={cardId} className="flex-1">
                <button
                  type="button"
                  onClick={() => jump(i)}
                  aria-label={`Go to card ${i + 1} of ${count}: ${CARD_TITLES[cardId]}`}
                  aria-current={i === index ? "step" : undefined}
                  className="group block w-full py-2 focus-visible:outline-none"
                >
                  <span className="block h-2 border border-ph/50 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-lav">
                    <span className={`block h-full bg-[var(--a1)] ${i === index ? "" : "opacity-60"} ${i <= index ? "w-full" : "w-0"}`} />
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <p className="sr-only" aria-live="polite" aria-atomic>
          Card {index + 1} of {count}: {CARD_TITLES[id]}
        </p>

        <div
          className="relative z-10 min-h-0 flex-1 touch-pan-y"
          onPointerDown={(e) => {
            const onControl = (e.target as HTMLElement).closest(INTERACTIVE);
            pointer.current = onControl ? null : { x: e.clientX, y: e.clientY };
            // Any touch on the card shows it fully loaded; a tap that also turns the page simply replaces it.
            setSkippedId(id);
          }}
          onPointerUp={(e) => {
            const start = pointer.current;
            pointer.current = null;
            if (!start) return;
            const action = resolveGesture({ startX: start.x, startY: start.y, endX: e.clientX, endY: e.clientY, width: e.currentTarget.clientWidth });
            if (action) go(action);
          }}
          onPointerCancel={() => (pointer.current = null)}
        >
          {/* Keyed by card: moving on unmounts this one, which ends its reveal on the spot. */}
          <section key={id} aria-label={CARD_TITLES[id]} style={accentVars(id)} className="absolute inset-0">
            <Fit>
              <RevealStack skipped={skippedId === id} className="mx-auto flex w-full flex-col items-start gap-[min(1.5rem,2.2dvh)]">
                <CardBody id={id} recap={recap} />
              </RevealStack>
            </Fit>
          </section>
        </div>

        {fs.blocked && (
          <p role="status" className="dock-note">
            {FS_BLOCKED_NOTICE}
          </p>
        )}

        <div className="relative z-20 flex shrink-0 justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
          <div role="toolbar" aria-label="Story controls" className="dock-pill">
            <button type="button" aria-label="Previous card" data-tip="Previous" disabled={index === 0} onClick={() => go("prev")} className="dock-btn">
              <ChevronLeft />
            </button>
            <span aria-hidden className="dock-count">
              {two(index + 1)}/{count}
            </span>
            <button type="button" aria-label="Next card" data-tip="Next" disabled={index === count - 1} onClick={() => go("next")} className="dock-btn">
              <ChevronRight />
            </button>
            <span aria-hidden className="dock-sep" />
            <button type="button" onClick={() => setSharing(true)} aria-haspopup="dialog" aria-label={`Share this card: ${CARD_TITLES[id]}`} data-tip="Share" className="dock-btn">
              <ShareIcon />
            </button>
            <SoundToggle variant="dock" />
            {fs.supported && (
              <button
                type="button"
                onClick={() => void fs.toggle()}
                aria-pressed={fs.active}
                aria-label="Full screen"
                data-tip={fs.active ? "Exit full screen" : "Full screen"}
                className="dock-btn"
              >
                {fs.active ? <ExitFullscreen /> : <EnterFullscreen />}
              </button>
            )}
          </div>
        </div>

        {entering && (
          <EnterRecap
            year={recap.year}
            canFullscreen={fs.supported}
            onEnter={(wantFullscreen) => {
              // Called from the click itself, so the browser still counts it as a user gesture.
              if (wantFullscreen) void fs.enter();
              setEntering(false);
            }}
          />
        )}

        {sharing && <ShareDialog key={id} card={id} title={CARD_TITLES[id]} onClose={() => setSharing(false)} />}
      </div>
    </MotionConfig>
  );
}
