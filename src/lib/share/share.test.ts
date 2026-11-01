import assert from "node:assert/strict";
import { test } from "node:test";
import { CARD_IDS, toRecap, type Recap } from "../recap.ts";
import { computeStats, type IssueNode } from "../stats/compute.ts";
import { describe, disclosure, shareText } from "./copy.ts";
import { buildShareLink } from "./link.ts";
import {
  MAX_NAME, MAX_TITLE, MAX_TOKEN_LENGTH, buildSnapshot, cleanText, decodeToken, encodeSnapshot, parseSnapshot, type Snapshot,
} from "./snapshot.ts";
import { IMAGE_VERSION, LEGACY_IMAGE_VERSIONS, imageCacheControl, imageQuery, isAcceptedVersion, parseFormat } from "./theme.ts";

const SECRET = "test-secret";
const person = { id: "u-secret-1", name: "ada", displayName: "Ada L", avatarUrl: "https://cdn.example/avatar-secret.png" };
const other = { id: "u-secret-2", name: "bob", displayName: "Bob Collab", avatarUrl: "https://cdn.example/bob.png" };
const issue = (id: string, completedAt: string): IssueNode =>
  ({ id, completedAt, project: { id: "proj-secret", name: "Apollo" }, labels: { nodes: [{ id: "l1", name: "security" }] }, creator: other, assignee: person }) as IssueNode;

function recap(over: Partial<Recap> = {}): Recap {
  const stats = computeStats({
    year: 2026,
    now: new Date("2026-11-01T00:00:00Z"),
    viewer: { ...person, timezone: "UTC", organization: "Acme" } as never,
    assignedCompleted: ["2026-03-04", "2026-03-05", "2026-06-10"].map((d, i) => issue(`i${i}`, `${d}T10:00:00Z`)),
    createdCompleted: [],
    openAssigned: [{ id: "oi-secret", identifier: "ENG-123", title: "Fix the thing", url: "https://linear.app/acme/issue/ENG-123", createdAt: "2026-01-02T00:00:00Z" }],
    integrations: { status: "ok", services: ["slack", "github"] },
    truncated: false,
  } as never);
  return { ...toRecap(stats), ...over };
}

const all = (r = recap()) => CARD_IDS.map((c) => buildSnapshot(c, r));

test("every card roundtrips through encode/decode", () => {
  for (const snap of all()) {
    const token = encodeSnapshot(snap, SECRET);
    assert.deepEqual(decodeToken(token, SECRET), snap, snap.c);
  }
});

test("snapshots never contain ids, urls, avatars, tokens or identifiers", () => {
  for (const snap of all()) {
    const link = buildShareLink(snap, SECRET);
    const blob = JSON.stringify(snap) + JSON.stringify(link) + describe(snap).alt + shareText(snap) + JSON.stringify(disclosure(snap));
    for (const banned of ["u-secret", "proj-secret", "oi-secret", "ENG-123", "https://", "avatar-secret", "bob.png", "linear.app", "createdAt", "accessToken"]) {
      assert.ok(!blob.replace(/https:\/\/x\.com/g, "").includes(banned), `${snap.c} leaked ${banned}`);
    }
  }
});

test("each card only carries its own data", () => {
  const byCard = Object.fromEntries(all().map((s) => [s.c, JSON.stringify(s)]));
  assert.ok(!byCard.total.includes("Apollo") && !byCard.total.includes("Bob"));
  assert.ok(byCard.project.includes("Apollo") && !byCard.project.includes("Bob") && !byCard.project.includes("security"));
  assert.ok(byCard.collaborator.includes("Bob Collab") && !byCard.collaborator.includes("Apollo"));
  assert.ok(byCard["got-away"].includes("Fix the thing") && !byCard["got-away"].includes("Apollo"));
  // The summary shows counts only: no project, collaborator, label or issue names.
  for (const name of ["Apollo", "Bob", "security", "Fix the thing", "Ada", "slack"]) assert.ok(!byCard.summary.includes(name), name);
  assert.ok(!byCard.intro.includes("Ada"), "intro must not include the viewer's name");
});

test("disclosure flags name-bearing cards as sensitive", () => {
  const sensitive = all().filter((s) => disclosure(s).sensitive).map((s) => s.c).sort();
  assert.deepEqual(sensitive, ["collaborator", "constellation", "got-away", "integrations", "label", "project"]);
  assert.ok(disclosure(buildSnapshot("got-away", recap())).items.join().includes("Fix the thing"));
  assert.equal(disclosure(buildSnapshot("project", recap({ biggestProject: null }))).sensitive, false);
});

test("empty and unavailable states are shareable without fabricating data", () => {
  const empty = recap({ biggestProject: null, topCollaborator: null, labelOfYear: null, oldestOpenIssue: null, longestStreak: null, peakMonth: null, integrations: { status: "unavailable", services: [] } });
  for (const snap of all(empty)) {
    assert.deepEqual(decodeToken(encodeSnapshot(snap, SECRET), SECRET), snap);
    assert.ok(describe(snap).headline.length > 0);
  }
  assert.equal(describe(buildSnapshot("integrations", empty)).headline, "Can't see these");
});

test("undercount caveat survives into the shared card", () => {
  const snap = buildSnapshot("total", recap({ truncated: true }));
  assert.match(describe(snap).footnote ?? "", /undercount/);
  assert.match(describe(buildSnapshot("integrations", recap())).footnote ?? "", /Workspace-level/);
  assert.match(describe(buildSnapshot("collaborator", recap())).footnote ?? "", /creator\/assignee/);
});

test("year is dynamic", () => {
  const snap = buildSnapshot("total", recap({ year: 2027 }));
  assert.equal(snap.y, 2027);
  assert.match(describe(snap).alt, /2027/);
  assert.equal(decodeToken(encodeSnapshot(snap, SECRET), SECRET)?.y, 2027);
});

test("tampered, forged, malformed and oversized tokens are rejected", () => {
  const snap = buildSnapshot("project", recap());
  const token = encodeSnapshot(snap, SECRET);
  const [payload, sig] = token.split(".");
  assert.equal(decodeToken(token, "other-secret"), null);
  const forged = Buffer.from(JSON.stringify({ ...snap, p: { n: "Evil", k: 1 } })).toString("base64url");
  assert.equal(decodeToken(`${forged}.${sig}`, SECRET), null);
  for (const bad of ["", ".", "abc", `${payload}`, `${payload}.`, `${payload}.${sig}x`, `${payload}.${"A".repeat(22)}`, `${"A".repeat(MAX_TOKEN_LENGTH)}.${sig}`, "<script>.alert", "a b.c"]) {
    assert.equal(decodeToken(bad, SECRET), null, bad.slice(0, 20));
  }
});

test("validator rejects bad shapes, extra keys and out-of-range values", () => {
  const ok = { v: 1, y: 2026, c: "total", n: 5, d: 3, u: false };
  assert.ok(parseSnapshot(ok));
  const bad: unknown[] = [
    null, [], "x", { ...ok, extra: 1 }, { ...ok, v: 2 }, { ...ok, y: 1999 }, { ...ok, n: -1 }, { ...ok, n: 1.5 }, { ...ok, n: 1e12 }, { ...ok, d: 400 }, { ...ok, u: "no" },
    { ...ok, c: "nope" }, { v: 1, y: 2026, c: "total" },
    { v: 1, y: 2026, c: "archetype", a: "hacker", i: false },
    { v: 1, y: 2026, c: "peak", b: [1, 2], m: 1 },
    { v: 1, y: 2026, c: "peak", b: Array(12).fill(0), m: 13 },
    { v: 1, y: 2026, c: "streak", s: { n: 3, a: "2026-05-05", z: "2026-05-01" } },
    { v: 1, y: 2026, c: "streak", s: { n: 3, a: "2026-13-05", z: "2026-13-06" } },
    { v: 1, y: 2026, c: "project", p: { n: "a".repeat(MAX_NAME + 1), k: 1 } },
    { v: 1, y: 2026, c: "project", p: { n: "bad‮name", k: 1 } },
    { v: 1, y: 2026, c: "project", p: { n: " padded ", k: 1 } },
    { v: 1, y: 2026, c: "integrations", s: { l: ["https://evil.example"], t: 1 } },
    { v: 1, y: 2026, c: "integrations", s: { l: Array(9).fill("a"), t: 9 } },
    { v: 1, y: 2026, c: "got-away", o: { t: "x".repeat(MAX_TITLE + 1), d: 1 } },
    { v: 1, y: 2026, c: "got-away", o: { t: "ok", d: 1, url: "https://x" } },
  ];
  for (const b of bad) assert.equal(parseSnapshot(b), null, JSON.stringify(b)?.slice(0, 60));
  const proto = JSON.parse('{"v":1,"y":2026,"c":"intro","__proto__":{"x":1}}');
  assert.equal(parseSnapshot(proto), null);
});

test("cleanText strips control/bidi characters and truncates by code point", () => {
  assert.equal(cleanText("  a‮b\u0000c\n\td  ", 40), "a b c d");
  assert.equal(cleanText("x".repeat(100), 10), `${"x".repeat(9)}…`);
  assert.equal([...cleanText("😀".repeat(50), 10)].length, 10);
});

test("worst-case tokens stay under the length cap", () => {
  const long = (n: number) => "😀".repeat(n);
  const worst: Snapshot[] = [
    { v: 1, y: 2026, c: "got-away", o: { t: '"'.repeat(MAX_TITLE), d: 36500 } },
    { v: 1, y: 2026, c: "got-away", o: { t: long(MAX_TITLE), d: 36500 } },
    { v: 1, y: 2026, c: "project", p: { n: long(MAX_NAME), k: 9_999_999 } },
    { v: 1, y: 2026, c: "integrations", s: { l: Array(8).fill("a".repeat(24)), t: 9_999_999 } },
    { v: 1, y: 2026, c: "peak", b: Array(12).fill(9_999_999), m: 12 },
  ];
  for (const s of worst) {
    const token = encodeSnapshot(s, SECRET);
    assert.ok(token.length < MAX_TOKEN_LENGTH, `${s.c} ${token.length}`);
    assert.ok(`/s/${token}`.length < 1100);
    assert.deepEqual(decodeToken(token, SECRET), s);
  }
  assert.throws(() => encodeSnapshot({ v: 1, y: 2026, c: "got-away", o: { t: "x".repeat(MAX_TITLE + 1), d: 1 } }, SECRET));
});

test("share link paths and text", () => {
  for (const snap of all()) {
    const link = buildShareLink(snap, SECRET);
    assert.match(link.path, /^\/s\/[\w-]+\.[\w-]{22}$/);
    assert.equal(link.storyImagePath, `${link.path}/image?f=story&r=${IMAGE_VERSION}`);
    assert.equal(link.wideImagePath, `${link.path}/image?f=og&r=${IMAGE_VERSION}`);
    assert.ok(link.text.length <= 200, link.text);
    assert.ok(link.reveals.length > 0);
  }
});

test("image format parsing is a closed set", () => {
  assert.equal(parseFormat(null), "story");
  assert.equal(parseFormat("og"), "og");
  for (const bad of ["", "STORY", "../x", "story ", "1080x1920", "og&x=1"]) assert.equal(parseFormat(bad), null);
});

/** PNG width/height live in the IHDR chunk. */
const pngSize = (buf: Uint8Array) => {
  const v = new DataView(buf.buffer, buf.byteOffset);
  assert.equal(v.getUint32(0), 0x89504e47, "PNG signature");
  return { width: v.getUint32(16), height: v.getUint32(20) };
};

test("share images render as PNGs at 1080x1920 and 1200x630 for every card", { timeout: 120_000 }, async () => {
  const { ImageResponse } = await import("next/og.js");
  const { renderCard } = await import("./image.ts");
  const { IMAGE_FORMATS } = await import("./theme.ts");
  const nasty = (title: string) => buildSnapshot("got-away", recap({ oldestOpenIssue: { identifier: "X-1", title, ageDays: 99, createdAt: "2026-01-01T00:00:00Z" } }));
  const snaps = [...all(), nasty("😀".repeat(80)), nasty("日本語のタイトル مرحبا Ǆ Ǉ ñ é Ł ½ \u00AD ‽"), nasty("W".repeat(80))];
  // Rendering must never reach the network (emoji/font CDNs), whatever text a link carries.
  const realFetch = globalThis.fetch;
  const remote: string[] = [];
  globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    // Bundled assets (font, wasm) load via file:/data: URLs; anything else is a network request.
    if (url.startsWith("file:") || url.startsWith("data:")) return realFetch(input, init);
    remote.push(url);
    return Promise.reject(new Error("network disabled in test"));
  }) as typeof fetch;
  try {
  for (const snap of snaps) {
    for (const format of ["story", "og"] as const) {
      const res = new ImageResponse(renderCard(snap, format), IMAGE_FORMATS[format]);
      assert.equal(res.headers.get("content-type"), "image/png");
      const size = pngSize(new Uint8Array(await res.arrayBuffer()));
      assert.deepEqual(size, IMAGE_FORMATS[format], `${snap.c} ${format}`);
    }
  }
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(remote, [], "image rendering made outbound requests");
});

test("image text only keeps characters the bundled font covers", async () => {
  const { imageSafe } = await import("./image.ts");
  assert.equal(imageSafe("Café – Ñandú"), "Café – Ñandú");
  assert.equal(imageSafe("Hi 😀😀 日本"), "Hi ? ?");
});

test("summary token is design-independent, so image URLs must carry the design version", () => {
  const snap = all().find((s) => s.c === "summary")!;
  const link = buildShareLink(snap, SECRET);
  // Same snapshot -> same token before/after a redesign; only `r` can bust cached PNGs.
  assert.equal(link.path, buildShareLink(snap, SECRET).path);
  assert.match(IMAGE_VERSION, /^[a-z0-9]{1,8}$/);
  for (const f of ["story", "og"] as const) assert.equal(imageQuery(f), `f=${f}&r=${IMAGE_VERSION}`);
  assert.ok(link.storyImagePath.endsWith(`r=${IMAGE_VERSION}`) && link.wideImagePath.endsWith(`r=${IMAGE_VERSION}`));
});

test("summary renders the dot-matrix print-out, not the plain layout and not the old floppy", async () => {
  const { renderCard } = await import("./image.ts");
  const snap = all().find((s) => s.c === "summary")!;
  for (const f of ["story", "og"] as const) {
    const json = JSON.stringify(renderCard(snap, f));
    assert.match(json, /END OF YEAR REPORT/, `${f} report footer`);
    assert.match(json, /YOUR ARCHETYPE/, `${f} archetype band`);
    assert.match(json, /CLOSED/, `${f} stats`);
    assert.match(json, /"d":"M[\d. -]+a/, `${f} dot-matrix dots`);
    assert.doesNotMatch(json, /#ff6ec7|disk-sigil|#e8e0c4/, `${f} has no foil, sigil or floppy label`);
    assert.doesNotMatch(json, /93,255,143|5dff8f/i, `${f} has no green phosphor`);
    assert.doesNotMatch(json, /NAME:/, `${f} public image never prints a name`);
  }
});

test("the retro redesign bumps the image version and keeps old signed links working", () => {
  assert.equal(IMAGE_VERSION, "ht1");
  assert.ok(!LEGACY_IMAGE_VERSIONS.includes(IMAGE_VERSION));
  // Links minted before versioning (no r) and under the previous holographic design (r=holo2) and the previous retro design (r=pet1) still resolve.
  for (const ok of [null, "ht1", "pet3", "pet2", "pet1", "holo2"]) assert.ok(isAcceptedVersion(ok), String(ok));
  for (const bad of ["", "holo3", "PET2", "ht1&x=1", "../ht1", "ht2"]) assert.ok(!isAcceptedVersion(bad), bad);
  // Only the current design is cached forever; legacy and unversioned URLs revalidate.
  assert.match(imageCacheControl("ht1"), /immutable/);
  for (const old of [null, "pet3", "pet2", "pet1", "holo2"]) assert.doesNotMatch(imageCacheControl(old), /immutable/);
  // The token itself is untouched by the redesign.
  const snap = all().find((s) => s.c === "summary")!;
  assert.match(buildShareLink(snap, SECRET).path, /^\/s\/[\w-]+\.[\w-]+$/);
});

test("the connected workspace's name is on the private recap but never in a share snapshot, token, text or image copy", () => {
  const r = recap();
  assert.equal(r.workspace, "Acme");
  assert.equal(recap({ workspace: null }).workspace, null);
  for (const snap of all(r)) {
    assert.ok(!JSON.stringify(snap).includes("Acme"), `${snap.c} snapshot`);
    assert.ok(!encodeSnapshot(snap, SECRET).includes("Acme"));
    assert.ok(!JSON.stringify(describe(snap)).includes("Acme"), `${snap.c} copy`);
    assert.ok(!shareText(snap).includes("Acme"), `${snap.c} share text`);
  }
});
