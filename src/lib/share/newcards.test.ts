import assert from "node:assert/strict";
import { test } from "node:test";
import { toRecap, type CardId, type Recap } from "../recap.ts";
import { computeStats, type IssueNode } from "../stats/compute.ts";
import { describe, disclosure, shareText } from "./copy.ts";
import { buildShareLink } from "./link.ts";
import {
  MAX_STARS, MAX_STAR_NAME, MAX_TITLE, MAX_TOKEN_LENGTH, buildSnapshot, decodeToken, encodeSnapshot, parseSnapshot, type Snapshot,
} from "./snapshot.ts";
import { shareMetadata } from "./meta.ts";
import { constellationLayout, constellationLinks } from "./art.ts";

const SECRET = "test-secret";
const NEW: CardId[] = ["comeback", "scope", "constellation", "signature", "photo-finish"];
const me = { id: "u-secret", name: "me", displayName: "Me", avatarUrl: null };
let n = 0;
const issue = (completedAt: string, project: string | null, labels: string[], title = "Ship the thing"): IssueNode =>
  ({
    id: `id-secret-${n++}`,
    title,
    completedAt,
    project: project && { id: `pid-${project}`, name: project },
    labels: { nodes: labels.map((l) => ({ id: `lid-${l}`, name: l })) },
    creator: me,
    assignee: me,
  }) as IssueNode;

const many = (date: string, count: number, project: string | null, labels: string[], title?: string) => Array.from({ length: count }, () => issue(`${date}T12:00:00Z`, project, labels, title));

/** A year with a quiet stretch + comeback, two quarters of data, and a standout project+label pair. */
function recap(over: Partial<Recap> = {}, now = "2027-01-02T00:00:00Z"): Recap {
  const items = [
    ...many("2026-01-10", 6, "Apollo", ["bug"]),
    ...many("2026-01-11", 6, "Zephyr", ["feature"]),
    ...many("2026-02-20", 6, "Apollo", ["bug"]),
    ...many("2026-10-05", 8, "Zephyr", ["feature"]),
    ...many("2026-10-06", 2, "Apollo", ["feature"]),
    ...many("2026-10-07", 2, null, []),
    issue("2026-12-31T23:41:00Z", "Zephyr", ["feature"], "Final polish"),
  ];
  const stats = computeStats({
    year: 2026,
    now: new Date(now),
    viewer: { ...me, timezone: "UTC", organization: "Acme" } as never,
    assignedCompleted: items,
    createdCompleted: [],
    openAssigned: [],
    integrations: { status: "ok", services: [] },
    truncated: false,
  } as never);
  return { ...toRecap(stats), ...over };
}

const snaps = (r = recap()) => NEW.map((c) => buildSnapshot(c, r));
const find = (c: CardId, r = recap()) => buildSnapshot(c, r);

test("each new card produces a real, bounded snapshot from the fixture", () => {
  const r = recap();
  assert.equal(r.comeback.status, "ok");
  assert.equal(r.scope.status, "ok");
  assert.equal(r.signature.status, "ok");
  for (const s of snaps(r)) {
    const token = encodeSnapshot(s, SECRET);
    assert.ok(token.length < MAX_TOKEN_LENGTH, s.c);
    assert.deepEqual(decodeToken(token, SECRET), s, s.c);
    assert.ok(describe(s).alt.length > 20);
    assert.ok(shareText(s).length <= 200);
  }
  const photo = find("photo-finish");
  assert.deepEqual(photo.c === "photo-finish" && photo.o, { t: "Final polish", d: "2026-12-31", h: "23:41", g: 0 });
});

test("snapshots hold only what each card shows: no ids, other cards' names or raw timestamps", () => {
  const blobFor = (c: CardId) => {
    const s = find(c);
    const link = buildShareLink(s, SECRET);
    return JSON.stringify(s) + JSON.stringify(link) + describe(s).alt + shareText(s) + JSON.stringify(disclosure(s));
  };
  for (const c of NEW) {
    const blob = blobFor(c);
    for (const banned of ["u-secret", "id-secret", "pid-", "lid-", "https://", "T12:00:00", "timestamps", "Acme"]) assert.ok(!blob.includes(banned), `${c} leaked ${banned}`);
  }
  // Names appear only on the cards that deliberately show them.
  assert.ok(!blobFor("comeback").includes("Apollo") && !blobFor("comeback").includes("bug") && !blobFor("comeback").includes("Final polish"));
  assert.ok(!blobFor("scope").includes("Apollo") && !blobFor("scope").includes("feature") && !blobFor("scope").includes("Final polish"));
  assert.ok(blobFor("constellation").includes("Apollo") && !blobFor("constellation").includes("feature") && !blobFor("constellation").includes("Final polish"));
  assert.ok(blobFor("signature").includes("Apollo") && !blobFor("signature").includes("Final polish"));
  assert.ok(blobFor("photo-finish").includes("Final polish") && !blobFor("photo-finish").includes("Apollo"));
});

test("the summary card is untouched and stays last", () => {
  const s = find("summary");
  assert.deepEqual(Object.keys(s).sort(), ["a", "c", "d", "m", "n", "s", "u", "v", "y"]);
  const json = JSON.stringify(s);
  for (const name of ["Apollo", "Zephyr", "feature", "Final polish"]) assert.ok(!json.includes(name));
});

test("disclosures: names are flagged sensitive, shape-only cards are not", () => {
  const sens = (c: CardId, r = recap()) => disclosure(buildSnapshot(c, r)).sensitive;
  assert.equal(sens("comeback"), false);
  assert.equal(sens("scope"), false);
  assert.equal(sens("constellation"), true);
  assert.equal(sens("signature"), true);
  assert.equal(sens("photo-finish"), true);
  assert.ok(disclosure(find("photo-finish")).items.join().includes("Final polish"));
  assert.ok(disclosure(find("scope")).items.join().includes("No project or label names"));
  // Without a title or without data, nothing sensitive is revealed.
  const noTitle = recap({ photoFinish: { title: null, date: "2026-05-05", time: "09:30", daysBeforeYearEnd: null } });
  assert.equal(sens("photo-finish", noTitle), false);
  assert.equal(sens("constellation", recap({ constellation: { stars: [], totalProjects: 0, withoutProject: 4 } })), false);
});

test("unavailable cards stay shareable and say so without inventing numbers", () => {
  const empty = recap({
    comeback: { status: "unavailable", reason: "no-quiet-stretch" },
    scope: { status: "unavailable", quarterClosed: [0, 0, 0, 0] },
    constellation: { stars: [], totalProjects: 0, withoutProject: 0 },
    signature: { status: "unavailable", eligible: 0, excluded: 0 },
    photoFinish: null,
  });
  for (const s of snaps(empty)) {
    assert.deepEqual(decodeToken(encodeSnapshot(s, SECRET), SECRET), s);
    const c = describe(s);
    assert.ok(!c.big && !c.stars && !c.rail && !c.bars, s.c);
    assert.ok(c.headline.length > 0);
  }
  assert.match(describe(find("comeback", empty)).footnote ?? "", /14\+ days/);
});

test("copy states the metric rules and limits honestly", () => {
  const comeback = describe(find("comeback"));
  assert.match(comeback.footnote ?? "", /not time off/);
  assert.match(describe(find("scope")).footnote ?? "", /as they are on issues now/);
  assert.match(describe(find("signature")).footnote ?? "", /my own closed work/);
  assert.doesNotMatch(JSON.stringify(describe(find("signature"))), /unique|only you|nobody else/i);
  const inProgress = recap({ photoFinish: { title: "X", date: "2026-10-02", time: "09:00", daysBeforeYearEnd: null } });
  assert.match(describe(buildSnapshot("photo-finish", inProgress)).body ?? "", /isn't over yet/);
  assert.match(shareText(buildSnapshot("photo-finish", inProgress)), /so far/);
});

test("scope and comeback copy reflect the computed values", () => {
  const sc = find("scope");
  assert.ok(sc.c === "scope" && sc.z);
  const copy = describe(sc);
  assert.equal(copy.bars?.values.length, 4);
  assert.ok(copy.pills?.some((p) => /^Projects: \d+% shift$/.test(p)));
  const cb = describe(find("comeback"));
  assert.ok(cb.big && Number(cb.big) >= 5);
  assert.equal(cb.rail?.length, 2);
  assert.ok(cb.rail!.every((x) => x.from >= 0 && x.to <= 1 && x.from <= x.to));
});

test("constellation share caps stars and name length, keeping the token small", () => {
  const stars = Array.from({ length: 12 }, (_, i) => ({ name: "😀".repeat(60) + i, closedCount: 100 - i }));
  const s = buildSnapshot("constellation", recap({ constellation: { stars, totalProjects: 30, withoutProject: 7 } }));
  assert.ok(s.c === "constellation");
  if (s.c !== "constellation") return;
  assert.equal(s.s.length, MAX_STARS);
  assert.ok(s.s.every((x) => [...x.n].length <= MAX_STAR_NAME));
  assert.equal(s.t, 30);
  const token = encodeSnapshot(s, SECRET);
  assert.ok(token.length < MAX_TOKEN_LENGTH, String(token.length));
  assert.ok(`/s/${token}`.length < 1100);
});

test("worst-case tokens for the new cards stay under the cap", () => {
  const long = (k: number) => "😀".repeat(k);
  const worst: Snapshot[] = [
    { v: 1, y: 2026, c: "signature", m: { p: long(40), l: long(40), k: 9_999_999, a: 100, b: 100, x: 1_000_000 } },
    { v: 1, y: 2026, c: "photo-finish", o: { t: long(MAX_TITLE), d: "2026-12-31", h: "23:59", g: 365 } },
    { v: 1, y: 2026, c: "comeback", m: { q: 366, a: "2026-01-02", z: "2026-12-30", r: "2026-12-31", k: 9_999_999, w: 7 } },
    { v: 1, y: 2026, c: "scope", z: { f: 1, t: 4, p: 100, l: 100, q: Array(4).fill(9_999_999) } },
    { v: 1, y: 2026, c: "constellation", s: Array.from({ length: MAX_STARS }, () => ({ n: long(MAX_STAR_NAME), k: 9_999_999 })), t: 9_999_999, o: 9_999_999 },
  ];
  for (const s of worst) {
    const token = encodeSnapshot(s, SECRET);
    assert.ok(token.length < MAX_TOKEN_LENGTH, `${s.c} ${token.length}`);
    assert.deepEqual(decodeToken(token, SECRET), s);
  }
});

test("validator rejects malformed new-card snapshots", () => {
  const base = { v: 1, y: 2026 };
  const okComeback = { q: 20, a: "2026-03-01", z: "2026-03-20", r: "2026-03-21", k: 6, w: 7 };
  const okScope = { f: 1, t: 4, p: 10, l: 20, q: [5, 0, 0, 5] };
  const okSig = { p: "A", l: "b", k: 3, a: 50, b: 20, x: 25 };
  const okPhoto = { t: "x", d: "2026-05-05", h: "09:30", g: null };
  const good = [
    { ...base, c: "comeback", m: okComeback }, { ...base, c: "comeback", m: null },
    { ...base, c: "scope", z: okScope }, { ...base, c: "scope", z: null },
    { ...base, c: "constellation", s: [{ n: "A", k: 3 }], t: 1, o: 0 },
    { ...base, c: "signature", m: okSig }, { ...base, c: "signature", m: null },
    { ...base, c: "photo-finish", o: okPhoto }, { ...base, c: "photo-finish", o: { ...okPhoto, t: null, g: 0 } }, { ...base, c: "photo-finish", o: null },
  ];
  for (const g of good) assert.ok(parseSnapshot(g), JSON.stringify(g).slice(0, 60));
  const bad: unknown[] = [
    { ...base, c: "comeback", m: { ...okComeback, q: 13 } },
    { ...base, c: "comeback", m: { ...okComeback, k: 4 } },
    { ...base, c: "comeback", m: { ...okComeback, w: 8 } },
    { ...base, c: "comeback", m: { ...okComeback, w: 0 } },
    { ...base, c: "comeback", m: { ...okComeback, r: "2026-03-20" } },
    { ...base, c: "comeback", m: { ...okComeback, a: "2026-03-25" } },
    { ...base, c: "comeback", m: { ...okComeback, a: "2026-02-31x" } },
    { ...base, c: "comeback", m: { ...okComeback, extra: 1 } },
    { ...base, c: "comeback" },
    { ...base, c: "scope", z: { ...okScope, f: 4, t: 1 } },
    { ...base, c: "scope", z: { ...okScope, f: 2, t: 2 } },
    { ...base, c: "scope", z: { ...okScope, p: 101 } },
    { ...base, c: "scope", z: { ...okScope, q: [1, 2, 3] } },
    { ...base, c: "scope", z: { ...okScope, q: [1, 2, 3, -1] } },
    { ...base, c: "constellation", s: Array.from({ length: MAX_STARS + 1 }, () => ({ n: "A", k: 1 })), t: 99, o: 0 },
    { ...base, c: "constellation", s: [{ n: "A", k: 1 }], t: 0, o: 0 },
    { ...base, c: "constellation", s: [{ n: "A".repeat(MAX_STAR_NAME + 1), k: 1 }], t: 1, o: 0 },
    { ...base, c: "constellation", s: [null], t: 1, o: 0 },
    { ...base, c: "constellation", s: [{ n: "bad‮", k: 1 }], t: 1, o: 0 },
    { ...base, c: "signature", m: { ...okSig, k: 2 } },
    { ...base, c: "signature", m: { ...okSig, a: 101 } },
    { ...base, c: "signature", m: { ...okSig, x: 9 } },
    { ...base, c: "signature", m: { ...okSig, p: "" } },
    { ...base, c: "signature", m: { ...okSig, l: "a".repeat(41) } },
    { ...base, c: "photo-finish", o: { ...okPhoto, h: "24:00" } },
    { ...base, c: "photo-finish", o: { ...okPhoto, h: "9:30" } },
    { ...base, c: "photo-finish", o: { ...okPhoto, g: 366 } },
    { ...base, c: "photo-finish", o: { ...okPhoto, t: "x".repeat(MAX_TITLE + 1) } },
    { ...base, c: "photo-finish", o: { ...okPhoto, t: "" } },
    { ...base, c: "photo-finish", o: { ...okPhoto, url: "https://x" } },
  ];
  for (const b of bad) assert.equal(parseSnapshot(b), null, JSON.stringify(b)?.slice(0, 70));
});

test("tampering with a new-card token is rejected", () => {
  const s = find("signature");
  const token = encodeSnapshot(s, SECRET);
  const [, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...s, m: { ...(s as { m: object }).m, p: "Evil" } })).toString("base64url");
  assert.equal(decodeToken(`${forged}.${sig}`, SECRET), null);
  assert.equal(decodeToken(token, "other"), null);
});

test("share links for new cards are versioned and correctly named", () => {
  for (const s of snaps()) {
    const link = buildShareLink(s, SECRET);
    assert.match(link.storyImagePath, /\/image\?f=story&r=[a-z0-9]+$/);
    assert.match(link.wideImagePath, /\/image\?f=og&r=[a-z0-9]+$/);
    assert.equal(link.filename, `linear-wrapped-2026-${s.c}`);
    assert.ok(link.reveals.length > 0);
  }
});

test("public page metadata for a new card is built only from the verified snapshot", () => {
  const token = encodeSnapshot(find("comeback"), SECRET);
  const meta = shareMetadata(token, SECRET, "https://example.test");
  assert.match(String(meta.title), /The Comeback/);
  assert.match(JSON.stringify(meta.openGraph), /image\?f=og&r=/);
  assert.equal(shareMetadata(`${token}x`, SECRET, "https://example.test").title, "Link not found");
});

test("constellation layout is deterministic, area-proportional and inside the box", () => {
  const values = [40, 20, 10, 10, 5, 1];
  const a = constellationLayout(values);
  assert.deepEqual(a, constellationLayout(values));
  for (const s of a) {
    assert.ok(s.x > 0.05 && s.x < 0.95 && s.y > 0.05 && s.y < 0.95, JSON.stringify(s));
  }
  assert.ok(a[0].r > a[1].r && a[1].r > a[2].r && a[2].r === a[3].r && a[4].r > a[5].r);
  assert.equal(constellationLinks(a).length, values.length - 1);
  assert.deepEqual(constellationLayout([]), []);
});

test("new share images render at 1080x1920 and 1200x630, including text-heavy and empty states", { timeout: 120_000 }, async () => {
  const { ImageResponse } = await import("next/og.js");
  const { renderCard } = await import("./image.ts");
  const { IMAGE_FORMATS } = await import("./theme.ts");
  const long = recap({
    constellation: { stars: Array.from({ length: 5 }, (_, i) => ({ name: "W".repeat(24), closedCount: 50 - i })), totalProjects: 9, withoutProject: 3 },
    photoFinish: { title: "日本語のタイトル 😀 ".repeat(6), date: "2026-12-31", time: "23:59", daysBeforeYearEnd: 0 },
  });
  const empty = recap({
    comeback: { status: "unavailable", reason: "no-burst" },
    scope: { status: "unavailable", quarterClosed: [0, 0, 0, 0] },
    constellation: { stars: [], totalProjects: 0, withoutProject: 0 },
    signature: { status: "unavailable", eligible: 0, excluded: 0 },
    photoFinish: null,
  });
  const all = [...snaps(), ...snaps(long), ...snaps(empty)];
  const realFetch = globalThis.fetch;
  const remote: string[] = [];
  globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("file:") || url.startsWith("data:")) return realFetch(input, init);
    remote.push(url);
    return Promise.reject(new Error("network disabled in test"));
  }) as typeof fetch;
  try {
    for (const snap of all) {
      for (const format of ["story", "og"] as const) {
        const res = new ImageResponse(renderCard(snap, format), IMAGE_FORMATS[format]);
        assert.equal(res.headers.get("content-type"), "image/png");
        const v = new DataView(await res.arrayBuffer());
        assert.deepEqual({ width: v.getUint32(16), height: v.getUint32(20) }, IMAGE_FORMATS[format], `${snap.c} ${format}`);
      }
    }
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(remote, []);
});
