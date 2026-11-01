"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { HELP_LINES, LOAD_LINES, SYNTAX_LINES, bootReducer, parseCommand } from "@/lib/retro/boot";
import { TAP_SLOP_PX, clampOffset, isOverSlot, seatedOffset, type Box } from "@/lib/retro/drag";
import { BOOT_LABEL, BOOT_LINES, BOOT_TITLE, LOGO_LINES, bootSchedule } from "@/lib/retro/logo";
import { DriveFront, Floppy } from "./Floppy";
import { PetComputer } from "./PetComputer";
import { SoundToggle, useSound } from "./Sound";

/** Above everything on the page, whatever stacking context or clipping box it would otherwise live in. */
const TOP_LAYER = 2147483647;

const toBox = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });

/**
 * The landing screen: a PET-style computer whose screen boots with the Linear
 * mark, an external drive and a floppy disk. Insert the disk (drag it, tap it,
 * or press the button), watch it load, then press Enter, type RUN or press the
 * RETURN key to start the real read-only OAuth sign-in (`startPath`). A plain
 * "skip" link to the same sign-in is always on the page, so the flourish never
 * gates it, and the boot animation never delays the floppy: it is skipped by
 * any key or touch and by inserting the disk.
 *
 * The floppy is drawn in a portal on `document.body` at the highest z-index, so
 * while it is dragged and while it seats it is above the drive, the computer and
 * every clipping or stacking context in the page. It is positioned from the
 * measured resting spot, so it follows the layout when the viewport changes.
 */
export function PetLanding({ year, startPath }: { year: number; startPath: string }) {
  const reduce = !!useReducedMotion();
  const { play } = useSound();
  const [phase, dispatch] = useReducer(bootReducer, "empty");
  const [log, setLog] = useState<string[]>([]);
  const [noDisk, setNoDisk] = useState(false);
  const [value, setValue] = useState("");
  const [bootSkipped, setBootSkipped] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);

  const restRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const [rest, setRest] = useState<Box | null>(null);
  const [dragging, setDragging] = useState(false);
  const press = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const tilt = useMotionValue(-5);
  const seated = phase !== "empty";

  const later = useCallback(
    (ms: number, fn: () => void) => {
      timers.current.push(window.setTimeout(fn, reduce ? Math.min(ms, 40) : ms));
    },
    [reduce],
  );
  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const append = (...lines: string[]) => setLog((l) => [...l, ...lines]);

  // Measure where the disk rests, and keep it current as the layout moves.
  const measure = useCallback(() => {
    if (restRef.current) setRest(toBox(restRef.current.getBoundingClientRect()));
  }, []);
  useLayoutEffect(() => {
    measure();
    const el = restRef.current;
    const ro = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (el) ro?.observe(el);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const seatPose = useCallback((): { x: number; y: number } | null => {
    const r = restRef.current?.getBoundingClientRect();
    const s = slotRef.current?.getBoundingClientRect();
    return r && s ? seatedOffset(toBox(r), toBox(s)) : null;
  }, []);

  // If the layout changes while the disk is in the drive, keep it in the slot.
  useLayoutEffect(() => {
    if (!seated || !rest) return;
    const pose = seatPose();
    if (pose) {
      x.set(pose.x);
      y.set(pose.y);
    }
  }, [rest, seated, seatPose, x, y]);

  // The boot animation is skipped by any key press or touch. (Reduced motion skips it in CSS.)
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
      const opts = reduce ? { duration: 0.01 } : spring ? { type: "spring" as const, stiffness: 300, damping: 24 } : { duration: 0.7, ease: [0.3, 0.7, 0.3, 1] as [number, number, number, number] };
      void animate(x, to.x, opts);
      void animate(y, to.y, opts);
    },
    [reduce, x, y],
  );

  const insert = useCallback(() => {
    if (phase !== "empty") return;
    dispatch({ type: "insert" });
    setBootSkipped(true);
    setNoDisk(false);
    setLog([]);
    play("disk");
    move(seatPose() ?? { x: 0, y: -120 });
    void animate(tilt, 0, { duration: reduce ? 0.01 : 0.4 });
    later(760, () => {
      dispatch({ type: "inserted" });
      LOAD_LINES.forEach((line, i) => later(300 + i * 330, () => append(line)));
      later(300 + LOAD_LINES.length * 330 + 150, () => {
        dispatch({ type: "loaded" });
        play("ready");
        if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
      });
    });
  }, [later, move, phase, play, reduce, seatPose, tilt]);

  const eject = () => {
    clearTimers();
    dispatch({ type: "eject" });
    setLog([]);
    setValue("");
    setNoDisk(false);
    play("key");
    move({ x: 0, y: 0 });
    void animate(tilt, -5, { duration: reduce ? 0.01 : 0.4 });
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (phase !== "ready") return;
    const cmd = parseCommand(value);
    setValue("");
    if (cmd.kind === "run") {
      dispatch({ type: "run" });
      play("advance");
      append("RUN", "CONNECTING TO LINEAR...", "READ-ONLY ACCESS");
      later(900, () => window.location.assign(startPath));
    } else {
      play("error");
      append(`> ${value.trim().toUpperCase()}`, ...(cmd.kind === "help" ? HELP_LINES : SYNTAX_LINES));
    }
  };

  // Enter works from anywhere on the page once a program is loaded, unless a control has focus.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey || document.activeElement !== document.body) return;
      if (phase === "empty") {
        play("error");
        setNoDisk(true);
      } else if (phase === "ready") {
        input.current?.focus();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key.length === 1 || e.key === "Backspace") play("key");
  };

  // Dragging: plain pointer events with capture, so the disk follows the finger or cursor anywhere on screen.
  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (phase !== "empty" || !e.isPrimary || e.button > 0) return;
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
    }
    const o = clampOffset(rest, dx, dy, { width: window.innerWidth, height: window.innerHeight });
    x.set(o.x);
    y.set(o.y);
  };
  const onUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    if (e.currentTarget.hasPointerCapture(p.id)) e.currentTarget.releasePointerCapture(p.id);
    setDragging(false);
    const s = slotRef.current?.getBoundingClientRect();
    if (!p.moved) insert();
    else if (rest && s && isOverSlot({ left: rest.left + x.get(), top: rest.top + y.get(), width: rest.width, height: rest.height }, toBox(s))) insert();
    else move({ x: 0, y: 0 }, true);
  };
  const onCancel = () => {
    if (!press.current) return;
    press.current = null;
    setDragging(false);
    move({ x: 0, y: 0 }, true);
  };

  const status =
    phase === "empty"
      ? "No disk in the drive. Insert the floppy disk to begin."
      : phase === "inserting"
        ? "Inserting the floppy disk."
        : phase === "loading"
          ? "Loading from disk."
          : phase === "ready"
            ? "Program loaded. Press Enter, type RUN, or press the Return key to sign in with Linear."
            : "Connecting to Linear.";

  const rows = LOGO_LINES.length;
  const delays = bootSchedule(rows, false);
  const lineDelay = (i: number): CSSProperties => ({ animationDelay: `${delays[Math.min(i, rows - 1)]}ms` });
  const lastBoot = noDisk ? "?NO DISK  ERROR" : BOOT_LINES[BOOT_LINES.length - 1];

  return (
    <div className="landing-body">
      <PetComputer on={seated}>
        {phase === "empty" ? (
          // The boot screen: the mark beside the title. The art is decorative; the group carries the name once.
          <div role="group" aria-label={BOOT_LABEL} className={`boot flex items-center gap-[0.7em] whitespace-nowrap ${bootSkipped ? "boot-skip" : ""}`} onClick={() => setBootSkipped(true)}>
            <pre aria-hidden className="boot-logo m-0 shrink-0 text-lav">
              {LOGO_LINES.map((line, i) => (
                <span key={i} className="boot-line block" style={lineDelay(i)}>
                  {line}
                </span>
              ))}
            </pre>
            <div className="min-w-0">
              <p className="boot-line normal-case" style={lineDelay(1)}>
                {BOOT_TITLE}
              </p>
              {BOOT_LINES.slice(0, -1).map((line, i) => (
                <p key={i} className="boot-line whitespace-pre" style={lineDelay(i + 2)}>
                  {line === "" ? " " : line}
                </p>
              ))}
              <p className="boot-line whitespace-pre" style={lineDelay(rows)}>
                {lastBoot}
              </p>
              <p aria-hidden>
                <span className="cursor-block" />
              </p>
            </div>
          </div>
        ) : (
          // The terminal: a log (read out politely) with a live prompt once a program is loaded.
          <div role="log" aria-label="Terminal" className="flex flex-col justify-end overflow-hidden text-[0.8em]" onClick={() => input.current?.focus()}>
            {log.map((line, i) => (
              <p key={i} className="whitespace-pre-wrap break-words">
                {line === "" ? " " : line}
              </p>
            ))}
            {phase === "ready" ? (
              <form onSubmit={submit} className="flex items-center">
                <span aria-hidden>&gt;&nbsp;</span>
                <input
                  ref={input}
                  value={value}
                  onChange={(e) => setValue(e.target.value.slice(0, 24))}
                  onKeyDown={onInputKey}
                  aria-label="Terminal command. Press Enter, or type RUN, to sign in with Linear."
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  className="term-input min-w-0 flex-1 border-0 bg-transparent p-0 uppercase text-inherit outline-none [font:inherit] [letter-spacing:inherit]"
                />
              </form>
            ) : (
              <p aria-hidden>
                <span className="cursor-block" />
              </p>
            )}
          </div>
        )}
      </PetComputer>
      <p className="sr-only" role="status">
        {status}
      </p>

      <div className="dock">
        <div className="dock-stage">
          <div className="dock-art" data-phase={phase}>
            <DriveFront busy={phase === "inserting" || phase === "loading"} className="pointer-events-none absolute left-0 top-0 h-auto w-full" />
            {/* Where the disk's leading edge goes, and where it rests: measured, never hard-coded in px. */}
            <div ref={slotRef} aria-hidden className="pointer-events-none absolute left-[7%] top-[27.9%] h-[9.3%] w-[86%]" />
            <div ref={restRef} aria-hidden className="pointer-events-none absolute left-[32%] top-[51.2%] aspect-square w-[36%]" />
          </div>
        </div>

        <div className="dock-keys">
          <button type="button" className="keycap" onClick={insert} disabled={seated}>
            Insert floppy
          </button>
          <button type="button" className="keycap" onClick={() => submit()} disabled={phase !== "ready"} aria-label="Return: run the program and sign in with Linear">
            Return ⏎ Run
          </button>
          <button type="button" className="keycap" onClick={eject} disabled={!seated || phase === "launching"}>
            Eject
          </button>
          <SoundToggle />
        </div>
        <p className="landing-hint text-lg leading-snug text-ph/80">
          {phase === "empty" ? (
            <>
              <span className="text-amber">STEP 1.</span> Drag the floppy up into the drive, or tap it.
            </>
          ) : (
            <>
              <span className="text-amber">STEP 2.</span> {phase === "ready" ? "Press ENTER (or RETURN) to run it." : "Loading from the disk."}
            </>
          )}
        </p>
      </div>

      {rest &&
        createPortal(
          <motion.button
            type="button"
            data-floppy
            data-state={dragging ? "dragging" : seated ? "seated" : "resting"}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
            onClick={(e) => e.detail === 0 && insert()}
            disabled={seated}
            aria-label={seated ? `Linear Wrapped ${year} floppy disk, in the drive` : `Linear Wrapped ${year} floppy disk. Drag it up into the drive, or press Enter to insert it.`}
            whileHover={reduce || seated || dragging ? undefined : { scale: 1.04 }}
            className="focus-ph block cursor-grab touch-none select-none rounded-md active:cursor-grabbing disabled:cursor-default"
            style={{ position: "fixed", left: rest.left, top: rest.top, width: rest.width, height: rest.height, zIndex: TOP_LAYER, x, y, rotate: tilt, padding: 0, background: "none", border: 0 }}
          >
            <Floppy year={year} className="pointer-events-none block h-auto w-full drop-shadow-[0_8px_0_rgb(0_0_0/0.45)]" />
          </motion.button>,
          document.body,
        )}
    </div>
  );
}
