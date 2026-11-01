"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Children, useEffect, type ReactNode } from "react";

/**
 * A card's content is a stack of blocks that load in one after another, top to
 * bottom, like a screen filling in on an old terminal (`.reveal-*` in
 * globals.css). It is pure CSS: reduced motion shows everything at once, the
 * `.reveal-skip` class (set when the viewer taps or presses Enter) does the
 * same, and a new card mounts a fresh stack, so leaving a card ends its reveal.
 */
export function RevealStack({ children, skipped, className = "" }: { children: ReactNode; skipped: boolean; className?: string }) {
  return <div className={`reveal-stack ${skipped ? "reveal-skip" : ""} ${className}`}>{children}</div>;
}

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`reveal-block ${className}`}>{children}</div>;
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="flex max-w-full items-center gap-2 text-base font-medium uppercase tracking-[0.18em] text-ph/80 sm:text-xl">
      <span aria-hidden className="accent-text">
        &gt;
      </span>
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
      <span aria-hidden className="cursor-block !h-[0.7em] !w-[0.4em] shrink-0" />
    </p>
  );
}

export function Huge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-semibold leading-[0.82] tabular-nums text-[min(30vw,22dvh)] sm:text-[min(14rem,25dvh)] ${className}`}>{children}</p>;
}

/** The plain text of a headline's children, to size it by length. */
const textOf = (children: ReactNode) =>
  Children.toArray(children)
    .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : ""))
    .join("");

/**
 * Headlines carry user text (project names, issue titles), so long ones step down
 * in size rather than running to many lines; the `!` beats a card's own size class.
 */
export function Headline({ children, className = "" }: { children: ReactNode; className?: string }) {
  const len = textOf(children).length;
  const long = len > 60 ? "!text-[min(5vw,3.6dvh)] sm:!text-[min(1.9rem,4.4dvh)]" : len > 30 ? "!text-[min(8vw,5.5dvh)] sm:!text-[min(2.6rem,6dvh)]" : "";
  return <h2 className={`font-semibold leading-[0.92] text-[min(12vw,9dvh)] sm:text-7xl ${className} ${long}`}>{children}</h2>;
}

export function Blurb({ children }: { children: ReactNode }) {
  return <p className="max-w-md text-base leading-relaxed text-ph/70 sm:text-xl">{children}</p>;
}

export function Footnote({ children }: { children: ReactNode }) {
  return <p className="max-w-md border-l border-ph/40 pl-3 text-xs leading-relaxed text-ph/70 sm:text-sm">{children}</p>;
}

export const sunny = "accent-text";

/** Animates 0 -> `to`. Screen readers get the final value; reduced motion skips the count. */
export function CountUp({ to, className }: { to: number; className?: string }) {
  const reduce = useReducedMotion();
  const value = useMotionValue(reduce ? to : 0);
  const text = useTransform(value, (v) => Math.round(v).toLocaleString("en-US"));

  useEffect(() => {
    if (reduce) {
      value.set(to);
      return;
    }
    const controls = animate(value, to, { duration: 1.6, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [to, reduce, value]);

  return (
    <span className={className}>
      <span className="sr-only">{to.toLocaleString("en-US")}</span>
      <motion.span aria-hidden>{text}</motion.span>
    </span>
  );
}

/** Square, one-color portrait: the photo is flattened to phosphor so it reads as a monochrome tube image. */
export function Avatar({ name, src, size = "h-28 w-28" }: { name: string; src: string | null; size?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  return src ? (
    <span aria-hidden className={`${size} relative block shrink-0 overflow-hidden border-2 border-ph bg-ph`}>
      {/* Linear-hosted avatar URL; next/image would need a remote-host allowlist we can't verify. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover mix-blend-multiply contrast-125 grayscale" />
      <span className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0_2px,rgb(0_0_0/0.35)_2px_3px)]" />
    </span>
  ) : (
    <span aria-hidden className={`${size} panel flex shrink-0 items-center justify-center !border-ph text-5xl`}>
      {initials}
    </span>
  );
}
