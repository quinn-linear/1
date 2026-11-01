import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import { fixtureRecap } from "../fixtures.ts";
import type { ArchetypeId } from "../stats/types.ts";
import { ARCHETYPE_ART } from "./archetypeArt.ts";
import { loadShareArt } from "./artFile.ts";
import { renderCard } from "./image.ts";
import { buildSnapshot, type Snapshot } from "./snapshot.ts";

const IDS: ArchetypeId[] = ["early-bird", "friday-shipper", "weekend-warrior", "steady-builder", "night-owl"];
const pub = (p: string) => new URL(`../../../public/${p.replace(/^\//, "")}`, import.meta.url);

test("all five archetypes map to their own shipped, optimized local files", () => {
  assert.deepEqual(Object.keys(ARCHETYPE_ART).sort(), [...IDS].sort(), "no new archetypes");
  const hashes = new Set<string>();
  for (const id of IDS) {
    const art = ARCHETYPE_ART[id];
    assert.equal(art.web, `/archetypes/${id}.webp`);
    assert.equal(art.share, `archetypes/share/${id}.jpg`);
    const web = readFileSync(pub(art.web));
    const share = readFileSync(pub(art.share));
    assert.equal(web.subarray(0, 4).toString(), "RIFF");
    assert.equal(web.subarray(8, 12).toString(), "WEBP");
    assert.deepEqual([...share.subarray(0, 3)], [0xff, 0xd8, 0xff], `${id} share is a JPEG`);
    assert.ok(statSync(pub(art.web)).size < 500_000 && statSync(pub(art.share)).size < 500_000, `${id} is optimized (the originals were ~4 MB)`);
    assert.ok(art.alt.length > 40 && art.alt.toLowerCase().includes(id.split("-")[0]), `${id} has a descriptive alt`);
    hashes.add(createHash("sha256").update(web).digest("hex"));
    hashes.add(createHash("sha256").update(share).digest("hex"));
  }
  assert.equal(hashes.size, 10, "every file is different: no archetype reuses another's art");
});

test("share art loads from disk by archetype id only, as a data URI", async () => {
  const seen = new Set<string>();
  for (const id of IDS) {
    const uri = await loadShareArt(id);
    assert.ok(uri?.startsWith("data:image/jpeg;base64,"), id);
    seen.add(uri!);
  }
  assert.equal(seen.size, 5);
  assert.equal(await loadShareArt("../../etc/passwd" as ArchetypeId), null, "an unknown id never reaches the file system");
});

const snap = (card: "archetype" | "summary" | "total", a: ArchetypeId): Snapshot => {
  const s = buildSnapshot(card, { ...fixtureRecap("full"), archetype: { ...fixtureRecap("full").archetype, id: a } });
  return s;
};

test("archetype and summary images embed the supplied art at both sizes; other cards never do", () => {
  const ART = "data:image/jpeg;base64,QUJD";
  for (const f of ["story", "og"] as const) {
    for (const card of ["archetype", "summary"] as const) {
      const json = JSON.stringify(renderCard(snap(card, "night-owl"), f, ART));
      assert.ok(json.includes(ART), `${card} ${f} shows the art`);
      assert.match(json, /"objectFit":"contain"/, `${card} ${f} is contained, never cropped`);
      assert.doesNotMatch(json, /disk-sigil/, `${card} ${f} replaces the generated sigil`);
    }
    assert.ok(!JSON.stringify(renderCard(snap("total", "night-owl"), f, ART)).includes(ART), `total ${f} is not an archetype card`);
    assert.ok(JSON.stringify(renderCard(snap("archetype", "night-owl"), f, null)).length > 100, "still renders without art");
  }
});

test("the shared snapshot only carries the archetype id (public art needs nothing else)", () => {
  const s = snap("archetype", "early-bird");
  assert.deepEqual(Object.keys(s).sort(), ["a", "c", "i", "v", "y"]);
});

test("each archetype's image uses its own art", async () => {
  for (const id of IDS) {
    const uri = (await loadShareArt(id))!;
    for (const card of ["archetype", "summary"] as const) assert.ok(JSON.stringify(renderCard(snap(card, id), "story", uri)).includes(uri.slice(-40)), `${card} ${id}`);
  }
});
