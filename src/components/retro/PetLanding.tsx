"use client";

import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useReducer, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { EMPTY_LINES, HELP_LINES, LOAD_LINES, SYNTAX_LINES, bootReducer, parseCommand } from "@/lib/retro/boot";
import { DriveFront, Floppy } from "./Floppy";
import { PetComputer } from "./PetComputer";
import { SoundToggle, useSound } from "./Sound";

/** The disk sits this far up (as a share of its own height) when seated in the drive. */
const SEATED = "-115%";
/** Dragging the disk up by at least this many px counts as pushing it into the slot. */
const PUSH_PX = 70;

/**
 * The landing screen: a PET-style computer with a green terminal, an external
 * drive and a floppy disk. Insert the disk (drag it, tap it, or press the
 * button), watch it load, then press Enter, type RUN or press the RETURN key
 * to start the real read-only OAuth sign-in (`startPath`). A plain "skip" link
 * to the same sign-in is always on the page, so the flourish never gates it.
 */
export function PetLanding({ year, startPath }: { year: number; startPath: string }) {
  const reduce = !!useReducedMotion();
  const { play } = useSound();
  const [phase, dispatch] = useReducer(bootReducer, "empty");
  const [log, setLog] = useState<string[]>([]);
  const [noDisk, setNoDisk] = useState(false);
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);
  const disk = useAnimationControls();

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, reduce ? Math.min(ms, 40) : ms));
  }, [reduce]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const append = (...lines: string[]) => setLog((l) => [...l, ...lines]);

  const insert = useCallback(() => {
    if (phase !== "empty") return;
    dispatch({ type: "insert" });
    setNoDisk(false);
    setLog([]);
    play("disk");
    void disk.start({ x: 0, y: SEATED }, { duration: reduce ? 0.01 : 0.7, ease: [0.3, 0.7, 0.3, 1] });
    later(760, () => {
      dispatch({ type: "inserted" });
      LOAD_LINES.forEach((line, i) => later(300 + i * 330, () => append(line)));
      later(300 + LOAD_LINES.length * 330 + 150, () => {
        dispatch({ type: "loaded" });
        play("ready");
        if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
      });
    });
  }, [disk, later, phase, play, reduce]);

  const eject = () => {
    clearTimers();
    dispatch({ type: "eject" });
    setLog([]);
    setValue("");
    setNoDisk(false);
    play("key");
    void disk.start({ x: 0, y: 0 }, { duration: reduce ? 0.01 : 0.5 });
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

  const pushed = (offsetY: number, offsetX: number) => offsetY <= -PUSH_PX && Math.abs(offsetX) < 160;
  const seated = phase !== "empty";
  const lines = phase === "empty" ? [...EMPTY_LINES, ...(noDisk ? ["?NO DISK  ERROR"] : [])] : log;
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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PetComputer on={seated}>
          {/* The terminal: a log (read out politely) with a live prompt once a program is loaded. */}
          <div role="log" aria-label="Terminal" className="flex flex-col justify-end overflow-hidden" onClick={() => input.current?.focus()}>
            {lines.map((line, i) => (
              <p key={i} className="whitespace-pre-wrap break-words">
                {line === "" ? " " : line}
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
        </PetComputer>
        <p className="sr-only" role="status">
          {status}
        </p>

      </div>

      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="order-2 md:order-1">
        {/* The case's own buttons: every step is also a real, labelled key. */}
        <div className="case flex flex-wrap items-center gap-3 rounded-md px-4 py-3">
          <button type="button" className="keycap" onClick={insert} disabled={seated}>
            Insert floppy
          </button>
          <button type="button" className="keycap" onClick={() => submit()} disabled={phase !== "ready"} aria-label="Return: run the program and sign in with Linear">
            Return ⏎ Run
          </button>
          <button type="button" className="keycap" onClick={eject} disabled={!seated || phase === "launching"}>
            Eject
          </button>
          <SoundToggle className="ml-auto" />
        </div>
        </div>
        <div className="order-1 mx-auto w-full max-w-md md:order-2">
        <div className="relative w-full" style={{ aspectRatio: "480 / 420" }}>
          <DriveFront busy={phase === "inserting" || phase === "loading"} className="pointer-events-none absolute left-0 top-0 z-10 h-auto w-full" />
          {/* The tray: the disk is clipped where the slot is, so pushing it up reads as sliding in. */}
          <div className="absolute inset-x-0 bottom-0 top-[29%] overflow-hidden">
            <motion.button
              type="button"
              drag={phase === "empty"}
              dragElastic={0.25}
              dragMomentum={false}
              animate={disk}
              initial={false}
              onDragEnd={(_, info) => {
                if (pushed(info.offset.y, info.offset.x)) insert();
                else void disk.start({ x: 0, y: 0 }, { type: "spring", stiffness: 300, damping: 24 });
              }}
              onTap={insert}
              onClick={(e) => e.detail === 0 && insert()}
              disabled={seated}
              aria-label={seated ? `${"Linear Wrapped"} ${year} floppy disk, in the drive` : `Linear Wrapped ${year} floppy disk. Drag it up into the drive, or press Enter to insert it.`}
              whileHover={reduce || seated ? undefined : { y: -6 }}
              className="focus-ph absolute left-[29%] top-[20%] block w-[42%] cursor-grab touch-none rounded-md active:cursor-grabbing disabled:cursor-default"
              style={{ rotate: seated ? 0 : -5 }}
            >
              <Floppy year={year} className="block h-auto w-full drop-shadow-[0_10px_0_rgb(0_0_0/0.45)]" />
            </motion.button>
          </div>
        </div>
        <p className="mt-4 text-lg leading-snug text-ph/80">
          {phase === "empty" ? (
            <>
              <span className="text-amber">STEP 1.</span> Drag the floppy up into the drive. Or tap it, or press <span className="text-amber">INSERT FLOPPY</span>.
            </>
          ) : (
            <>
              <span className="text-amber">STEP 2.</span> {phase === "ready" ? "Press ENTER at the terminal (or the RETURN key) to run it." : "Loading from the disk. Hang on."}
            </>
          )}
        </p>
        </div>
      </div>
    </div>
  );
}
