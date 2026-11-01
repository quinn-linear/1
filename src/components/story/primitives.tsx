"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform, type Variants } from "framer-motion";
import { useEffect, type ReactNode } from "react";

/** Staggered entrance for a card's content; children use `Reveal`. */
export const stack: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 140, damping: 18 } },
};

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={rise} className={className}>
      {children}
    </motion.div>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-base font-medium uppercase tracking-[0.18em] text-ph/80 sm:text-xl">
      <span aria-hidden className="accent-text">
        &gt;
      </span>
      {children}
      <span aria-hidden className="cursor-block !h-[0.7em] !w-[0.4em]" />
    </p>
  );
}

export function Huge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-semibold leading-[0.82] tabular-nums text-[30vw] sm:text-[14rem] ${className}`}>{children}</p>;
}

export function Headline({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-semibold leading-[0.92] text-[12vw] sm:text-7xl ${className}`}>{children}</h2>;
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
