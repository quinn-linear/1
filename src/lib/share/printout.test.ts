import assert from "node:assert/strict";
import { test } from "node:test";
import type { ArchetypeId } from "../stats/types.ts";
import { ARCHETYPE_COPY } from "../stats/archetype.ts";
import { ADVANCE, blockSize, columnsFor, dotMatrix, dotPositions, hasGlyph, wrapLines } from "./dotMatrix.ts";
import { LAYOUT, PAPER, buildPrintout, colW, colX, headerPitch, headerText, namePitch, printoutStats, tornClipPath, valuePitch, archetypeLines, type PrintoutData } from "./printout.ts";

const IDS: ArchetypeId[] = ["early-bird", "friday-shipper", "weekend-warrior", "steady-builder", "night-owl"];
const data = (over: Partial<PrintoutData> = {}): PrintoutData => ({ year: 2026, archetype: "steady-builder", closed: 4, activeDays: 4, streak: 2, peakMonth: 3, undercount: false, ...over });

test("the dot font covers letters, digits and the punctuation used, in a 5 x 7 grid, and falls back to ?", () => {
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:-/'!?&#+") assert.ok(hasGlyph(ch), ch);
  assert.ok(!hasGlyph("é") && !hasGlyph("日"));
  const dots = dotPositions(["A1?"]);
  assert.ok(dots.length > 20 && dots.every(({ x, y }) => x >= 0 && x < 3 * ADVANCE - 1 && y >= 0 && y < 7));
  assert.deepEqual(dotPositions(["é"]), dotPositions(["?"]), "unknown characters print as ?");
  assert.deepEqual(dotPositions(["a"]), dotPositions(["A"]), "lowercase prints as capitals");
  assert.equal(columnsFor(19), 19 * 6 - 1);
  assert.deepEqual(blockSize(["AB", "C"]), { cols: 11, rows: 16 });
});

test("lines wrap at word breaks, cut over-long words and are never empty", () => {
  assert.deepEqual(wrapLines("Weekend Warrior", 7), ["Weekend", "Warrior"]);
  assert.deepEqual(wrapLines("Night Owl", 7), ["Night", "Owl"]);
  assert.deepEqual(wrapLines("Supercalifragilistic", 7), ["Superca", "lifragi", "listic"]);
  assert.deepEqual(wrapLines("   ", 7), [""]);
});

test("the header and every archetype name fit their boxes at the chosen dot pitch", () => {
  for (const year of [2026, 2100]) {
    const cols = columnsFor([...headerText(year)].length);
    assert.ok(cols * headerPitch(year) <= LAYOUT.content.w + 0.01);
    assert.ok(7 * headerPitch(year) < 60, "the header stays a header, not a banner");
  }
  for (const id of IDS) {
    const lines = archetypeLines(id);
    assert.ok(lines.length <= 2, `${id} wraps to at most two lines`);
    const { cols, rows } = blockSize(lines);
    assert.ok(cols * namePitch() <= LAYOUT.text.w + 0.01, `${id} fits the text column`);
    assert.ok(LAYOUT.archName.y + rows * namePitch() <= LAYOUT.desc.y - 10, `${id} name ends above the description`);
  }
});

test("stat values shrink to stay inside their column, from one digit to millions", () => {
  assert.equal(valuePitch("4"), LAYOUT.stats.valueMaxPitch, "short values are big");
  for (const v of ["0", "-", "365", "10,000", "1,234,567", "10,000,000"]) {
    const w = columnsFor([...v].length) * valuePitch(v);
    assert.ok(w <= colW - 2 * LAYOUT.stats.pad + 0.01, `${v} fits`);
    assert.ok(LAYOUT.stats.valueY + 7 * valuePitch(v) <= LAYOUT.stats.subY, `${v} ends above its sub line`);
  }
  assert.ok(valuePitch("10,000,000") < valuePitch("100"));
});

test("zero, sparse and long data produce honest stats (no invented numbers)", () => {
  assert.deepEqual(printoutStats(data({ closed: 0, activeDays: 0, streak: 0, peakMonth: null })).map((s) => [s.value, s.sub]), [["0", ""], ["0", "of 365"], ["-", ""]]);
  assert.equal(printoutStats(data({ streak: 1 }))[2].sub, "day");
  assert.equal(printoutStats(data({ streak: 12 }))[2].sub, "days");
  assert.equal(printoutStats(data({ streak: 0, peakMonth: 3 }))[2].sub, "Peak Mar");
  assert.equal(printoutStats(data({ closed: 12345, year: 2028 }))[0].value, "12,345");
  assert.equal(printoutStats(data({ year: 2028 }))[1].sub, "of 366");
});

test("the layout stacks without collisions: every band ends before the next begins, inside the sheet", () => {
  const L = LAYOUT;
  const bands = [
    ["header", L.header.y, L.header.y + 7 * headerPitch(2026)],
    ["rule A", L.ruleY[0], L.ruleY[0] + 6],
    ["name", L.name.y, L.name.y + L.name.fs * 1.4],
    ["archetype", L.badge.y, Math.max(L.badge.y + L.badge.d, L.desc.y + L.desc.h)],
    ["rule B", L.ruleY[1], L.ruleY[1] + 6],
    ["stats", L.stats.y, L.stats.y + L.stats.h],
    ["rule C", L.ruleY[2], L.ruleY[2] + 6],
    ["footer", L.footer.y, L.footer.y + L.footer.fs * 1.35 + L.footer.small * 1.2],
  ] as const;
  bands.slice(1).forEach(([name, top], i) => assert.ok(top >= bands[i][2], `${name} starts after ${bands[i][0]} ends (${top} vs ${bands[i][2]})`));
  assert.ok(bands[bands.length - 1][2] <= PAPER.h - 20, "footer clears the torn bottom edge");
  assert.ok(L.badge.x + L.badge.d < L.text.x, "badge is left of the text column");
  assert.ok(L.text.x + L.text.w <= L.content.x + L.content.w);
  assert.ok(L.content.x > L.perfX[0] && L.content.x + L.content.w < L.perfX[1], "content stays between the perforations");
  assert.equal(colX(0) + 3 * colW, L.content.x + L.content.w);
  // The longest shipped archetype description fits the text box at the share image's font size (about 0.52 em per character).
  for (const id of IDS) {
    const perLine = Math.floor(L.text.w / (L.desc.fs * 0.55));
    const lines = Math.ceil(ARCHETYPE_COPY[id].description.length / perLine) + 1;
    assert.ok(lines * L.desc.fs * 1.3 <= L.desc.h, `${id} description fits (${lines} lines)`);
  }
});

test("the torn edge is deterministic and stays inside the sheet", () => {
  assert.equal(tornClipPath(), tornClipPath());
  const pts = [...tornClipPath().matchAll(/([\d.]+)% ([\d.]+)%/g)].map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(pts.length > 80 && pts.every(([x, y]) => x >= 0 && x <= 100 && y >= 0 && y <= 100));
  assert.ok(pts.filter(([, y]) => y < 5).length > 40 && pts.filter(([, y]) => y > 95).length > 40, "both the top and the bottom are torn");
});

test("the share sheet prints dynamic stats, never a sample, and the name only when it is passed", () => {
  const json = (d: PrintoutData, name?: string | null) => JSON.stringify(buildPrintout(d, 940, { art: "data:image/jpeg;base64,QUJD", name }));
  const a = json(data({ closed: 7, activeDays: 6, streak: 3 }));
  assert.ok(a.includes("data:image/jpeg;base64,QUJD"));
  assert.doesNotMatch(a, /AARON|QUINN|NAME:/, "no sample identity, no name row by default");
  assert.match(a, /of 365/);
  assert.match(json(data(), "Ada Lovelace"), /NAME: ADA LOVELACE/, "private callers can print a name");
  assert.match(json(data({ undercount: true })), /COUNTS MAY BE UNDERCOUNTS/);
  assert.doesNotMatch(json(data({ undercount: false })), /UNDERCOUNTS/);
  for (const closed of [0, 1, 12345, 9_999_999]) assert.ok(json(data({ closed })).length > 1000);
  for (const id of IDS) assert.ok(json(data({ archetype: id })).includes("YOUR ARCHETYPE"));
});

test("dotMatrix renders one path of round dots in a viewBox sized to the text", () => {
  const el = dotMatrix(["HI"], "#000", 5) as { props: { viewBox: string; width: number; height: number; children: { props: { d: string } } } };
  assert.equal(el.props.viewBox, `0 0 ${columnsFor(2)} 7`);
  assert.equal(el.props.width, columnsFor(2) * 5);
  assert.equal(el.props.height, 35);
  assert.ok(el.props.children.props.d.startsWith("M"));
});
