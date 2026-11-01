"use client";

import { useCallback, useEffect, useReducer } from "react";
import { FS_INITIAL, enterFullscreen, exitFullscreen, fsReducer, fullscreenSupported, isFullscreen, type EnterResult, type FsDocument } from "@/lib/fullscreen";

const doc = () => document as unknown as FsDocument;

/**
 * Fullscreen state for the recap. `enter` has to be called from a click or key
 * handler. State follows the browser's own `fullscreenchange`, so Esc, the X
 * button and the OS all stay in sync, and nothing ever re-enters on its own.
 */
export function useFullscreen() {
  const [state, dispatch] = useReducer(fsReducer, FS_INITIAL);

  useEffect(() => {
    dispatch({ type: "init", supported: fullscreenSupported(doc()), active: isFullscreen(doc()) });
    const onChange = () => dispatch({ type: "change", active: isFullscreen(doc()) });
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  // The blocked notice clears itself.
  useEffect(() => {
    if (!state.blocked) return;
    const t = window.setTimeout(() => dispatch({ type: "dismiss" }), 6000);
    return () => window.clearTimeout(t);
  }, [state.blocked]);

  const enter = useCallback((): Promise<EnterResult> => {
    // The request is issued synchronously (inside `enterFullscreen`), while the click's activation is still live.
    const result = enterFullscreen(doc());
    void result.then((r) => r === "rejected" && dispatch({ type: "blocked" }));
    return result;
  }, []);

  const exit = useCallback(() => exitFullscreen(doc()), []);
  const toggle = useCallback(() => (isFullscreen(doc()) ? exit() : enter()), [enter, exit]);

  return { ...state, enter, exit, toggle };
}
