import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import type { CardId, Recap } from "../recap.ts";
import { CARD_IDS } from "../recap.ts";
import { COMEBACK_RULES, SIGNATURE_RULES, type ArchetypeId } from "../stats/types.ts";

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
/** Star names are shorter and capped in number so a constellation token stays small (see MAX_TOKEN_LENGTH). */
export const MAX_STAR_NAME = 24;
export const MAX_STARS = 5;
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
  /** m = quiet stretch (q days from a to z), return day r, k issues closed in the w days from r. Local dates, no names. */
  | { c: "comeback"; m: { q: number; a: string; z: string; r: string; k: number; w: number } | null }
  /** z = quarterly mix: f/t first and last compared quarter (1-4), p/l project and label shift in %, q closed per quarter. No names. */
  | { c: "scope"; z: { f: number; t: number; p: number; l: number; q: number[] } | null }
  /** s = up to 5 biggest projects, t = projects with closed issues, o = closed issues without a project. */
  | { c: "constellation"; s: Named[]; t: number; o: number }
  /** p project, l label, k issues with both, a = % of that label's issues in the project, b = % of all labelled project issues in it, x = lift in tenths. */
  | { c: "signature"; m: { p: string; l: string; k: number; a: number; b: number; x: number } | null }
  /** t issue title (no id/link) or null, d local date, h local HH:MM, g days before Dec 31 (null while the year is in progress). */
  | { c: "photo-finish"; o: { t: string | null; d: string; h: string; g: number | null } | null }
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

const named = (name: string, count: number, max = MAX_NAME): Named | null => {
  const n = cleanText(name, max);
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
    case "comeback": {
      const m = r.comeback;
      return {
        ...base,
        c: "comeback",
        m: m.status === "ok" ? { q: m.quietDays, a: m.quietStart, z: m.quietEnd, r: m.returnDate, k: m.burstCount, w: m.burstDays } : null,
      };
    }
    case "scope": {
      const m = r.scope;
      return {
        ...base,
        c: "scope",
        z: m.status === "ok" ? { f: m.fromQuarter, t: m.toQuarter, p: m.projectShiftPercent, l: m.labelShiftPercent, q: [...m.quarterClosed] } : null,
      };
    }
    case "constellation": {
      const s = r.constellation.stars.flatMap((x) => named(x.name, x.closedCount, MAX_STAR_NAME) ?? []).slice(0, MAX_STARS);
      return { ...base, c: "constellation", s, t: Math.max(r.constellation.totalProjects, s.length), o: r.constellation.withoutProject };
    }
    case "signature": {
      const m = r.signature;
      const p = m.status === "ok" ? cleanText(m.project, MAX_NAME) : "";
      const l = m.status === "ok" ? cleanText(m.label, MAX_NAME) : "";
      return {
        ...base,
        c: "signature",
        m: m.status === "ok" && p && l ? { p, l, k: m.pairCount, a: m.labelInProjectPercent, b: m.projectSharePercent, x: Math.round(m.lift * 10) } : null,
      };
    }
    case "photo-finish": {
      const f = r.photoFinish;
      const t = f?.title ? cleanText(f.title, MAX_TITLE) : "";
      return { ...base, c: "photo-finish", o: f && { t: t || null, d: f.date, h: f.time, g: f.daysBeforeYearEnd } };
    }
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

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseNamed(v: unknown, max = MAX_NAME): Named | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !exactKeys(v, ["n", "k"]) || !isClean(v.n, max) || !count(v.k)) return undefined;
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
    case "comeback": {
      if (!keys("m")) return null;
      const m = input.m;
      if (m === null) return { ...base, c: "comeback", m: null };
      if (!isRec(m) || !exactKeys(m, ["q", "a", "z", "r", "k", "w"])) return null;
      if (!int(m.q, COMEBACK_RULES.quietMinDays, 366) || !isDate(m.a) || !isDate(m.z) || !isDate(m.r) || !(m.a <= m.z && m.z < m.r)) return null;
      if (!int(m.k, COMEBACK_RULES.burstMinIssues, MAX_COUNT) || !int(m.w, 1, COMEBACK_RULES.burstWindowDays)) return null;
      return { ...base, c: "comeback", m: { q: m.q, a: m.a, z: m.z, r: m.r, k: m.k, w: m.w } };
    }
    case "scope": {
      if (!keys("z")) return null;
      const z = input.z;
      if (z === null) return { ...base, c: "scope", z: null };
      if (!isRec(z) || !exactKeys(z, ["f", "t", "p", "l", "q"]) || !int(z.f, 1, 4) || !int(z.t, 1, 4) || z.f >= z.t) return null;
      if (!int(z.p, 0, 100) || !int(z.l, 0, 100) || !Array.isArray(z.q) || z.q.length !== 4 || !z.q.every(count)) return null;
      return { ...base, c: "scope", z: { f: z.f, t: z.t, p: z.p, l: z.l, q: [...(z.q as number[])] } };
    }
    case "constellation": {
      if (!keys("s", "t", "o") || !Array.isArray(input.s) || input.s.length > MAX_STARS || !count(input.t) || !count(input.o)) return null;
      const stars = input.s.map((x) => parseNamed(x, MAX_STAR_NAME));
      if (stars.some((x) => !x) || input.t < stars.length) return null;
      return { ...base, c: "constellation", s: stars as Named[], t: input.t, o: input.o };
    }
    case "signature": {
      if (!keys("m")) return null;
      const m = input.m;
      if (m === null) return { ...base, c: "signature", m: null };
      if (!isRec(m) || !exactKeys(m, ["p", "l", "k", "a", "b", "x"]) || !isClean(m.p, MAX_NAME) || !isClean(m.l, MAX_NAME)) return null;
      if (!int(m.k, SIGNATURE_RULES.minPairIssues, MAX_COUNT) || !int(m.a, 0, 100) || !int(m.b, 0, 100) || !int(m.x, 10, 1_000_000)) return null;
      return { ...base, c: "signature", m: { p: m.p, l: m.l, k: m.k, a: m.a, b: m.b, x: m.x } };
    }
    case "photo-finish": {
      if (!keys("o")) return null;
      const o = input.o;
      if (o === null) return { ...base, c: "photo-finish", o: null };
      if (!isRec(o) || !exactKeys(o, ["t", "d", "h", "g"]) || !isDate(o.d) || typeof o.h !== "string" || !TIME.test(o.h)) return null;
      if (o.t !== null && !isClean(o.t, MAX_TITLE)) return null;
      if (o.g !== null && !int(o.g, 0, 365)) return null;
      return { ...base, c: "photo-finish", o: { t: o.t as string | null, d: o.d, h: o.h, g: o.g as number | null } };
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
