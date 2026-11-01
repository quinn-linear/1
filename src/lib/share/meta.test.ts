import assert from "node:assert/strict";
import { test } from "node:test";
import { IMAGE_VERSION } from "./theme.ts";
import { shareMetadata, UNAVAILABLE_METADATA } from "./meta.ts";
import { encodeSnapshot, MAX_TOKEN_LENGTH, type Snapshot } from "./snapshot.ts";

const SECRET = "test-secret";
const ORIGIN = "https://wrapped.example";
const snap: Snapshot = { v: 1, y: 2026, c: "total", n: 12, d: 5, u: false };
const token = encodeSnapshot(snap, SECRET);

test("valid token yields absolute canonical + wide og/twitter image, still noindex", () => {
  const m = shareMetadata(token, SECRET, ORIGIN);
  const url = `${ORIGIN}/s/${token}`;
  assert.equal(m.alternates?.canonical, url);
  assert.deepEqual(m.robots, { index: false });
  assert.equal(m.title, "Issues closed: 12 issues");
  assert.match(String(m.description), /Get your own Linear Wrapped 2026/);
  const og = m.openGraph as { url: string; images: { url: string; width: number; height: number }[] };
  assert.equal(og.url, url);
  assert.deepEqual(og.images[0], { ...og.images[0], url: `${url}/image?f=og&r=${IMAGE_VERSION}`, width: 1200, height: 630 });
  const tw = m.twitter as { card: string; images: { url: string }[] };
  assert.equal(tw.card, "summary_large_image");
  assert.equal(tw.images[0].url, `${url}/image?f=og&r=${IMAGE_VERSION}`);
});

test("title and description are bounded", () => {
  const long = encodeSnapshot({ v: 1, y: 2026, c: "project", p: { n: "N".repeat(40), k: 3 } } as Snapshot, SECRET);
  const m = shareMetadata(long, SECRET, ORIGIN);
  assert.ok([...String(m.title)].length <= 70);
  assert.ok([...String(m.description)].length <= 200);
});

test("malformed, forged, oversized and unconfigured tokens get generic noindex metadata", () => {
  const forged = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
  const bad = ["", "abc", "a.b", "../../etc/passwd", "<script>", `${"a".repeat(MAX_TOKEN_LENGTH)}.${"b".repeat(22)}`, forged, `${token}/extra`];
  for (const t of bad) assert.equal(shareMetadata(t, SECRET, ORIGIN), UNAVAILABLE_METADATA, t.slice(0, 30));
  assert.equal(shareMetadata(token, SECRET + "x", ORIGIN), UNAVAILABLE_METADATA);
  assert.equal(shareMetadata(token, null, ORIGIN), UNAVAILABLE_METADATA);
  assert.deepEqual(UNAVAILABLE_METADATA.robots, { index: false, follow: false });
  assert.equal(JSON.stringify(UNAVAILABLE_METADATA).includes("http"), false);
});

test("the preview image is an absolute, versioned, wide PNG that X can fetch without any credentials", () => {
  const m = shareMetadata(token, SECRET, ORIGIN);
  const og = m.openGraph as { images: { url: string; width: number; height: number; type: string }[] };
  const url = new URL(og.images[0].url);
  assert.equal(url.origin, ORIGIN, "absolute, on the configured origin");
  assert.equal(url.searchParams.get("r"), IMAGE_VERSION, "versioned, so a redesign is not stuck in X's cache");
  assert.equal(url.searchParams.get("f"), "og");
  assert.equal(url.username + url.password, "");
  assert.equal(og.images[0].type, "image/png");
  assert.equal(og.images[0].width / og.images[0].height, 1200 / 630);
});
