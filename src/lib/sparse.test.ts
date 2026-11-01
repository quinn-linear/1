import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_COMPLETIONS } from "./stats/archetype.ts";
import { COUNTING_RULE, LOADING_MESSAGES, SPARSE_NOTE, nextLoadingIndex, recapDensity } from "./sparse.ts";

const recap = (totalClosed: number) => ({ totalClosed, archetype: { insufficientData: totalClosed < MIN_COMPLETIONS } }) as never;

test("density: zero is empty, below the archetype cutoff is sparse, else full", () => {
  assert.equal(recapDensity(recap(0)), "empty");
  assert.equal(recapDensity(recap(1)), "sparse");
  assert.equal(recapDensity(recap(MIN_COMPLETIONS - 1)), "sparse");
  assert.equal(recapDensity(recap(MIN_COMPLETIONS)), "full");
});

test("sparse note states the real count and year, with correct plural", () => {
  assert.match(SPARSE_NOTE(1, 2026), /1 closed issue\./);
  assert.match(SPARSE_NOTE(7, 2026), /7 closed issues\./);
  assert.match(SPARSE_NOTE(7, 2026), /2026/);
  assert.match(COUNTING_RULE(2026), /completed in 2026/);
});

test("loading messages cycle and never claim progress", () => {
  assert.ok(LOADING_MESSAGES.length > 1);
  let i = 0;
  for (let n = 0; n < LOADING_MESSAGES.length; n++) i = nextLoadingIndex(i);
  assert.equal(i, 0);
  assert.equal(nextLoadingIndex(0, 0), 0);
  for (const m of LOADING_MESSAGES) assert.doesNotMatch(m, /%|\d|done|complete|almost/i, m);
});
