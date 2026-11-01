import { createElement as h, type CSSProperties, type ReactElement } from "react";
import { describe, type CardCopy } from "./copy.ts";
import type { Snapshot } from "./snapshot.ts";
import { CARD_GRADIENTS, IMAGE_FORMATS, type ImageFormat } from "./theme.ts";

/**
 * Share image layout. Built with plain `createElement` (no JSX) so it can be
 * rendered in unit tests, and with the flex-only CSS subset Satori supports.
 * Only text from a validated snapshot goes in: no remote images or fonts are
 * fetched, so there is nothing for a crafted link to make us request.
 */

const ACCENT = "#fde68a";

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
  story: { pad: 96, kicker: 44, big: 400, headline: 170, body: 60, pill: 44, foot: 36, barHeight: 380 },
  og: { pad: 56, kicker: 26, big: 190, headline: 96, body: 32, pill: 26, foot: 22, barHeight: 150 },
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

export function renderCard(snapshot: Snapshot, format: ImageFormat): ReactElement {
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
  const [c1, c2, c3] = CARD_GRADIENTS[snapshot.c];
  const story = format === "story";

  const bigSize = fit(k.big, copy.big ?? "", story ? 4 : 5);
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
        backgroundImage: `linear-gradient(160deg, ${c1}, ${c2} 55%, ${c3})`,
      },
    },
    text({ fontSize: k.kicker, letterSpacing: 8, textTransform: "uppercase", opacity: 0.85 }, `Linear Wrapped ${snapshot.y}`),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: story ? 24 : 8 } },
      text({ fontSize: k.kicker, letterSpacing: 6, textTransform: "uppercase", opacity: 0.8 }, copy.kicker),
      copy.big ? text({ fontSize: bigSize, lineHeight: 0.9, letterSpacing: -Math.round(bigSize * 0.03), color: ACCENT }, copy.big) : null,
      text(
        { fontSize: headlineSize, lineHeight: 0.95, letterSpacing: -Math.round(headlineSize * 0.035), wordBreak: "break-word", color: copy.big ? "#fff" : ACCENT },
        copy.headline,
      ),
      copy.pills ? pills(copy.pills, k) : null,
      copy.body ? text({ fontSize: fit(k.body, copy.body, story ? 80 : 110, 0.6), lineHeight: 1.25, opacity: 0.9, maxWidth: story ? 800 : 1000 }, copy.body) : null,
      copy.bars ? bars(copy.bars, k) : null,
    ),
    text({ fontSize: k.foot, opacity: 0.7, lineHeight: 1.3 }, copy.footnote ?? "Get yours: Linear Wrapped"),
  );
}

function bars(b: NonNullable<CardCopy["bars"]>, k: Scale) {
  const max = Math.max(...b.values, 1);
  return h(
    "div",
    { style: { display: "flex", alignItems: "flex-end", gap: k.pad / 8, height: k.barHeight, marginTop: 16 } },
    ...b.values.map((v, i) =>
      h("div", {
        key: i,
        style: {
          display: "flex",
          flex: 1,
          height: Math.max(Math.round((v / max) * k.barHeight), v > 0 ? 10 : 4),
          borderRadius: 12,
          background: i === b.highlight ? ACCENT : "rgba(255,255,255,0.4)",
        },
      }),
    ),
  );
}

function pills(items: string[], k: Scale) {
  return h(
    "div",
    { style: { display: "flex", flexWrap: "wrap", gap: k.pill / 3 } },
    ...items.map((p, i) =>
      h(
        "div",
        { key: i, style: { display: "flex", fontSize: k.pill, padding: `${k.pill / 5}px ${k.pill / 2}px`, borderRadius: 999, background: "rgba(255,255,255,0.92)", color: "#1e1b4b" } },
        p,
      ),
    ),
  );
}
