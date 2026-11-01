"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { CARD_IDS, type Recap } from "@/lib/recap";
import { keyToAction, resolveGesture, step, type StoryAction } from "@/lib/storyNav";
import { CARD_BACKGROUNDS, CARD_TITLES, CardBody } from "./cards";
import { stack } from "./primitives";
import { ShareDialog } from "./ShareDialog";

const INTERACTIVE = "button, a, form, input, select, textarea";

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 60 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -60 }),
};

export function Story({ recap }: { recap: Recap }) {
  const count = CARD_IDS.length;
  const [pos, setPos] = useState({ index: 0, direction: 1 });
  const { index, direction } = pos;
  const [sharing, setSharing] = useState(false);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback(
    (action: StoryAction) =>
      setPos((p) => {
        const next = step(p.index, action, count);
        return next === p.index ? p : { index: next, direction: action === "next" ? 1 : -1 };
      }),
    [count],
  );

  const jump = (to: number) => setPos((p) => (to === p.index ? p : { index: to, direction: to > p.index ? 1 : -1 }));

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
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label="Your Linear Wrapped story"
        className="fixed inset-0 touch-pan-y select-none overflow-hidden"
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
        <AnimatePresence initial={false}>
          <motion.div
            key={`bg-${id}`}
            aria-hidden
            className={`absolute inset-0 bg-gradient-to-br ${CARD_BACKGROUNDS[id]}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        </AnimatePresence>

        <nav aria-label="Story progress" className="absolute inset-x-0 top-0 z-20 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <ol className="mx-auto flex max-w-2xl gap-1">
            {CARD_IDS.map((cardId, i) => (
              <li key={cardId} className="flex-1">
                <button
                  type="button"
                  onClick={() => jump(i)}
                  aria-label={`Go to card ${i + 1} of ${count}: ${CARD_TITLES[cardId]}`}
                  aria-current={i === index ? "step" : undefined}
                  className="group block w-full py-2 focus-visible:outline-none"
                >
                  <span className="block h-1 overflow-hidden rounded-full bg-white/30 group-focus-visible:ring-2 group-focus-visible:ring-white">
                    <span className={`block h-full rounded-full bg-white transition-[width] duration-300 motion-reduce:transition-none ${i <= index ? "w-full" : "w-0"}`} />
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
            transition={{ duration: 0.25 }}
            aria-label={CARD_TITLES[id]}
            className="absolute inset-0 z-10 flex items-center overflow-y-auto px-6 pb-28 pt-20 sm:px-10"
          >
            <motion.div variants={stack} initial="hidden" animate="show" className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 sm:gap-6">
              <CardBody id={id} recap={recap} />
            </motion.div>
          </motion.section>
        </AnimatePresence>

        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <ControlButton label="Previous card" disabled={index === 0} onClick={() => go("prev")} glyph="←" />
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setSharing(true)}
              aria-haspopup="dialog"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-indigo-950 shadow-lg transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Share <span className="sr-only">this card: {CARD_TITLES[id]}</span>
            </button>
            <p aria-hidden className="text-xs font-bold uppercase tracking-widest text-white/70">
              {index + 1} / {count}
            </p>
          </div>
          <ControlButton label="Next card" disabled={index === count - 1} onClick={() => go("next")} glyph="→" />
        </div>

        {sharing && <ShareDialog key={id} card={id} title={CARD_TITLES[id]} onClose={() => setSharing(false)} />}
      </div>
    </MotionConfig>
  );
}

function ControlButton({ label, glyph, disabled, onClick }: { label: string; glyph: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-xl font-black text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-30"
    >
      <span aria-hidden>{glyph}</span>
    </button>
  );
}
