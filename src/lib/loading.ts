/** Exact copy shown on the slow-load screen. No percentage: we don't know how far along the Linear calls are. */
export const LOADING_COPY = "loading your Linear workspace";

/**
 * How long the stats must be pending before the loading screen appears. Most
 * loads that finish inside this window show nothing but the dark desk, then the
 * recap, so there is no flash of a screen that would vanish at once. 400ms sits
 * between the ~300ms where a change starts to feel like a delay and the ~500ms
 * where a blank page starts to feel broken.
 */
export const LOADING_DELAY_MS = 400;
