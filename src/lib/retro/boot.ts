/**
 * The landing "boot" flow as a small state machine: no disk, disk going in,
 * loading from the drive, ready for a command, then launching OAuth. Pure so
 * the transitions and terminal copy are tested; the UI only renders it.
 */

export type BootPhase = "empty" | "inserting" | "loading" | "ready" | "launching";

export type BootAction = { type: "insert" } | { type: "inserted" } | { type: "loaded" } | { type: "run" } | { type: "eject" };

export function bootReducer(phase: BootPhase, action: BootAction): BootPhase {
  switch (action.type) {
    case "insert":
      return phase === "empty" ? "inserting" : phase;
    case "inserted":
      return phase === "inserting" ? "loading" : phase;
    case "loaded":
      return phase === "loading" ? "ready" : phase;
    case "run":
      return phase === "ready" ? "launching" : phase;
    case "eject":
      return phase === "launching" ? phase : "empty";
  }
}

/** Disk name as it appears on the label and in `LOAD`. */
export const DISK_NAME = "LINEAR WRAPPED";

/** Lines the drive "prints" while loading, in order. Short enough for a 32-column screen. */
export const LOAD_LINES = ['LOAD "LINEAR WRAPPED",8', "", "SEARCHING FOR LINEAR WRAPPED", "LOADING", "", "READY."] as const;

export const EMPTY_LINES = ["*** LINEAR WRAPPED 2026 ***", "", "32K RAM  31743 BYTES FREE", "", "READY.", "INSERT THE FLOPPY DISK"] as const;

export type Command = { kind: "run" } | { kind: "help" } | { kind: "unknown"; text: string };

/** Enter on an empty line, or `RUN`/`START`/`GO`, signs in. `HELP`/`?` explains. Anything else is a (friendly) syntax error. */
export function parseCommand(raw: string): Command {
  const text = raw.trim().toUpperCase();
  if (text === "" || text === "RUN" || text === "START" || text === "GO" || text === "SIGN IN") return { kind: "run" };
  if (text === "HELP" || text === "?") return { kind: "help" };
  return { kind: "unknown", text };
}

export const HELP_LINES = ["PRESS ENTER OR TYPE RUN", "TO SIGN IN WITH LINEAR.", "READ-ONLY. NOTHING STORED."] as const;
export const SYNTAX_LINES = ["?SYNTAX  ERROR", "PRESS ENTER OR TYPE RUN"] as const;
