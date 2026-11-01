/**
 * Browser fullscreen, handled honestly. The Fullscreen API only works from a
 * user gesture (transient activation), and an OAuth redirect throws that
 * activation away, so a page can never go fullscreen by itself after sign-in.
 * So we ask on a real click ("Enter recap" or the dock button), and when the
 * browser says no (or has no API, as on iPhone Safari) we say so and carry on in
 * the full window. Pressing Esc is the browser's own exit and is never undone.
 * The document is passed in so every branch is tested without a browser.
 */
interface FsElement {
  requestFullscreen?: (options?: { navigationUI?: "hide" | "show" | "auto" }) => Promise<void>;
  webkitRequestFullscreen?: () => void | Promise<void>;
}

export interface FsDocument {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  fullscreenElement?: unknown;
  webkitFullscreenElement?: unknown;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => void | Promise<void>;
  documentElement: FsElement;
}

/** The API exists and the browser allows it here (iframes and iPhone Safari commonly don't). */
export function fullscreenSupported(doc: FsDocument): boolean {
  const el = doc.documentElement;
  const hasRequest = typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function";
  const enabled = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false;
  return hasRequest && enabled;
}

export const isFullscreen = (doc: FsDocument): boolean => !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);

export type EnterResult = "entered" | "rejected" | "unsupported";

/** Must be called synchronously from a click or key handler: the request is made before anything is awaited. */
export async function enterFullscreen(doc: FsDocument): Promise<EnterResult> {
  if (!fullscreenSupported(doc)) return "unsupported";
  const el = doc.documentElement;
  try {
    if (typeof el.requestFullscreen === "function") await el.requestFullscreen({ navigationUI: "hide" });
    else await el.webkitRequestFullscreen?.();
    return "entered";
  } catch {
    return "rejected";
  }
}

/** Leaves fullscreen if in it. Never throws (the user may already have pressed Esc). */
export async function exitFullscreen(doc: FsDocument): Promise<void> {
  if (!isFullscreen(doc)) return;
  try {
    if (typeof doc.exitFullscreen === "function") await doc.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
  } catch {
    /* already out */
  }
}

export interface FsState {
  supported: boolean;
  active: boolean;
  /** The browser refused the last request; we are using the full window instead. */
  blocked: boolean;
}

export type FsAction = { type: "init"; supported: boolean; active: boolean } | { type: "change"; active: boolean } | { type: "blocked" } | { type: "dismiss" };

export const FS_INITIAL: FsState = { supported: false, active: false, blocked: false };

/** `change` comes from the browser's fullscreenchange event (Esc, the X button, the OS). It only ever records what happened: nothing here re-enters. */
export function fsReducer(state: FsState, action: FsAction): FsState {
  switch (action.type) {
    case "init":
      return { supported: action.supported, active: action.active, blocked: false };
    case "change":
      return { ...state, active: action.active, blocked: action.active ? false : state.blocked };
    case "blocked":
      return { ...state, blocked: true };
    case "dismiss":
      return { ...state, blocked: false };
  }
}

export const FS_BLOCKED_NOTICE = "Your browser blocked full screen, so the recap fills the window instead.";
