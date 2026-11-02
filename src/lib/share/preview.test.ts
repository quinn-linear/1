import assert from "node:assert/strict";
import { test } from "node:test";
import { buildShareLink } from "./link.ts";
import { previewReducer, previewSrc } from "./preview.ts";
import { fixtureRecap } from "../fixtures.ts";
import { buildSnapshot } from "./snapshot.ts";
import { IMAGE_VERSION } from "./theme.ts";

test("preview moves loading -> loaded, or -> error and back via retry", () => {
  assert.equal(previewReducer("loading", "load"), "loaded");
  assert.equal(previewReducer("loading", "error"), "error");
  assert.equal(previewReducer("error", "retry"), "loading");
  assert.equal(previewReducer("loaded", "retry"), "loaded");
  assert.equal(previewReducer("loaded", "error"), "loaded");
});

test("preview URL is the real story image at the current design version", () => {
  const link = buildShareLink(buildSnapshot("summary", fixtureRecap("full")), "secret");
  const src = previewSrc(link);
  assert.match(src, new RegExp(`^/s/[^/]+/image\\?f=story&r=${IMAGE_VERSION}$`));
  assert.equal(src, link.storyImagePath);
});

test("the summary link's public text names nothing from the workspace", () => {
  const recap = fixtureRecap("full");
  const link = buildShareLink(buildSnapshot("summary", recap), "secret");
  assert.equal(link.sensitive, false);
  const names = [recap.workspace].filter((n): n is string => typeof n === "string" && n.length > 2);
  for (const n of names) assert.ok(!JSON.stringify(link).includes(n), n);
});

test("dialog: consent gates actions and the link, primary actions are Copy + Download, no glow", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../../components/story/ShareDialog.tsx", import.meta.url), "utf8");
  assert.match(src, /const canShare = !!link && \(!link\.sensitive \|\| ack\)/);
  assert.match(src, /link && canShare && \(\s*<input/); // the link isn't shown before consent
  assert.match(src, /I&apos;m okay making them public/);
  assert.match(src, /<dialog/); // native modal: focus trap, Esc, focus return
  assert.match(src, /safe-area-inset-top/);
  assert.match(src, /overflow-y-auto/);
  assert.doesNotMatch(src, /phosphor|term-btn/);
  for (const label of ["Copy link", "Download", "Share link on X", "Save image \\+ open X", "Download wide image"]) assert.match(src, new RegExp(label));
  assert.match(src, /can&apos;t attach an image/); // never claims X attaches the PNG
});
