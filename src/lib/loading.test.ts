import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { LOADING_COPY, LOADING_DELAY_MS } from "./loading.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("loading copy is exact and claims no progress", () => {
  assert.equal(LOADING_COPY, "loading your Linear workspace");
  assert.doesNotMatch(LOADING_COPY, /%|\d/);
});

test("delay threshold is between 300 and 500ms", () => {
  assert.ok(LOADING_DELAY_MS >= 300 && LOADING_DELAY_MS <= 500);
});

test("fallback: delayed, timer cleaned up, starts hidden, reuses the boot logo", () => {
  const src = read("../components/wrapped/Loading.tsx");
  assert.match(src, /useState\(false\)/); // server + first client render show nothing: no hydration flicker
  assert.match(src, /setTimeout\(\(\) => setShow\(true\), LOADING_DELAY_MS\)/);
  assert.match(src, /return \(\) => clearTimeout\(timer\)/); // unmount (data ready, navigation, error) cancels it
  assert.match(src, /role="status"/);
  assert.match(src, /<LinearLogo/);
  assert.match(src, /\{LOADING_COPY\}/);
  assert.doesNotMatch(src, /LOAD "|Drive busy/);
});

test("landing and loading share one 17-band logo component", () => {
  assert.match(read("../components/retro/PetLanding.tsx"), /<LinearLogo/);
  const logo = read("../components/retro/LinearLogo.tsx");
  assert.match(logo, /logoRows\(\)/);
  assert.match(logo, /logoSchedule\(false\)/);
});

test("wrapped page streams real stats inside Suspense, with no extra gate", () => {
  const src = read("../app/wrapped/page.tsx");
  assert.match(src, /<Suspense fallback=\{<WrappedLoading \/>\}>/);
  assert.match(src, /await getWrappedStats\(token\)/);
  assert.match(src, /<Story recap=\{recap\} gate \/>/); // the user-gesture Enter screen is kept
  assert.match(src, /LOAD ERROR/); // error fallback kept
});

test("reduced motion makes the logo sweep static", () => {
  const css = read("../app/globals.css");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.boot-line \{ animation: none; \}/);
});
