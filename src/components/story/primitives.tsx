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
  return <p className="text-sm font-bold uppercase tracking-[0.25em] text-white/75 sm:text-base">{children}</p>;
}

export function Huge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-black leading-[0.85] tracking-tighter text-[28vw] sm:text-[12rem] ${className}`}>{children}</p>;
}

export function Headline({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-black leading-[0.9] tracking-tighter text-[13vw] sm:text-7xl ${className}`}>{children}</h2>;
}

export function Blurb({ children }: { children: ReactNode }) {
  return <p className="max-w-md text-lg font-medium text-white/85 sm:text-2xl">{children}</p>;
}

export function Footnote({ children }: { children: ReactNode }) {
  return <p className="max-w-md text-xs font-medium text-white/65 sm:text-sm">{children}</p>;
}

export const sunny = "bg-gradient-to-r from-yellow-200 via-pink-300 to-cyan-200 bg-clip-text text-transparent";

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
    <img src={src} alt="" referrerPolicy="no-referrer" className={`${size} rounded-full border-4 border-white/80 object-cover shadow-2xl`} />
  ) : (
    <span aria-hidden className={`${size} flex items-center justify-center rounded-full border-4 border-white/80 bg-white/20 text-3xl font-black shadow-2xl`}>
      {initials}
    </span>
  );
}
