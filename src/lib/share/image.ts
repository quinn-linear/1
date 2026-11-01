import { cloneElement, createElement as h, type CSSProperties, type ReactElement } from "react";
import { ARCHETYPE_COPY } from "../stats/archetype.ts";
import { constellation } from "./art.ts";
import { describe, type CardCopy } from "./copy.ts";
import type { Snapshot } from "./snapshot.ts";
import { PALETTE } from "../retro/palette.ts";
import { BACKDROP, buildPrintout } from "./printout.ts";
import { CARD_ACCENTS, IMAGE_FORMATS, SURFACE, type ImageFormat } from "./theme.ts";

/**
 * Share image layout. Built with plain `createElement` (no JSX) so it can be
 * rendered in unit tests, and with the flex-only CSS subset Satori supports.
 * Only text from a validated snapshot goes in: no remote images or fonts are
 * fetched, so there is nothing for a crafted link to make us request.
 *
 * Look: every image is a full-screen capture of the tube: blue-black glass with
 * scanlines, pale lavender-white text, one lavender or amber accent per card (shared
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

const GLOW = "0 0 14px rgba(184,168,255,0.45), 0 0 3px rgba(233,229,255,0.5)";

/**
 * The tube behind every image: edge to edge (no case or bezel, like the story),
 * with scanlines and a vignette over a blue-black screen.
 */
function frame(format: ImageFormat, screen: ReactElement): ReactElement {
  const { width, height } = IMAGE_FORMATS[format];
  return box(
    {
      position: "relative",
      width,
      height,
      overflow: "hidden",
      color: PALETTE.phosphor,
      backgroundColor: SURFACE,
      backgroundImage: "radial-gradient(circle at 50% 45%, #1a1638, rgba(10,9,18,1) 75%)",
    },
    screen,
    box({ ...fill, backgroundImage: "repeating-linear-gradient(180deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.13) 3px, rgba(0,0,0,0.13) 4px)" }),
    box({ ...fill, backgroundImage: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.3) 100%)" }),
  );
}

/**
 * `art` is the archetype's engraving as a data URI (see `loadShareArt`), used by the
 * archetype and summary cards. Without it (tests, an unreadable file) those cards
 * fall back to the generated sigil.
 */
export function renderCard(snapshot: Snapshot, format: ImageFormat, art: string | null = null): ReactElement {
  if (snapshot.c === "summary") return renderDisk(snapshot, format, art);
  if (snapshot.c === "archetype" && art) return renderArchetype(snapshot, format, art);
  return renderPlain(snapshot, format);
}

/** The halftone badge, whole (`contain`, never cropped); clipped to its own circle so the paper-coloured corners of the JPEG never show on the dark screen. */
function artFrame(art: string, size: number): ReactElement {
  return box(
    { width: size, height: size, flexShrink: 0, borderRadius: 999, overflow: "hidden" },
    // Satori needs explicit pixel sizes on <img>; the data URI is local, so nothing is fetched.
    h("img", { src: art, width: size, height: size, style: { objectFit: "contain" } }),
  );
}

type ArchetypeSnap = Extract<Snapshot, { c: "archetype" }>;

function renderArchetype(snapshot: ArchetypeSnap, format: ImageFormat, art: string): ReactElement {
  const raw = describe(snapshot);
  const a = ARCHETYPE_COPY[snapshot.a];
  const k = SCALES[format];
  const [accent] = CARD_ACCENTS.archetype;
  const story = format === "story";
  const name = imageSafe(a.name);
  const head = box(
    { justifyContent: "space-between", alignItems: "center", paddingBottom: k.kicker * 0.4, borderBottom: "2px dashed rgba(184,168,255,0.5)", fontSize: k.kicker, letterSpacing: 5, textTransform: "uppercase" },
    text({}, `Linear Wrapped ${snapshot.y}`),
    text({ color: accent }, "Ready."),
  );
  const foot = box({ alignItems: "center", gap: k.foot * 0.4, fontSize: k.foot, lineHeight: 1.3, opacity: 0.7 }, text({ color: PALETTE.amber }, ">"), text({}, raw.footnote ? imageSafe(raw.footnote) : "Get yours: Linear Wrapped"));
  const copy = (size: number, nameSize: number, gap: number) =>
    box(
      { flexDirection: "column", gap },
      text({ fontSize: k.kicker * 1.15, letterSpacing: 5, textTransform: "uppercase", color: PALETTE.amber }, "> Archetype"),
      text({ fontSize: nameSize, lineHeight: 0.95, textTransform: "uppercase", wordBreak: "break-word", color: accent, textShadow: GLOW }, name),
      text({ fontSize: size * 1.1, lineHeight: 1.2, color: PALETTE.phosphor }, imageSafe(a.tagline)),
      text({ fontSize: size, lineHeight: 1.25, opacity: 0.8 }, imageSafe(a.description)),
    );

  if (story) {
    return frame(
      format,
      box(
        { ...fill, flexDirection: "column", justifyContent: "space-between", padding: k.pad },
        head,
        box({ alignSelf: "center" }, artFrame(art, 800)),
        copy(k.body * 0.8, fit(k.headline, name, 10, 0.5), 20),
        foot,
      ),
    );
  }
  return frame(
    format,
    box(
      { ...fill, flexDirection: "column", justifyContent: "space-between", padding: k.pad },
      head,
      box({ alignItems: "center", gap: 36, flex: 1, paddingTop: 14, paddingBottom: 8 }, artFrame(art, 420), box({ flex: 1 }, copy(k.body * 0.85, fit(70, name, 11, 0.6), 10))),
      foot,
    ),
  );
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
        { justifyContent: "space-between", alignItems: "center", paddingBottom: k.kicker * 0.4, borderBottom: "2px dashed rgba(184,168,255,0.5)", fontSize: k.kicker, letterSpacing: 5, textTransform: "uppercase" },
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
  const seg = "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 14px, rgba(10,9,18,0.9) 14px, rgba(10,9,18,0.9) 18px)";
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
      box({ position: "absolute", left: 0, top: (tall - bar) / 2, width, height: bar, backgroundColor: "rgba(184,168,255,0.2)" }),
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
                ...(sp.tone === "burst" ? { backgroundColor: a } : { border: "2px dashed rgba(184,168,255,0.8)" }),
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
            border: "2px solid rgba(184,168,255,0.7)",
            backgroundColor: "rgba(184,168,255,0.08)",
            color: PALETTE.phosphor,
          },
        },
        p,
      ),
    ),
  );
}

// ---------- dot-matrix print-out ----------

type Summary = Extract<Snapshot, { c: "summary" }>;

const CREAM = "#e6d9ba";

/**
 * The summary: the same print-out sheet the story ends on (`lib/share/printout.ts`), lying on a dark desk.
 * Public images never carry the viewer's name: the report is built without it. Only
 * the numbers, the archetype and its badge, which every summary share already showed.
 */
function renderDisk(s: Summary, format: ImageFormat, art: string | null): ReactElement {
  const story = format === "story";
  const data = { year: s.y, archetype: s.a, closed: s.n, activeDays: s.d, streak: s.s ?? 0, peakMonth: s.m ?? null, undercount: s.u };
  const { width, height } = IMAGE_FORMATS[format];
  const desk = {
    position: "relative" as const,
    width,
    height,
    overflow: "hidden" as const,
    color: CREAM,
    backgroundColor: BACKDROP,
    backgroundImage: "radial-gradient(circle at 50% 40%, #2c261c, #0f0d09 75%)",
  };
  const caption = (size: number) => text({ fontSize: size, opacity: 0.8, letterSpacing: 2 }, s.u ? "> Counts may be undercounts." : "> Get yours: Linear Wrapped");

  if (story) {
    const w = 940;
    return box(
      desk,
      box(
        { ...fill, flexDirection: "column", justifyContent: "space-between", alignItems: "center", padding: 72 },
        text({ alignSelf: "flex-start", fontSize: 38, letterSpacing: 6, textTransform: "uppercase", color: PALETTE.amber }, `> Linear Wrapped ${s.y}`),
        box({ transform: "rotate(-1.2deg)", boxShadow: "0 30px 60px rgba(0,0,0,0.55)" }, buildPrintout(data, w, { art })),
        box({ alignSelf: "flex-start" }, caption(34)),
      ),
    );
  }

  const k = SCALES.og;
  const a = CARD_ACCENTS.summary[0];
  const w = 468;
  return box(
    { ...desk, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: `0 ${k.pad + 30}px` },
    box({ transform: "rotate(-2deg)", boxShadow: "0 18px 40px rgba(0,0,0,0.55)" }, buildPrintout(data, w, { art })),
    box(
      { flexDirection: "column", gap: 10, width: 560 },
      text({ fontSize: k.kicker, letterSpacing: 5, textTransform: "uppercase", color: PALETTE.amber }, `> My ${s.y} in Linear`),
      text({ fontSize: fit(150, s.n.toLocaleString("en-US"), 5), lineHeight: 0.9, color: CREAM }, s.n.toLocaleString("en-US")),
      text({ fontSize: 52, lineHeight: 1, textTransform: "uppercase" }, s.n === 1 ? "issue closed." : "issues closed."),
      text({ fontSize: 28, opacity: 0.85, marginTop: 8, textTransform: "uppercase", color: a }, `${ARCHETYPE_COPY[s.a].name}${s.s ? ` · ${s.s}-day streak` : ""}`),
      text({ fontSize: 22, opacity: 0.7, marginTop: 6 }, s.u ? "> Counts may be undercounts." : "> Get yours: Linear Wrapped"),
    ),
  );
}
