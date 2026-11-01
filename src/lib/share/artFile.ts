import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ARCHETYPE_ART } from "./archetypeArt.ts";
import type { ArchetypeId } from "../stats/types.ts";

const cache = new Map<ArchetypeId, string>();

/**
 * The share image for an archetype as a data URI, read from the app's own
 * `public/archetypes/share` (never a URL). The id comes from a verified
 * snapshot and is looked up in a fixed table, so no request value ever reaches
 * the file path. Null if the file can't be read: the image then falls back to
 * the generated sigil rather than failing.
 */
export async function loadShareArt(id: ArchetypeId): Promise<string | null> {
  const hit = cache.get(id);
  if (hit) return hit;
  const art = ARCHETYPE_ART[id];
  if (!art) return null;
  try {
    const bytes = await readFile(join(process.cwd(), "public", art.share));
    const uri = `data:image/jpeg;base64,${bytes.toString("base64")}`;
    cache.set(id, uri);
    return uri;
  } catch {
    return null;
  }
}
