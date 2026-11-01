import { cloneElement, createElement as h, type CSSProperties, type ReactElement } from "react";
import { monthName } from "../recap.ts";
import { ARCHETYPE_COPY } from "../stats/archetype.ts";
import { constellation, daysInYear, ring, sigil, sparkles } from "./art.ts";
import { describe, type CardCopy } from "./copy.ts";
import type { Snapshot } from "./snapshot.ts";
import { CARD_ACCENTS, IMAGE_FORMATS, SURFACE, type ImageFormat } from "./theme.ts";

/**
 * Share image layout. Built with plain `createElement` (no JSX) so it can be
 * rendered in unit tests, and with the flex-only CSS subset Satori supports.
 * Only text from a validated snapshot goes in: no remote images or fonts are
 * fetched, so there is nothing for a crafted link to make us request.
 *
 * Look: near-black surface, one accent pair per card (shared with the story UI
 * via `CARD_ACCENTS`). The summary card is drawn as a static holographic
 * collectible: the same foil, glare and glints as the interactive card, frozen
 * at a flattering light angle.
 */

interface Scale {
  pad: number;
  kicker: number;
  big: number;
  headline: number;
  body: number;
  pill: number;
  foot: number;
  barHeight: number;
}

const SCALES: Record<ImageFormat, Scale> = {
  story: { pad: 96, kicker: 40, big: 400, headline: 170, body: 60, pill: 44, foot: 36, barHeight: 380 },
  og: { pad: 56, kicker: 24, big: 190, headline: 96, body: 32, pill: 26, foot: 22, barHeight: 150 },
};

/** Shrinks long strings (project names, issue titles) so they stay inside the frame. */
function fit(size: number, text: string, comfortable: number, min = 0.4): number {
  const len = [...text].length;
  return Math.round(size * (len <= comfortable ? 1 : Math.max(min, comfortable / len)));
}

/**
 * Satori fetches emoji (jsDelivr) and non-Latin fonts (Google Fonts) at render
 * time for characters the bundled Geist font lacks, which user-chosen names
 * could trigger. So images only draw characters Geist covers (Latin, common
 * punctuation); anything else becomes "?" here. The shared web page still
 * shows the full text.
 */
const SUPPORTED = new RegExp(
  "[\\u0020-\\u007E\\u00A0-\\u00AC\\u00AE-\\u00FF" + // Basic Latin, Latin-1
    "\\u0100-\\u012B\\u012E-\\u0137\\u0139-\\u013E\\u0141-\\u0148\\u014A-\\u014D\\u0150-\\u017E" + // Latin Extended-A (as covered by Geist)
    "\\u2013\\u2014\\u2018-\\u201E\\u2020-\\u2022\\u2026\\u2030\\u2032\\u2033\\u2039\\u203A\\u20AC]", // punctuation, euro
);
export const imageSafe = (s: string) => [...s].map((c) => (SUPPORTED.test(c) ? c : "?")).join("").replace(/\?{2,}/g, "?");

const text = (style: CSSProperties, children: string) => h("div", { style: { display: "flex", ...style } }, children);
const box = (style: CSSProperties, ...children: (ReactElement | null)[]) => h("div", { style: { display: "flex", ...style } }, ...children);
const keyed = (key: number, style: CSSProperties) => cloneElement(box(style), { key });
const fill: CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };

const FOIL = "linear-gradient(135deg, #67e8f9, #c4b5fd, #f0abfc, #fde68a, #86efac, #67e8f9)";

/** Two soft accent glows on the near-black surface. */
const atmosphere = (a: string, b: string, format: ImageFormat) =>
  format === "story"
    ? `radial-gradient(circle at 12% 8%, ${a}59, ${a}00 55%), radial-gradient(circle at 92% 94%, ${b}4d, ${b}00 55%)`
    : `radial-gradient(circle at 8% 0%, ${a}59, ${a}00 55%), radial-gradient(circle at 100% 100%, ${b}4d, ${b}00 55%)`;

export function renderCard(snapshot: Snapshot, format: ImageFormat): ReactElement {
  return snapshot.c === "summary" ? renderHolo(snapshot, format) : renderPlain(snapshot, format);
}

function renderPlain(snapshot: Snapshot, format: ImageFormat): ReactElement {
  const raw = describe(snapshot);
  const copy = {
    ...raw,
    kicker: imageSafe(raw.kicker),
    big: raw.big && imageSafe(raw.big),
    headline: imageSafe(raw.headline),
    body: raw.body && imageSafe(raw.body),
    footnote: raw.footnote && imageSafe(raw.footnote),
    pills: raw.pills?.map(imageSafe),
  };
  const { width, height } = IMAGE_FORMATS[format];
  const k = SCALES[format];
  const [a, b] = CARD_ACCENTS[snapshot.c];
  const story = format === "story";

  const bigSize = fit(copy.stars ? Math.round(k.big * 0.5) : k.big, copy.big ?? "", story ? 4 : 5);
  const headlineSize = fit(k.headline, copy.headline, story ? 10 : 18, 0.3);

  return h(
    "div",
    {
      style: {
        width,
        height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: k.pad,
        color: "#fff",
        backgroundColor: SURFACE,
        backgroundImage: atmosphere(a, b, format),
      },
    },
    box(
      { alignItems: "center", gap: k.kicker * 0.5 },
      box({ width: k.kicker * 0.4, height: k.kicker * 0.4, borderRadius: 999, backgroundColor: a }),
      text({ fontSize: k.kicker, letterSpacing: 7, textTransform: "uppercase", opacity: 0.7 }, `Linear Wrapped ${snapshot.y}`),
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: story ? 24 : 8 } },
      text({ fontSize: k.kicker, letterSpacing: 6, textTransform: "uppercase", color: a }, copy.kicker),
      copy.big ? text({ fontSize: bigSize, lineHeight: 0.9, letterSpacing: -Math.round(bigSize * 0.04), color: a }, copy.big) : null,
      text(
        { fontSize: headlineSize, lineHeight: 0.95, letterSpacing: -Math.round(headlineSize * 0.04), wordBreak: "break-word", color: copy.big ? "#fff" : a },
        copy.headline,
      ),
      copy.pills ? pills(copy.pills, k) : null,
      copy.body ? text({ fontSize: fit(k.body, copy.body, story ? 80 : 110, 0.6), lineHeight: 1.25, opacity: 0.8, maxWidth: story ? 800 : 1000 }, copy.body) : null,
      copy.bars ? bars(copy.bars, k, a, b) : null,
      copy.stars ? box({ alignSelf: "center" }, constellation(copy.stars, story ? 880 : 520, story ? 520 : 130, [a, b], "cn-share")) : null,
      copy.rail ? rail(copy.rail, k, a, b, story ? 888 : 1088) : null,
    ),
    text({ fontSize: k.foot, opacity: 0.55, lineHeight: 1.3 }, copy.footnote ?? "Get yours: Linear Wrapped"),
  );
}

function bars(bs: NonNullable<CardCopy["bars"]>, k: Scale, a: string, b: string) {
  const max = Math.max(...bs.values, 1);
  return h(
    "div",
    { style: { display: "flex", alignItems: "flex-end", gap: k.pad / 8, height: k.barHeight, marginTop: 16 } },
    ...bs.values.map((v, i) =>
      h("div", {
        key: i,
        style: {
          display: "flex",
          flex: 1,
          height: Math.max(Math.round((v / max) * k.barHeight), v > 0 ? 10 : 4),
          borderRadius: 12,
          backgroundImage: i === bs.highlight ? `linear-gradient(0deg, ${b}, ${a})` : "linear-gradient(0deg, rgba(255,255,255,0.10), rgba(255,255,255,0.28))",
        },
      }),
    ),
  );
}

/** A Jan-Dec line with quiet spans (dim), burst spans (accent) or a single marker. */
function rail(spans: NonNullable<CardCopy["rail"]>, k: Scale, a: string, b: string, width: number) {
  const bar = Math.max(10, Math.round(k.pill / 4));
  const tall = bar * 4;
  const px = (f: number) => Math.round(f * width);
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10, marginTop: 16 } },
    h(
      "div",
      { style: { display: "flex", position: "relative", width, height: tall } },
      box({ position: "absolute", left: 0, top: (tall - bar) / 2, width, height: bar, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)" }),
      ...spans.map((sp, i) =>
        sp.tone === "mark"
          ? cloneElement(
              box({ position: "absolute", left: Math.min(px(sp.from), width - tall), top: 0, width: tall, height: tall, borderRadius: 999, backgroundColor: "#fff", boxShadow: `0 0 ${tall}px ${a}` }),
              { key: i },
            )
          : cloneElement(
              box({
                position: "absolute",
                left: px(sp.from),
                top: sp.tone === "burst" ? 0 : (tall - bar) / 2,
                width: Math.max(px(sp.to - sp.from), bar),
                height: sp.tone === "burst" ? tall : bar,
                borderRadius: 999,
                ...(sp.tone === "burst"
                  ? { backgroundImage: `linear-gradient(90deg, ${a}, ${b})` }
                  : { border: "2px dashed rgba(255,255,255,0.45)" }),
              }),
              { key: i },
            ),
      ),
    ),
    box({ justifyContent: "space-between", width, fontSize: k.foot * 0.8, opacity: 0.5 }, text({}, "Jan"), text({}, "Dec")),
  );
}

function pills(items: string[], k: Scale) {
  return h(
    "div",
    { style: { display: "flex", flexWrap: "wrap", gap: k.pill / 3 } },
    ...items.map((p, i) =>
      h(
        "div",
        {
          key: i,
          style: {
            display: "flex",
            fontSize: k.pill,
            padding: `${k.pill / 5}px ${k.pill / 2}px`,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.22)",
            color: "#fff",
          },
        },
        p,
      ),
    ),
  );
}

// ---------- holographic summary ----------

type Summary = Extract<Snapshot, { c: "summary" }>;

function renderHolo(s: Summary, format: ImageFormat): ReactElement {
  const { width, height } = IMAGE_FORMATS[format];
  const [a, b] = CARD_ACCENTS.summary;
  const story = format === "story";
  const cardW = story ? 820 : 372;
  const card = holoCard(s, cardW);

  const root: CSSProperties = {
    width,
    height,
    display: "flex",
    color: "#fff",
    backgroundColor: SURFACE,
    backgroundImage: atmosphere(a, b, format),
  };

  if (story) {
    return box(
      { ...root, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 56 },
      text({ fontSize: 34, letterSpacing: 9, textTransform: "uppercase", opacity: 0.6 }, `Linear Wrapped ${s.y}`),
      card,
      text({ fontSize: 34, opacity: 0.5 }, s.u ? "Counts may be undercounts." : "Get yours: Linear Wrapped"),
    );
  }

  const k = SCALES.og;
  return box(
    { ...root, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: `0 ${k.pad + 24}px` },
    box({ transform: "rotate(-4deg)" }, card),
    box(
      { flexDirection: "column", gap: 12, width: 560 },
      text({ fontSize: k.kicker, letterSpacing: 6, textTransform: "uppercase", color: a }, `My ${s.y} in Linear`),
      text({ fontSize: fit(150, s.n.toLocaleString("en-US"), 5), lineHeight: 0.9, letterSpacing: -6, color: "#fff" }, s.n.toLocaleString("en-US")),
      text({ fontSize: 56, lineHeight: 1, letterSpacing: -2, color: b }, s.n === 1 ? "issue closed." : "issues closed."),
      text({ fontSize: 30, opacity: 0.7, marginTop: 8 }, `${ARCHETYPE_COPY[s.a].name}${s.s ? ` · ${s.s}-day streak` : ""}`),
      text({ fontSize: 22, opacity: 0.5, marginTop: 8 }, s.u ? "Counts may be undercounts." : "Get yours: Linear Wrapped"),
    ),
  );
}

/** The collectible itself, sized by width (5:7). Every dimension scales from `w`, so story and wide share one drawing. */
function holoCard(s: Summary, w: number): ReactElement {
  const u = w / 820;
  const px = (n: number) => Math.round(n * u);
  const hgt = Math.round((w * 7) / 5);
  const [a, b] = CARD_ACCENTS.summary;
  const archetype = ARCHETYPE_COPY[s.a];
  const rim = px(6);
  const innerW = w - rim * 2;
  const pad = px(54);
  const art = px(470);

  const glints = sparkles(22).map((g, i) => {
    const size = px(6 + g.s * 10);
    return keyed(i, {
      position: "absolute",
      left: Math.round(g.x * (innerW - size)),
      top: Math.round(g.y * (hgt - rim * 2 - size)),
      width: size,
      height: size,
      borderRadius: 999,
      opacity: g.o * 0.8,
      backgroundImage: "radial-gradient(circle, rgba(255,255,255,1), rgba(255,255,255,0) 70%)",
    });
  });
  // Four-point star glints on top of the dots.
  const stars = [
    { x: 0.2, y: 0.12 },
    { x: 0.82, y: 0.3 },
    { x: 0.7, y: 0.78 },
  ].map((g, i) => {
    const len = px(84 - i * 14);
    const thin = Math.max(2, px(3));
    const cx = g.x * innerW;
    const cy = g.y * (hgt - rim * 2);
    const line = (wd: number, ht: number) =>
      box({
        position: "absolute",
        left: Math.round(cx - wd / 2),
        top: Math.round(cy - ht / 2),
        width: wd,
        height: ht,
        backgroundImage: `linear-gradient(${wd > ht ? 90 : 0}deg, rgba(255,255,255,0), rgba(255,255,255,0.95), rgba(255,255,255,0))`,
      });
    return cloneElement(box({ ...fill }, line(len, thin), line(thin, len)), { key: `s${i}` });
  });

  const stat = (label: string, value: string, sub?: string) =>
    box(
      {
        flexDirection: "column",
        flex: 1,
        gap: px(4),
        padding: `${px(16)}px ${px(18)}px`,
        borderRadius: px(22),
        backgroundColor: "rgba(255,255,255,0.07)",
        border: `${Math.max(1, px(2))}px solid rgba(255,255,255,0.2)`,
      },
      text({ fontSize: px(19), letterSpacing: px(3), textTransform: "uppercase", opacity: 0.65 }, label),
      text({ fontSize: px(52), letterSpacing: -px(2), lineHeight: 1 }, value),
      text({ fontSize: px(20), opacity: 0.6, height: px(24) }, sub ?? ""),
    );

  const face = box(
    {
      width: innerW,
      height: hgt - rim * 2,
      borderRadius: px(38),
      position: "relative",
      overflow: "hidden",
      flexDirection: "column",
      backgroundImage: "linear-gradient(160deg, #181a26, #0b0c13 55%, #14101f)",
    },
    // Foil: iridescent bands, diffraction lines, specular glare and an edge vignette.
    box({
      ...fill,
      backgroundImage:
        "linear-gradient(115deg, rgba(103,232,249,0) 6%, rgba(103,232,249,0.62) 20%, rgba(196,181,253,0.68) 33%, rgba(240,171,252,0.62) 46%, rgba(253,230,138,0.52) 58%, rgba(134,239,172,0.52) 70%, rgba(103,232,249,0) 86%)",
    }),
    box({ ...fill, opacity: 0.55, backgroundImage: "repeating-linear-gradient(115deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 2px, rgba(255,255,255,0) 2px, rgba(255,255,255,0) 11px)" }),
    box({ ...fill, backgroundImage: "radial-gradient(circle at 26% 16%, rgba(255,255,255,0.5), rgba(255,255,255,0) 42%)" }),
    box({ ...fill, backgroundImage: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0), rgba(0,0,0,0.5) 100%)" }),
    ...glints,
    ...stars,
    // Content
    box(
      { ...fill, flexDirection: "column", justifyContent: "space-between", padding: pad },
      box(
        { justifyContent: "space-between", alignItems: "center" },
        text({ fontSize: px(26), letterSpacing: px(7), textTransform: "uppercase", opacity: 0.85 }, "Linear Wrapped"),
        text({ fontSize: px(26), letterSpacing: px(5), opacity: 0.85 }, String(s.y)),
      ),
      box(
        {
          alignSelf: "center",
          position: "relative",
          width: art,
          height: art,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: px(30),
          backgroundColor: "rgba(4,5,9,0.55)",
          border: `${Math.max(1, px(2))}px solid rgba(255,255,255,0.28)`,
        },
        box({ position: "absolute", left: px(20), top: px(20) }, ring(art - px(44), s.d / daysInYear(s.y), [a, b], "holo-ring")),
        box({ position: "absolute", left: px(95), top: px(95) }, sigil(s.a, art - px(194), [a, b], "holo-sigil")),
      ),
      box(
        { flexDirection: "column", gap: px(6) },
        text({ fontSize: px(24), letterSpacing: px(6), textTransform: "uppercase", opacity: 0.7 }, "Archetype"),
        text({ fontSize: px(82), lineHeight: 1, letterSpacing: -px(3) }, archetype.name),
        text({ fontSize: px(30), opacity: 0.75 }, archetype.tagline),
      ),
      box(
        { gap: px(14) },
        stat("Closed", s.n.toLocaleString("en-US")),
        stat("Active days", String(s.d), `of ${daysInYear(s.y)}`),
        stat("Streak", s.s ? String(s.s) : "-", s.s ? (s.s === 1 ? "day" : "days") : s.m ? `Peak ${monthName(s.m, true)}` : ""),
      ),
    ),
  );

  return box(
    { width: w, height: hgt, padding: rim, borderRadius: px(44), backgroundImage: FOIL, boxShadow: `0 ${px(30)}px ${px(90)}px rgba(139,92,246,0.45)` },
    face,
  );
}
