import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import type { CardId, Recap } from "../recap.ts";
import { CARD_IDS } from "../recap.ts";
import type { ArchetypeId } from "../stats/types.ts";

/**
 * Stateless sharing: a share link IS a signed, bounded snapshot of ONE card's
 * data. Nothing is stored server-side. The snapshot is built on the server from
 * the viewer's own recap, contains only what that card displays (never the whole
 * recap, ids, URLs, avatars, timestamps or tokens) and is validated strictly on
 * every read, so a link can only ever say what this app itself minted.
 *
 * Token format: `base64url(JSON) "." base64url(hmac16)`.
 */

/** Whole token (URL path segment) is capped here: the worst case is ~600 chars, so `/s/<token>` stays far below the ~2,000-char URL limit browsers, CDNs and chat apps handle safely. */
export const MAX_TOKEN_LENGTH = 1024;
export const MAX_NAME = 40;
export const MAX_TITLE = 80;
export const MAX_SERVICES = 8;
const MAX_SERVICE = 24;
const MAX_COUNT = 10_000_000;
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2200;

const ARCHETYPES: readonly ArchetypeId[] = ["night-owl", "early-bird", "friday-shipper", "weekend-warrior", "steady-builder"];

export interface Named {
  n: string;
  k: number;
}

export type SnapshotBody =
  | { c: "intro" }
  /** n closed, d active days, u = counts may be undercounts (fetch cap hit). */
  | { c: "total"; n: number; d: number; u: boolean }
  /** a archetype id, i = too little data (default archetype). */
  | { c: "archetype"; a: ArchetypeId; i: boolean }
  /** b = 12 monthly counts, m = peak month (1-12) or null. */
  | { c: "peak"; b: number[]; m: number | null }
  /** s = streak length and local start/end dates (YYYY-MM-DD). */
  | { c: "streak"; s: { n: number; a: string; z: string } | null }
  | { c: "project"; p: Named | null }
  | { c: "collaborator"; p: Named | null }
  /** s null = not readable; l = up to 8 service names, t = total count. */
  | { c: "integrations"; s: { l: string[]; t: number } | null }
  /** t issue title (no id/link), d days open. */
  | { c: "got-away"; o: { t: string; d: number } | null }
  | { c: "label"; l: Named | null }
  /** Counts and archetype only: no project, collaborator, label or issue names. */
  | { c: "summary"; n: number; d: number; a: ArchetypeId; m: number | null; s: number | null; u: boolean };

export type Snapshot = { v: 1; y: number } & SnapshotBody;

// ---------- text hygiene ----------

/** Control, format (incl. bidi overrides, zero-width) and unassigned code points. */
const UNSAFE = /[\p{C}\p{Zl}\p{Zp}]/gu;

/** Single-line, printable, trimmed, truncated to `max` code points. */
export function cleanText(input: string, max: number): string {
  const flat = input.replace(UNSAFE, " ").replace(/\s+/g, " ").trim();
  const chars = [...flat];
  return chars.length <= max ? flat : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

const isClean = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && [...v].length <= max && cleanText(v, max) === v;

// ---------- building (server-side, from the safe Recap) ----------

const named = (name: string, count: number): Named | null => {
  const n = cleanText(name, MAX_NAME);
  return n ? { n, k: count } : null;
};

export function buildSnapshot(card: CardId, r: Recap): Snapshot {
  const base = { v: 1 as const, y: r.year };
  switch (card) {
    case "intro":
      return { ...base, c: "intro" };
    case "total":
      return { ...base, c: "total", n: r.totalClosed, d: r.activeDays, u: r.truncated };
    case "archetype":
      return { ...base, c: "archetype", a: r.archetype.id, i: r.archetype.insufficientData };
    case "peak":
      return { ...base, c: "peak", b: r.monthly.map((m) => m.count), m: r.peakMonth?.month ?? null };
    case "streak":
      return { ...base, c: "streak", s: r.longestStreak && { n: r.longestStreak.days, a: r.longestStreak.start, z: r.longestStreak.end } };
    case "project":
      return { ...base, c: "project", p: r.biggestProject && named(r.biggestProject.name, r.biggestProject.closedCount) };
    case "collaborator":
      return { ...base, c: "collaborator", p: r.topCollaborator && named(r.topCollaborator.name, r.topCollaborator.sharedIssues) };
    case "integrations": {
      if (r.integrations.status !== "ok") return { ...base, c: "integrations", s: null };
      const l = r.integrations.services.filter((s) => SERVICE.test(s)).slice(0, MAX_SERVICES);
      return { ...base, c: "integrations", s: { l, t: r.integrations.services.length } };
    }
    case "got-away": {
      const t = r.oldestOpenIssue ? cleanText(r.oldestOpenIssue.title, MAX_TITLE) : "";
      return { ...base, c: "got-away", o: r.oldestOpenIssue && t ? { t, d: r.oldestOpenIssue.ageDays } : null };
    }
    case "label":
      return { ...base, c: "label", l: r.labelOfYear && named(r.labelOfYear.name, r.labelOfYear.count) };
    case "summary":
      return {
        ...base,
        c: "summary",
        n: r.totalClosed,
        d: r.activeDays,
        a: r.archetype.id,
        m: r.peakMonth?.month ?? null,
        s: r.longestStreak?.days ?? null,
        u: r.truncated,
      };
  }
}

// ---------- validation (untrusted input) ----------

const SERVICE = new RegExp(`^[A-Za-z0-9][A-Za-z0-9_-]{0,${MAX_SERVICE - 1}}$`);
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const exactKeys = (o: Rec, keys: string[]) => {
  const have = Object.keys(o);
  return have.length === keys.length && keys.every((k) => Object.hasOwn(o, k));
};
const int = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const count = (v: unknown): v is number => int(v, 0, MAX_COUNT);
const month = (v: unknown): v is number => int(v, 1, 12);
const isDate = (v: unknown): v is string => {
  const m = typeof v === "string" ? DATE.exec(v) : null;
  return !!m && int(Number(m[2]), 1, 12) && int(Number(m[3]), 1, 31);
};
const archetype = (v: unknown): v is ArchetypeId => typeof v === "string" && (ARCHETYPES as readonly string[]).includes(v);

function parseNamed(v: unknown): Named | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !exactKeys(v, ["n", "k"]) || !isClean(v.n, MAX_NAME) || !count(v.k)) return undefined;
  return { n: v.n, k: v.k };
}

/** Returns a freshly built, fully validated snapshot, or null. Never trusts or retains extra keys. */
export function parseSnapshot(input: unknown): Snapshot | null {
  if (!isRec(input) || input.v !== 1 || !int(input.y, MIN_YEAR, MAX_YEAR) || typeof input.c !== "string") return null;
  const base = { v: 1 as const, y: input.y };
  const keys = (...k: string[]) => exactKeys(input, ["v", "y", "c", ...k]);

  switch (input.c as CardId) {
    case "intro":
      return keys() ? { ...base, c: "intro" } : null;
    case "total":
      return keys("n", "d", "u") && count(input.n) && int(input.d, 0, 366) && typeof input.u === "boolean"
        ? { ...base, c: "total", n: input.n, d: input.d, u: input.u }
        : null;
    case "archetype":
      return keys("a", "i") && archetype(input.a) && typeof input.i === "boolean" ? { ...base, c: "archetype", a: input.a, i: input.i } : null;
    case "peak": {
      if (!keys("b", "m") || !Array.isArray(input.b) || input.b.length !== 12 || !input.b.every(count)) return null;
      if (input.m !== null && !month(input.m)) return null;
      return { ...base, c: "peak", b: [...(input.b as number[])], m: input.m as number | null };
    }
    case "streak": {
      if (!keys("s")) return null;
      const s = input.s;
      if (s === null) return { ...base, c: "streak", s: null };
      if (!isRec(s) || !exactKeys(s, ["n", "a", "z"]) || !int(s.n, 1, 366) || !isDate(s.a) || !isDate(s.z) || s.a > s.z) return null;
      return { ...base, c: "streak", s: { n: s.n, a: s.a, z: s.z } };
    }
    case "project":
    case "collaborator": {
      const p = keys("p") ? parseNamed(input.p) : undefined;
      return p === undefined ? null : { ...base, c: input.c as "project" | "collaborator", p };
    }
    case "label": {
      const l = keys("l") ? parseNamed(input.l) : undefined;
      return l === undefined ? null : { ...base, c: "label", l };
    }
    case "integrations": {
      if (!keys("s")) return null;
      const s = input.s;
      if (s === null) return { ...base, c: "integrations", s: null };
      if (!isRec(s) || !exactKeys(s, ["l", "t"]) || !Array.isArray(s.l) || s.l.length > MAX_SERVICES) return null;
      if (!s.l.every((x) => typeof x === "string" && SERVICE.test(x)) || !count(s.t) || s.t < s.l.length) return null;
      return { ...base, c: "integrations", s: { l: [...(s.l as string[])], t: s.t } };
    }
    case "got-away": {
      if (!keys("o")) return null;
      const o = input.o;
      if (o === null) return { ...base, c: "got-away", o: null };
      if (!isRec(o) || !exactKeys(o, ["t", "d"]) || !isClean(o.t, MAX_TITLE) || !int(o.d, 0, 36_500)) return null;
      return { ...base, c: "got-away", o: { t: o.t, d: o.d } };
    }
    case "summary": {
      if (!keys("n", "d", "a", "m", "s", "u")) return null;
      const { n, d, a, m, s, u } = input;
      if (!count(n) || !int(d, 0, 366) || !archetype(a) || (m !== null && !month(m)) || (s !== null && !int(s, 1, 366)) || typeof u !== "boolean") return null;
      return { ...base, c: "summary", n, d, a, m: m as number | null, s: s as number | null, u };
    }
    default:
      return null;
  }
}

export const isCardId = (v: unknown): v is CardId => typeof v === "string" && (CARD_IDS as readonly string[]).includes(v);

// ---------- signing + token ----------

const TOKEN_RE = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{22})$/;

function sign(payload: string, secret: string): string {
  const key = Buffer.from(hkdfSync("sha256", secret, "linear-wrapped", "share-link", 32));
  return createHmac("sha256", key).update(payload).digest().subarray(0, 16).toString("base64url");
}

/** Signing keeps strangers from minting arbitrary "Linear Wrapped" cards on our domain. Rotating the secret invalidates old links. */
export function encodeSnapshot(snapshot: Snapshot, secret: string): string {
  const parsed = parseSnapshot(snapshot);
  if (!parsed) throw new Error("invalid snapshot");
  const payload = Buffer.from(JSON.stringify(parsed), "utf8").toString("base64url");
  const token = `${payload}.${sign(payload, secret)}`;
  if (token.length > MAX_TOKEN_LENGTH) throw new Error("snapshot too large");
  return token;
}

/** Length is checked before any decoding; signature before any JSON parsing. */
export function decodeToken(token: string, secret: string): Snapshot | null {
  if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) return null;
  const m = TOKEN_RE.exec(token);
  if (!m) return null;
  const expected = Buffer.from(sign(m[1], secret));
  const actual = Buffer.from(m[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    return parseSnapshot(JSON.parse(Buffer.from(m[1], "base64url").toString("utf8")));
  } catch {
    return null;
  }
}
