/**
 * State of the share dialog's preview picture. The image is the same versioned
 * PNG recipients get (`storyImagePath`, which carries `r=<IMAGE_VERSION>`), so
 * the preview is never a different design from the shared card. Rendering a
 * 1080x1920 PNG on the server can take a few seconds, so the dialog shows a
 * loading state, and an error state with a retry rather than a blank box.
 */
export type PreviewState = "loading" | "loaded" | "error";
export type PreviewEvent = "load" | "error" | "retry";

export function previewReducer(state: PreviewState, event: PreviewEvent): PreviewState {
  if (event === "retry") return state === "error" ? "loading" : state;
  if (state !== "loading") return state; // late events from a replaced image are ignored
  return event === "load" ? "loaded" : "error";
}

/** The preview is exactly the story image URL: same path, same design version. */
export const previewSrc = (link: { storyImagePath: string }) => link.storyImagePath;
