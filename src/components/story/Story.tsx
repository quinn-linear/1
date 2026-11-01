"use client";

import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CARD_IDS, type CardId, type Recap } from "@/lib/recap";
import { keyToAction, resolveGesture, step, type StoryAction } from "@/lib/storyNav";
import { CARD_ACCENTS } from "@/lib/share/theme";
import { SoundToggle, useSound } from "@/components/retro/Sound";
import { CARD_TITLES, CardBody } from "./cards";
import { Fit } from "./Fit";
import { RevealStack } from "./primitives";
import { ShareDialog } from "./ShareDialog";

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
export function Story({ recap, initialIndex = 0 }: { recap: Recap; initialIndex?: number }) {
  const count = CARD_IDS.length;
  const [pos, setPos] = useState({ index: initialIndex, direction: 1 });
  const { index } = pos;
  const [sharing, setSharing] = useState(false);
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
      if (sharing) return; // the share dialog owns the keyboard
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
  }, [go, id, sharing]);

  return (
    <MotionConfig reducedMotion="user">
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="Your Linear Wrapped story"
        className="crt story-crt fixed inset-0 flex select-none flex-col text-ph phosphor"
        style={accentVars(id)}
      >
        <div aria-hidden className="relative z-20 flex shrink-0 items-center justify-between gap-3 border-b-2 border-ph/30 bg-black/40 px-3 py-1 text-sm uppercase tracking-[0.12em] sm:px-5 sm:text-lg">
          <span className="shrink-0">Linear Wrapped {recap.year}</span>
          <span className="min-w-0 truncate text-[var(--a1)]">{CARD_TITLES[id]}</span>
          <span className="shrink-0 tabular-nums">
            {two(index + 1)}/{count}
          </span>
        </div>

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
                  <span className="block h-2 border border-ph/50 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-amber">
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

        <div className="relative z-20 flex shrink-0 items-center justify-between gap-2 border-t-2 border-ph/30 bg-black/40 px-3 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] sm:px-5">
          <button type="button" aria-label="Previous card" disabled={index === 0} onClick={() => go("prev")} className="term-btn">
            <span aria-hidden>◄ Prev</span>
          </button>
          <button type="button" onClick={() => setSharing(true)} aria-haspopup="dialog" className="term-btn">
            Share <span className="sr-only">this card: {CARD_TITLES[id]}</span>
          </button>
          <button type="button" aria-label="Next card" disabled={index === count - 1} onClick={() => go("next")} className="term-btn">
            <span aria-hidden>Next ►</span>
          </button>
          <SoundToggle variant="screen" />
        </div>

        {sharing && <ShareDialog key={id} card={id} title={CARD_TITLES[id]} onClose={() => setSharing(false)} />}
      </div>
    </MotionConfig>
  );
}
