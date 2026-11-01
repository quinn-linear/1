import { cloneElement, createElement as h, type CSSProperties, type ReactElement } from "react";
import { monthName } from "../recap.ts";
import { ARCHETYPE_COPY } from "../stats/archetype.ts";
import { constellation, daysInYear, ring, sigil } from "./art.ts";
import { describe, type CardCopy } from "./copy.ts";
import type { Snapshot } from "./snapshot.ts";
import { PALETTE } from "../retro/palette.ts";
import { CARD_ACCENTS, IMAGE_FORMATS, SURFACE, type ImageFormat } from "./theme.ts";

/**
 * Share image layout. Built with plain `createElement` (no JSX) so it can be
 * rendered in unit tests, and with the flex-only CSS subset Satori supports.
 * Only text from a validated snapshot goes in: no remote images or fonts are
 * fetched, so there is nothing for a crafted link to make us request.
 *
 * Look: every image is a screenshot of the computer: cream case, black tube
 * with scanlines, phosphor text, one green or amber accent per card (shared
 * with the story UI via `CARD_ACCENTS`). The summary is the collectible floppy
 * disk with its system-report label and two small holographic foil stickers.
 * The type is the renderer's bundled sans, set in capitals; the web UI's bitmap
 * face (VT323) is a webfont Satori can't load here without fetching it.
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
  story: { pad: 72, kicker: 40, big: 380, headline: 150, body: 56, pill: 42, foot: 34, barHeight: 340 },
  og: { pad: 34, kicker: 22, big: 170, headline: 86, body: 30, pill: 24, foot: 20, barHeight: 120 },
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
const fill: CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };

const GLOW = "0 0 14px rgba(93,255,143,0.4)";

/** The computer around every image: case, tube (scanlines + vignette) and a strip with the model plate and keys. */
function frame(format: ImageFormat, screen: ReactElement): ReactElement {
  const { width, height } = IMAGE_FORMATS[format];
  const story = format === "story";
  const pad = story ? 44 : 22;
  const strip = story ? 150 : 62;
  const key = (i: number) =>
    cloneElement(
      box({
        width: story ? 74 : 34,
        height: story ? 46 : 22,
        borderRadius: story ? 6 : 3,
        backgroundColor: "#efe8cf",
        border: `${story ? 2 : 1}px solid #000`,
        boxShadow: `0 ${story ? 6 : 3}px 0 ${PALETTE.caseDeep}`,
      }),
      { key: i },
    );
  return box(
    {
      width,
      height,
      flexDirection: "column",
      padding: pad,
      color: "#fff",
      backgroundColor: PALETTE.case,
      backgroundImage: "linear-gradient(160deg, rgba(255,255,255,0.4), rgba(255,255,255,0) 40%), linear-gradient(0deg, rgba(0,0,0,0.12), rgba(0,0,0,0) 30%)",
    },
    box(
      {
        position: "relative",
        flex: 1,
        overflow: "hidden",
        borderRadius: story ? 64 : 30,
        border: `${story ? 12 : 6}px solid #0d0c08`,
        backgroundColor: SURFACE,
        backgroundImage: "radial-gradient(circle at 50% 45%, #06140a, rgba(2,7,3,1) 75%)",
      },
      screen,
      box({ ...fill, backgroundImage: "repeating-linear-gradient(180deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.13) 3px, rgba(0,0,0,0.13) 4px)" }),
      box({ ...fill, backgroundImage: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.35) 100%)" }),
    ),
    box(
      { height: strip, alignItems: "center", justifyContent: "space-between", paddingTop: story ? 14 : 4 },
      text({ fontSize: story ? 34 : 20, letterSpacing: story ? 7 : 4, textTransform: "uppercase", color: PALETTE.ink, opacity: 0.75 }, "LW-2026 Personal"),
      box(
        { alignItems: "center", gap: story ? 16 : 8 },
        ...[0, 1, 2, 3].map(key),
        box({ width: story ? 24 : 12, height: story ? 24 : 12, borderRadius: 999, backgroundColor: "#ff6a3d", marginLeft: story ? 12 : 6 }),
      ),
    ),
  );
}

export function renderCard(snapshot: Snapshot, format: ImageFormat): ReactElement {
  return snapshot.c === "summary" ? renderDisk(snapshot, format) : renderPlain(snapshot, format);
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
  const k = SCALES[format];
  const [a, b] = CARD_ACCENTS[snapshot.c];
  const story = format === "story";

  const bigSize = fit(copy.stars ? Math.round(k.big * 0.5) : k.big, copy.big ?? "", story ? 4 : 5);
  const headlineSize = fit(k.headline, copy.headline, story ? 10 : 18, 0.3);

  return frame(
    format,
    h(
      "div",
      { style: { ...fill, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: k.pad, color: PALETTE.phosphor } },
      box(
        { justifyContent: "space-between", alignItems: "center", paddingBottom: k.kicker * 0.4, borderBottom: "2px dashed rgba(93,255,143,0.5)", fontSize: k.kicker, letterSpacing: 5, textTransform: "uppercase" },
        text({}, `Linear Wrapped ${snapshot.y}`),
        text({ color: a }, "Ready."),
      ),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: story ? 24 : 8 } },
        text({ fontSize: k.kicker * 1.15, letterSpacing: 5, textTransform: "uppercase", color: PALETTE.amber }, `> ${copy.kicker}`),
        copy.big ? text({ fontSize: bigSize, lineHeight: 0.9, color: a, textShadow: GLOW }, copy.big) : null,
        text(
          { fontSize: headlineSize, lineHeight: 0.95, textTransform: "uppercase", wordBreak: "break-word", color: copy.big ? PALETTE.phosphor : a, textShadow: GLOW },
          copy.headline,
        ),
        copy.pills ? pills(copy.pills, k) : null,
        copy.body ? text({ fontSize: fit(k.body, copy.body, story ? 80 : 110, 0.6), lineHeight: 1.25, opacity: 0.85, maxWidth: story ? 880 : 1000 }, copy.body) : null,
        copy.bars ? bars(copy.bars, k, a, b) : null,
        copy.stars ? box({ alignSelf: "center" }, constellation(copy.stars, story ? 860 : 520, story ? 500 : 130, [a, b], "cn-share")) : null,
        copy.rail ? rail(copy.rail, k, a, b, story ? 836 : 1068) : null,
      ),
      box({ alignItems: "center", gap: k.foot * 0.4, fontSize: k.foot, lineHeight: 1.3, opacity: 0.7 }, text({ color: PALETTE.amber }, ">"), text({}, copy.footnote ?? "Get yours: Linear Wrapped")),
    ),
  );
}

/** Blocky bars with a segmented look, like a character-cell chart. */
function bars(bs: NonNullable<CardCopy["bars"]>, k: Scale, a: string, b: string) {
  const max = Math.max(...bs.values, 1);
  const seg = "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 14px, rgba(2,7,3,0.9) 14px, rgba(2,7,3,0.9) 18px)";
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
          backgroundColor: i === bs.highlight ? b : a,
          opacity: i === bs.highlight ? 1 : 0.45,
          backgroundImage: seg,
        },
      }),
    ),
  );
}

/** A Jan-Dec line with quiet spans (dashed), burst spans (solid) or a single marker. */
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
      box({ position: "absolute", left: 0, top: (tall - bar) / 2, width, height: bar, backgroundColor: "rgba(93,255,143,0.2)" }),
      ...spans.map((sp, i) =>
        sp.tone === "mark"
          ? cloneElement(box({ position: "absolute", left: Math.min(px(sp.from), width - tall), top: 0, width: tall, height: tall, backgroundColor: b }), { key: i })
          : cloneElement(
              box({
                position: "absolute",
                left: px(sp.from),
                top: sp.tone === "burst" ? 0 : (tall - bar) / 2,
                width: Math.max(px(sp.to - sp.from), bar),
                height: sp.tone === "burst" ? tall : bar,
                ...(sp.tone === "burst" ? { backgroundColor: a } : { border: "2px dashed rgba(93,255,143,0.8)" }),
              }),
              { key: i },
            ),
      ),
    ),
    box({ justifyContent: "space-between", width, fontSize: k.foot * 0.8, opacity: 0.7 }, text({}, "JAN"), text({}, "DEC")),
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
            textTransform: "uppercase",
            padding: `${k.pill / 6}px ${k.pill / 2}px`,
            border: "2px solid rgba(93,255,143,0.7)",
            backgroundColor: "rgba(93,255,143,0.08)",
            color: PALETTE.phosphor,
          },
        },
        p,
      ),
    ),
  );
}

// ---------- collectible floppy disk ----------

type Summary = Extract<Snapshot, { c: "summary" }>;

const FOIL = "linear-gradient(115deg, #ff6ec7, #ffd86e, #7dffb2, #6ec8ff, #c58bff)";

function renderDisk(s: Summary, format: ImageFormat): ReactElement {
  const story = format === "story";
  const [a] = CARD_ACCENTS.summary;
  const disk = diskCard(s, story ? 860 : 440);
  const status = (size: number) =>
    box(
      { justifyContent: "space-between", alignItems: "center", fontSize: size, letterSpacing: 5, textTransform: "uppercase", color: PALETTE.phosphor },
      text({}, `Linear Wrapped ${s.y}`),
      text({ color: PALETTE.amber }, "Load ok."),
    );

  if (story) {
    return frame(
      format,
      box(
        { ...fill, flexDirection: "column", justifyContent: "space-between", padding: 72 },
        box({ flexDirection: "column", paddingBottom: 18, borderBottom: "2px dashed rgba(93,255,143,0.5)" }, status(36)),
        box({ alignSelf: "center" }, disk),
        text({ fontSize: 34, opacity: 0.75, color: PALETTE.phosphor }, s.u ? "> Counts may be undercounts." : "> Get yours: Linear Wrapped"),
      ),
    );
  }

  const k = SCALES.og;
  return frame(
    format,
    box(
      { ...fill, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: `0 ${k.pad + 20}px`, color: PALETTE.phosphor },
      disk,
      box(
        { flexDirection: "column", gap: 10, width: 520 },
        text({ fontSize: k.kicker, letterSpacing: 5, textTransform: "uppercase", color: PALETTE.amber }, `> My ${s.y} in Linear`),
        text({ fontSize: fit(150, s.n.toLocaleString("en-US"), 5), lineHeight: 0.9, color: a, textShadow: GLOW }, s.n.toLocaleString("en-US")),
        text({ fontSize: 52, lineHeight: 1, textTransform: "uppercase" }, s.n === 1 ? "issue closed." : "issues closed."),
        text({ fontSize: 28, opacity: 0.85, marginTop: 8, textTransform: "uppercase" }, `${ARCHETYPE_COPY[s.a].name}${s.s ? ` · ${s.s}-day streak` : ""}`),
        text({ fontSize: 22, opacity: 0.7, marginTop: 6 }, s.u ? "> Counts may be undercounts." : "> Get yours: Linear Wrapped"),
      ),
    ),
  );
}

/** The disk itself, square, sized by width. Every dimension scales from `w`, so story and wide share one drawing. */
function diskCard(s: Summary, w: number): ReactElement {
  const u = w / 860;
  const px = (n: number) => Math.round(n * u);
  const [a, b] = CARD_ACCENTS.summary;
  const archetype = ARCHETYPE_COPY[s.a];
  const labelW = w - px(110);
  const labelH = px(470);
  const inset = px(190);
  const ink = PALETTE.ink;

  const sleeve = (child: ReactElement | null, style: CSSProperties) => box(style, child);
  const foil = (style: CSSProperties) => box({ backgroundImage: FOIL, border: `${Math.max(1, px(2))}px solid rgba(0,0,0,0.6)`, ...style });

  const stat = (label: string, value: string, sub?: string) =>
    box(
      { flexDirection: "column", flex: 1, gap: px(2) },
      text({ fontSize: px(22), letterSpacing: px(3), textTransform: "uppercase", color: ink, opacity: 0.7 }, label),
      text({ fontSize: px(66), lineHeight: 1, color: ink }, value),
      text({ fontSize: px(22), color: ink, opacity: 0.7, height: px(26) }, sub ?? ""),
    );

  return box(
    {
      position: "relative",
      width: w,
      height: w,
      borderRadius: px(26),
      border: `${Math.max(2, px(4))}px solid #6b6552`,
      backgroundImage: "linear-gradient(150deg, #403d33, #1a1914)",
      boxShadow: `${px(14)}px ${px(18)}px 0 rgba(0,0,0,0.55)`,
    },
    // Head window and hub on the black sleeve
    sleeve(null, { position: "absolute", left: Math.round(w / 2 - px(46)), top: px(30), width: px(92), height: px(112), borderRadius: px(46), backgroundColor: "#030303", border: `${px(4)}px solid #4a463a` }),
    sleeve(
      box({ width: px(36), height: px(36), borderRadius: 999, backgroundColor: "#030303", border: `${px(3)}px solid #7a7360` }),
      { position: "absolute", left: Math.round(w / 2 - px(52)), top: px(92), width: px(104), height: px(104), borderRadius: 999, backgroundColor: "#17150f", border: `${px(4)}px solid #5a5444`, alignItems: "center", justifyContent: "center" },
    ),
    // Write-protect tab: holographic foil
    foil({ position: "absolute", left: -px(8), top: px(170), width: px(38), height: px(96) }),
    // Paper label with the system report
    box(
      { position: "absolute", left: px(55), bottom: px(30), width: labelW, height: labelH, flexDirection: "column", justifyContent: "space-between", padding: px(26), backgroundColor: "#e8e0c4", border: `${Math.max(1, px(2))}px solid rgba(0,0,0,0.4)` },
      box({ position: "absolute", left: 0, top: 0, width: labelW, height: px(16), backgroundColor: PALETTE.amber }),
      box(
        { justifyContent: "space-between", alignItems: "center", marginTop: px(14) },
        text({ fontSize: px(26), letterSpacing: px(3), textTransform: "uppercase", color: ink }, `Linear Wrapped ${s.y}`),
        text({ fontSize: px(22), letterSpacing: px(3), textTransform: "uppercase", color: ink, opacity: 0.8 }, "System report"),
      ),
      box(
        { gap: px(26), alignItems: "center" },
        // A tiny tube with the ring and sigil
        box(
          { position: "relative", width: inset, height: inset, flexShrink: 0, alignItems: "center", justifyContent: "center", border: `${px(4)}px solid ${ink}`, backgroundColor: SURFACE, overflow: "hidden" },
          box({ position: "absolute", left: px(8), top: px(8) }, ring(inset - px(24), s.d / daysInYear(s.y), [a, b], "disk-ring")),
          box({ position: "absolute", left: px(40), top: px(40) }, sigil(s.a, inset - px(88), [a, b], "disk-sigil")),
          box({ ...fill, backgroundImage: "repeating-linear-gradient(180deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 3px)" }),
        ),
        box(
          { flexDirection: "column", gap: px(4), flex: 1 },
          text({ fontSize: px(24), letterSpacing: px(4), textTransform: "uppercase", color: ink, opacity: 0.7 }, "Archetype"),
          text({ fontSize: px(64), lineHeight: 0.95, textTransform: "uppercase", color: ink }, archetype.name),
          text({ fontSize: px(28), color: ink, opacity: 0.85 }, archetype.tagline),
        ),
      ),
      box(
        { gap: px(18), paddingTop: px(14), borderTop: `${px(3)}px dashed rgba(28,26,20,0.5)` },
        stat("Closed", s.n.toLocaleString("en-US")),
        stat("Active days", String(s.d), `of ${daysInYear(s.y)}`),
        stat("Streak", s.s ? String(s.s) : "-", s.s ? (s.s === 1 ? "day" : "days") : s.m ? `Peak ${monthName(s.m, true)}` : ""),
      ),
      // Holographic seal
      foil({ position: "absolute", right: px(26), bottom: px(30), width: px(84), height: px(84), alignItems: "center", justifyContent: "center" }),
    ),
  );
}
