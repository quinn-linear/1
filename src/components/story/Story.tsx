"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CARD_IDS, type CardId, type Recap } from "@/lib/recap";
import { keyToAction, resolveGesture, step, type StoryAction } from "@/lib/storyNav";
import { CARD_ACCENTS } from "@/lib/share/theme";
import { SoundToggle, useSound } from "@/components/retro/Sound";
import { CARD_TITLES, CardBody } from "./cards";
import { stack } from "./primitives";
import { ShareDialog } from "./ShareDialog";

// `data-no-nav` marks areas with their own gestures (the disk card), so they never turn story pages.
const INTERACTIVE = "button, a, form, input, select, textarea, summary, [data-no-nav]";

const accentVars = (id: CardId) => ({ "--a1": CARD_ACCENTS[id][0], "--a2": CARD_ACCENTS[id][1] }) as CSSProperties;

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
};

const two = (n: number) => String(n).padStart(2, "0");

/**
 * The recap as a program running on the computer: a cream case with a tube in
 * it, the story on the screen, and the controls as real keys on the case below.
 * Card navigation (tap zones, swipe, arrows/space, keys, progress segments) is
 * unchanged.
 */
export function Story({ recap }: { recap: Recap }) {
  const count = CARD_IDS.length;
  const [pos, setPos] = useState({ index: 0, direction: 1 });
  const { index, direction } = pos;
  const [sharing, setSharing] = useState(false);
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sharing) return; // the share dialog owns the keyboard
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const action = keyToAction(e.key);
      if (!action) return;
      // Space on a focused control should activate it, not advance the story.
      if (e.key === " " && (e.target as HTMLElement | null)?.closest(INTERACTIVE)) return;
      e.preventDefault();
      go(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, sharing]);

  const id = CARD_IDS[index];

  return (
    <MotionConfig reducedMotion="user">
      <div role="group" aria-roledescription="carousel" aria-label="Your Linear Wrapped story" className="desk fixed inset-0 select-none p-1.5 sm:p-4" style={accentVars(id)}>
        <div className="case flex h-full flex-col gap-2 rounded-[14px] p-2 sm:gap-3 sm:p-4">
          <div aria-hidden className="flex items-center justify-between px-1 text-sm uppercase tracking-[0.2em] text-ink/70 sm:text-lg">
            <span>LW-2026 Personal</span>
            <span className="flex items-center gap-2">
              Pwr <span className="h-2.5 w-2.5 bg-[var(--led)] shadow-[0_0_8px_var(--led)]" />
            </span>
          </div>

          <div
            className="crt relative min-h-0 flex-1 touch-pan-y overflow-hidden rounded-[2.5%/3.5%] border-4 border-[#0d0c08] text-ph phosphor"
            onPointerDown={(e) => {
              pointer.current = (e.target as HTMLElement).closest(INTERACTIVE) ? null : { x: e.clientX, y: e.clientY };
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
            <div aria-hidden className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 border-b-2 border-ph/40 bg-black/60 px-3 py-1 text-sm uppercase tracking-[0.12em] sm:px-5 sm:text-lg">
              <span className="shrink-0">Linear Wrapped {recap.year}</span>
              <span className="min-w-0 truncate text-[var(--a1)]">{CARD_TITLES[id]}</span>
              <span className="shrink-0 tabular-nums">
                {two(index + 1)}/{count}
              </span>
            </div>

            <nav aria-label="Story progress" className="absolute inset-x-0 top-9 z-20 px-3 sm:top-11 sm:px-5">
              <ol className="mx-auto flex max-w-2xl gap-[3px]">
                {CARD_IDS.map((cardId, i) => (
                  <li key={cardId} className="flex-1">
                    <button
                      type="button"
                      onClick={() => jump(i)}
                      aria-label={`Go to card ${i + 1} of ${count}: ${CARD_TITLES[cardId]}`}
                      aria-current={i === index ? "step" : undefined}
                      className="group block w-full py-2.5 focus-visible:outline-none"
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

            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.section
                key={id}
                custom={direction}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.16, ease: "linear" }}
                aria-label={CARD_TITLES[id]}
                style={accentVars(id)}
                className="absolute inset-0 z-10 flex items-center overflow-y-auto px-5 pb-6 pt-[4.5rem] sm:px-10 sm:pt-24"
              >
                <motion.div variants={stack} initial="hidden" animate="show" className="mx-auto my-auto flex w-full max-w-2xl flex-col items-start gap-3 sm:gap-6">
                  <CardBody id={id} recap={recap} />
                </motion.div>
              </motion.section>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between gap-2 px-0.5 pb-[env(safe-area-inset-bottom)]">
            <button type="button" aria-label="Previous card" disabled={index === 0} onClick={() => go("prev")} className="keycap">
              <span aria-hidden>◄ Prev</span>
            </button>
            <button type="button" onClick={() => setSharing(true)} aria-haspopup="dialog" className="keycap">
              Share <span className="sr-only">this card: {CARD_TITLES[id]}</span>
            </button>
            <button type="button" aria-label="Next card" disabled={index === count - 1} onClick={() => go("next")} className="keycap">
              <span aria-hidden>Next ►</span>
            </button>
            <SoundToggle />
          </div>
        </div>

        {sharing && <ShareDialog key={id} card={id} title={CARD_TITLES[id]} onClose={() => setSharing(false)} />}
      </div>
    </MotionConfig>
  );
}
