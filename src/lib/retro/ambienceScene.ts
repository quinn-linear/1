import type { Ambience } from "./ambience.ts";

/**
 * Decides when the machine-room hum may run. It is bound to the landing scene:
 * it runs only while the scene is mounted, sound is on (the saved opt-in or a
 * toggle), a user gesture has unlocked audio, and the tab is visible. Every
 * input funnels through `sync`, so no other path (the recap's sound toggle,
 * visibility changes, a late gesture) can start it once the scene is gone.
 * Individual sound effects don't go through here and are unaffected.
 */
export interface AmbienceScene {
  setEnabled: (on: boolean) => void;
  setScene: (active: boolean) => void;
  setHidden: (hidden: boolean) => void;
  /** A click or key press: browsers now allow audio. */
  unlock: () => void;
}

export function createAmbienceScene(ambience: Pick<Ambience, "start" | "stop">): AmbienceScene {
  let enabled = false;
  let scene = false;
  let hidden = false;
  let unlocked = false;

  const sync = () => {
    if (enabled && scene && unlocked && !hidden) void ambience.start();
    else ambience.stop();
  };

  return {
    setEnabled: (on) => {
      enabled = on;
      sync();
    },
    setScene: (active) => {
      scene = active;
      sync();
    },
    setHidden: (h) => {
      hidden = h;
      sync();
    },
    unlock: () => {
      unlocked = true;
      sync();
    },
  };
}
