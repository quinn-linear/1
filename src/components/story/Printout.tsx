"use client";

import { useMemo, type CSSProperties } from "react";
import { plural, type Recap } from "@/lib/recap";
import { ARCHETYPE_COPY } from "@/lib/stats/archetype";
import { ARCHETYPE_ART, ART_SIZE } from "@/lib/share/archetypeArt";
import { dotMatrix, blockSize, columnsFor } from "@/lib/share/dotMatrix";
import {
  BACKDROP, INK, LAYOUT, PAPER, PAPER_BOTTOM, PAPER_TOP, archetypeLines, colW, colX, dotRule, headerText, holeYs, namePitch, printoutStats, tornClipPath, valuePitch,
  type PrintoutData,
} from "@/lib/share/printout";

/** The recap's numbers as the print-out's data (the same shape the share image gets). */
export function printoutData(r: Recap): PrintoutData {
  return { year: r.year, archetype: r.archetype.id, closed: r.totalClosed, activeDays: r.activeDays, streak: r.longestStreak?.days ?? 0, peakMonth: r.peakMonth?.month ?? null, undercount: r.truncated };
}

// Paper units are 1000 wide: 1 unit = 0.1cqw of the sheet (a size container), 1 unit down = 0.1cqw as well.
const cq = (units: number) => `${(units / 10).toFixed(3)}cqw`;
const at = (x: number, y: number, extra: CSSProperties = {}): CSSProperties => ({ position: "absolute", left: cq(x), top: cq(y), ...extra });
/** The web face (VT323) runs small for its size, so text is set a little larger than the share image's. */
const FONT_BOOST = 1.28;

/**
 * The final card: the year-end report on dot-matrix tractor-feed paper. Same layout as
 * the share image (`lib/share/printout.ts`). This is the viewer's own screen, so it also
 * prints their name; the public image never does. It feeds out line by line when it
 * appears (instant under reduced motion).
 */
export function Printout({ recap }: { recap: Recap }) {
  const d = printoutData(recap);
  const art = ARCHETYPE_ART[d.archetype];
  const copy = ARCHETYPE_COPY[d.archetype];
  const stats = printoutStats(d);
  const header = [headerText(d.year)];
  const nameLines = archetypeLines(d.archetype);
  const nameSize = blockSize(nameLines);
  const np = namePitch();
  const clip = useMemo(() => tornClipPath(), []);
  const holes = useMemo(() => holeYs(), []);
  const L = LAYOUT;
  const fs = (n: number): CSSProperties => ({ fontSize: cq(n * FONT_BOOST), lineHeight: 1.05, color: INK });

  const rule = (y: number) => (
    <div aria-hidden style={at(L.content.x, y, { width: cq(L.content.w), height: cq(6) })}>
      {dotRule(L.content.w)}
    </div>
  );
  const vrule = (x: number) => (
    <div aria-hidden style={at(x - 3, L.stats.y, { width: cq(6), height: cq(L.stats.h) })}>
      {dotRule(L.stats.h, INK, true, 0.6)}
    </div>
  );

  return (
    <div className="print-wrap" style={{ width: "min(100%, 26rem, 58dvh)" }}>
      <div
        data-print
        role="group"
        tabIndex={0}
        aria-label={`Year-end report for ${recap.viewer.name}, ${recap.year}: ${plural(recap.totalClosed, "issue")} closed, archetype ${recap.archetype.name}, ${plural(recap.activeDays, "active day")}`}
        className="print-feed focus-ph relative w-full select-none font-term outline-none [container-type:inline-size]"
        style={{ aspectRatio: `${PAPER.w} / ${PAPER.h}`, filter: "drop-shadow(0 10px 18px rgb(0 0 0 / 0.55))" }}
      >
        <div className="absolute inset-0" style={{ clipPath: clip, backgroundImage: `linear-gradient(180deg, ${PAPER_TOP}, ${PAPER_BOTTOM})`, backgroundColor: PAPER_BOTTOM }}>
          {/* Feed holes and perforations */}
          {holes.flatMap((y) =>
            L.holeX.map((x) => <span key={`${x}-${y}`} aria-hidden className="absolute rounded-full" style={at(x - L.holeR, y - L.holeR, { width: cq(L.holeR * 2), height: cq(L.holeR * 2), backgroundColor: BACKDROP, boxShadow: `inset 0 ${cq(3)} ${cq(4)} rgb(0 0 0 / 0.6)` })} />),
          )}
          {L.perfX.map((x) => (
            <div key={x} aria-hidden style={at(x - 3, 30, { width: cq(6), height: cq(PAPER.h - 60) })}>
              {dotRule(PAPER.h - 60, INK, true, 0.35)}
            </div>
          ))}

          {/* Header: dot-matrix title across the sheet */}
          <div aria-hidden style={at(L.content.x, L.header.y, { width: cq(L.content.w) })}>
            {dotMatrix(header, INK, null)}
          </div>
          <h2 className="sr-only">{headerText(d.year)}</h2>
          {rule(L.ruleY[0])}
          <p className="truncate uppercase" style={at(L.content.x, L.name.y, { width: cq(L.content.w), letterSpacing: "0.08em", ...fs(L.name.fs) })}>
            Name: {recap.viewer.name}
          </p>

          {/* Badge and archetype */}
          <div style={at(L.badge.x, L.badge.y, { width: cq(L.badge.d), height: cq(L.badge.d) })}>
            {/* Pre-optimized local asset with explicit dimensions; next/image would only re-encode it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art.web} alt={art.alt} width={ART_SIZE.web} height={ART_SIZE.web} decoding="async" draggable={false} className="block h-full w-full object-contain" />
          </div>
          <p className="uppercase" style={at(L.text.x, L.label.y, { letterSpacing: "0.14em", opacity: 0.8, ...fs(L.label.fs) })}>
            Your archetype
          </p>
          <div aria-hidden style={at(L.text.x, L.archName.y, { width: cq(nameSize.cols * np) })}>
            {dotMatrix(nameLines, INK, null)}
          </div>
          <p className="sr-only">{recap.archetype.name}</p>
          <p className="overflow-hidden" style={at(L.text.x, L.desc.y, { width: cq(L.text.w), height: cq(L.desc.h), ...fs(L.desc.fs), lineHeight: 1.12 })}>
            {copy.description}
          </p>
          {rule(L.ruleY[1])}

          {/* Stats */}
          {vrule(colX(1))}
          {vrule(colX(2))}
          {stats.map((s, i) => {
            const vp = valuePitch(s.value);
            const cols = columnsFor([...s.value].length);
            return (
              <div key={s.label}>
                <p className="whitespace-nowrap text-center uppercase" style={at(colX(i), L.stats.y, { width: cq(colW), letterSpacing: "0.03em", ...fs(L.stats.labelFs) })}>
                  {s.label}
                </p>
                <div aria-hidden style={at(colX(i) + (colW - cols * vp) / 2, L.stats.y + L.stats.valueY, { width: cq(cols * vp) })}>
                  {dotMatrix([s.value], INK, null)}
                </div>
                <p className="sr-only">{s.value}</p>
                <p className="text-center" style={at(colX(i), L.stats.y + L.stats.subY, { width: cq(colW), height: cq(L.stats.subFs * 1.3), opacity: 0.8, ...fs(L.stats.subFs) })}>
                  {s.sub}
                </p>
              </div>
            );
          })}
          {rule(L.ruleY[2])}

          {/* Footer */}
          <p className="uppercase" style={at(L.content.x, L.footer.y, { letterSpacing: "0.1em", ...fs(L.footer.fs) })}>
            End of year report
          </p>
          <p className="uppercase" style={at(L.content.x, L.footer.y + L.footer.fs * 1.4, { letterSpacing: "0.08em", opacity: 0.7, ...fs(L.footer.small) })}>
            Linear Wrapped {d.year}
          </p>
          {d.undercount && (
            <p className="text-right uppercase" style={at(L.content.x + L.content.w / 2, L.footer.y, { width: cq(L.content.w / 2), opacity: 0.8, ...fs(L.footer.small) })}>
              Counts may be undercounts
            </p>
          )}
          {/* A faint fold across the sheet. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0" style={{ top: `${37}%`, height: cq(40), backgroundImage: "linear-gradient(180deg, transparent, rgb(60 40 10 / 0.07), transparent)" }} />
        </div>
      </div>
    </div>
  );
}
