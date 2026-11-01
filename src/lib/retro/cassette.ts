/**
 * The landing sign-in as a small state machine: a floating cassette is dragged
 * (or tapped, or activated from the keyboard) onto the computer, the screen
 * says ACCESS GRANTED, and then the page goes to Linear's real OAuth screen in
 * the same tab. Pure so the transitions and timings are tested; the UI only
 * renders it.
 *
 * Phases: `idle` (cassette at rest), `dragging` (held, not over the computer),
 * `over` (held over the computer: it glows), `granted` (dropped or activated:
 * the message shows), `launching` (the redirect has been requested).
 * Once granted, nothing can start it again, so a second drop, tap or key press
 * can never trigger a second redirect.
 */
export type GrantPhase = "idle" | "dragging" | "over" | "granted" | "launching";

export type GrantAction =
  | { type: "grab" }
  | { type: "enter" }
  | { type: "leave" }
  /** `over`: whether the pointer was over the computer at release (measured at that moment). */
  | { type: "release"; over: boolean }
  /** Tap or keyboard: the same grant, without a drag. */
  | { type: "activate" }
  | { type: "cancel" }
  | { type: "launch" }
  /** Page restored from the back/forward cache after the redirect: start over. */
  | { type: "reset" };

export function grantReducer(phase: GrantPhase, action: GrantAction): GrantPhase {
  switch (action.type) {
    case "grab":
      return phase === "idle" ? "dragging" : phase;
    case "enter":
      return phase === "dragging" ? "over" : phase;
    case "leave":
      return phase === "over" ? "dragging" : phase;
    case "release":
      return phase === "dragging" || phase === "over" ? (action.over ? "granted" : "idle") : phase;
    case "activate":
      return phase === "idle" ? "granted" : phase;
    case "cancel":
      return phase === "dragging" || phase === "over" ? "idle" : phase;
    case "launch":
      return phase === "granted" ? "launching" : phase;
    case "reset":
      return "idle";
  }
}

/** Exactly this, on the screen, when the cassette is accepted. */
export const ACCESS_GRANTED = "ACCESS GRANTED";
/** Second line under it; short enough for the PET screen. */
export const CONNECTING = "CONNECTING TO LINEAR...";

/** How long the message shows before the redirect: long enough to read, short enough not to feel stuck. Reduced motion keeps a shorter hold. */
export const GRANT_HOLD_MS = 1300;
export const GRANT_HOLD_REDUCED_MS = 600;
export const grantHold = (reduced: boolean) => (reduced ? GRANT_HOLD_REDUCED_MS : GRANT_HOLD_MS);

/** Name printed on the cassette label. */
export const TAPE_NAME = "LINEAR WRAPPED";
