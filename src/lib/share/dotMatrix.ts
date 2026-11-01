import { createElement as h, type ReactElement } from "react";

/**
 * Dot-matrix type for the printout: a 5 x 7 dot font drawn as one SVG path of
 * round dots, so the web report and the share images are the same letters and
 * need no font file (Satori can't load webfonts here). Plain `createElement`
 * with an SVG `viewBox`, so it renders in the browser and in Satori alike.
 * Characters the font doesn't have come out as "?". Lowercase is drawn as capitals.
 */
const ROWS = 7;
const COLS = 5;
/** A glyph is 5 columns plus one blank column of spacing. */
export const ADVANCE = COLS + 1;

const G = (...rows: string[]) => rows;
const BLANK = G("00000", "00000", "00000", "00000", "00000", "00000", "00000");

const GLYPHS: Record<string, string[]> = {
  " ": BLANK,
  A: G("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
  B: G("11110", "10001", "10001", "11110", "10001", "10001", "11110"),
  C: G("01110", "10001", "10000", "10000", "10000", "10001", "01110"),
  D: G("11110", "10001", "10001", "10001", "10001", "10001", "11110"),
  E: G("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
  F: G("11111", "10000", "10000", "11110", "10000", "10000", "10000"),
  G: G("01110", "10001", "10000", "10111", "10001", "10001", "01111"),
  H: G("10001", "10001", "10001", "11111", "10001", "10001", "10001"),
  I: G("01110", "00100", "00100", "00100", "00100", "00100", "01110"),
  J: G("00111", "00010", "00010", "00010", "00010", "10010", "01100"),
  K: G("10001", "10010", "10100", "11000", "10100", "10010", "10001"),
  L: G("10000", "10000", "10000", "10000", "10000", "10000", "11111"),
  M: G("10001", "11011", "10101", "10101", "10001", "10001", "10001"),
  N: G("10001", "11001", "10101", "10011", "10001", "10001", "10001"),
  O: G("01110", "10001", "10001", "10001", "10001", "10001", "01110"),
  P: G("11110", "10001", "10001", "11110", "10000", "10000", "10000"),
  Q: G("01110", "10001", "10001", "10001", "10101", "10010", "01101"),
  R: G("11110", "10001", "10001", "11110", "10100", "10010", "10001"),
  S: G("01111", "10000", "10000", "01110", "00001", "00001", "11110"),
  T: G("11111", "00100", "00100", "00100", "00100", "00100", "00100"),
  U: G("10001", "10001", "10001", "10001", "10001", "10001", "01110"),
  V: G("10001", "10001", "10001", "10001", "10001", "01010", "00100"),
  W: G("10001", "10001", "10001", "10101", "10101", "11011", "10001"),
  X: G("10001", "10001", "01010", "00100", "01010", "10001", "10001"),
  Y: G("10001", "10001", "01010", "00100", "00100", "00100", "00100"),
  Z: G("11111", "00001", "00010", "00100", "01000", "10000", "11111"),
  "0": G("01110", "10001", "10011", "10101", "11001", "10001", "01110"),
  "1": G("00100", "01100", "00100", "00100", "00100", "00100", "01110"),
  "2": G("01110", "10001", "00001", "00010", "00100", "01000", "11111"),
  "3": G("11110", "00001", "00001", "01110", "00001", "00001", "11110"),
  "4": G("00010", "00110", "01010", "10010", "11111", "00010", "00010"),
  "5": G("11111", "10000", "11110", "00001", "00001", "10001", "01110"),
  "6": G("00110", "01000", "10000", "11110", "10001", "10001", "01110"),
  "7": G("11111", "00001", "00010", "00100", "01000", "01000", "01000"),
  "8": G("01110", "10001", "10001", "01110", "10001", "10001", "01110"),
  "9": G("01110", "10001", "10001", "01111", "00001", "00010", "01100"),
  ".": G("00000", "00000", "00000", "00000", "00000", "00110", "00110"),
  ",": G("00000", "00000", "00000", "00000", "00110", "00100", "01000"),
  ":": G("00000", "00110", "00110", "00000", "00110", "00110", "00000"),
  "-": G("00000", "00000", "00000", "11111", "00000", "00000", "00000"),
  "/": G("00001", "00010", "00010", "00100", "01000", "01000", "10000"),
  "'": G("00100", "00100", "01000", "00000", "00000", "00000", "00000"),
  "!": G("00100", "00100", "00100", "00100", "00100", "00000", "00100"),
  "?": G("01110", "10001", "00001", "00010", "00100", "00000", "00100"),
  "&": G("01100", "10010", "10100", "01000", "10101", "10010", "01101"),
  "#": G("01010", "01010", "11111", "01010", "11111", "01010", "01010"),
  "+": G("00000", "00100", "00100", "11111", "00100", "00100", "00000"),
};

export const hasGlyph = (ch: string) => ch.toUpperCase() in GLYPHS;
const glyph = (ch: string) => GLYPHS[ch.toUpperCase()] ?? GLYPHS["?"];

/** Dot columns a line of `chars` characters takes (no trailing spacing column). */
export const columnsFor = (chars: number) => Math.max(0, chars * ADVANCE - 1);

/**
 * Splits text into lines of at most `maxChars` characters at word breaks; a word longer than
 * that is cut. Never returns an empty list, so a blank name still has a line.
 */
export function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    let w = word;
    while (w.length > maxChars) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(w.slice(0, maxChars));
      w = w.slice(maxChars);
    }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= maxChars) line += ` ${w}`;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** Every dot's (column, row) in a block of text lines, in dot units. Lines are 1 dot row apart. */
export function dotPositions(lines: string[]): { x: number; y: number }[] {
  const dots: { x: number; y: number }[] = [];
  lines.forEach((line, li) => {
    [...line].forEach((ch, ci) => {
      glyph(ch).forEach((row, y) => {
        [...row].forEach((bit, x) => {
          if (bit === "1") dots.push({ x: ci * ADVANCE + x, y: li * (ROWS + 2) + y });
        });
      });
    });
  });
  return dots;
}

/** Size of a block of lines in dot units (the SVG's viewBox). Lines are separated by 2 blank rows. */
export function blockSize(lines: string[]): { cols: number; rows: number } {
  return { cols: columnsFor(Math.max(...lines.map((l) => [...l].length), 1)), rows: lines.length * ROWS + (lines.length - 1) * 2 };
}

/**
 * The text as an SVG of round dots. `pitch` is the distance between dot centres in px (share
 * images) or any CSS length for the web, where the SVG is sized by its wrapper instead
 * (`pitch` null: width/height 100%, preserving the aspect ratio).
 */
export function dotMatrix(lines: string[], color: string, pitch: number | null, opacity = 1): ReactElement {
  const { cols, rows } = blockSize(lines);
  const r = 0.42;
  const d = dotPositions(lines)
    .map(({ x, y }) => `M${x + 0.5 - r} ${y + 0.5}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`)
    .join("");
  return h(
    "svg",
    {
      viewBox: `0 0 ${cols} ${rows}`,
      width: pitch === null ? "100%" : Math.round(cols * pitch),
      height: pitch === null ? undefined : Math.round(rows * pitch),
      xmlns: "http://www.w3.org/2000/svg",
      style: pitch === null ? { display: "block" } : undefined,
    },
    h("path", { d, fill: color, fillOpacity: opacity }),
  );
}
