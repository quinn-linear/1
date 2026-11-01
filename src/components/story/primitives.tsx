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
    <p className="flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-white/60 sm:text-xs">
      <span aria-hidden className="relative flex h-1.5 w-1.5">
        <span className="animate-pulse-ring absolute inset-0 rounded-full bg-[var(--a1)]" />
        <span className="relative h-1.5 w-1.5 rounded-full bg-[var(--a1)] shadow-[0_0_10px_var(--a1)]" />
      </span>
      {children}
    </p>
  );
}

export function Huge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-semibold leading-[0.82] tracking-[-0.06em] tabular-nums text-[28vw] sm:text-[12rem] ${className}`}>{children}</p>;
}

export function Headline({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-semibold leading-[0.92] tracking-[-0.045em] text-[12vw] sm:text-7xl ${className}`}>{children}</h2>;
}

export function Blurb({ children }: { children: ReactNode }) {
  return <p className="max-w-md text-base leading-relaxed text-white/65 sm:text-xl">{children}</p>;
}

export function Footnote({ children }: { children: ReactNode }) {
  return <p className="max-w-md border-l border-white/15 pl-3 text-xs leading-relaxed text-white/45 sm:text-sm">{children}</p>;
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

export function Avatar({ name, src, size = "h-28 w-28" }: { name: string; src: string | null; size?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  return src ? (
    // Linear-hosted avatar URL; next/image would need a remote-host allowlist we can't verify.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" referrerPolicy="no-referrer" className={`${size} rounded-full object-cover ring-2 ring-white/20 ring-offset-4 ring-offset-[#07080b] shadow-[0_0_50px_-8px_var(--a1)]`} />
  ) : (
    <span aria-hidden className={`${size} flex items-center justify-center rounded-full glass text-3xl font-semibold ring-2 ring-white/20 ring-offset-4 ring-offset-[#07080b] shadow-[0_0_50px_-8px_var(--a1)]`}>
      {initials}
    </span>
  );
}
