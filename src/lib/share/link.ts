import { disclosure, describe, shareText } from "./copy.ts";
import { imageQuery } from "./theme.ts";
import { encodeSnapshot, type Snapshot } from "./snapshot.ts";

/** Response of `POST /api/wrapped/share`. Paths are relative; the client adds its own origin. */
export interface ShareLink {
  path: string;
  storyImagePath: string;
  wideImagePath: string;
  text: string;
  alt: string;
  reveals: string[];
  /** Names something that could identify people or work (project, colleague, issue title, ...). */
  sensitive: boolean;
  filename: string;
}

export function buildShareLink(snapshot: Snapshot, secret: string): ShareLink {
  const token = encodeSnapshot(snapshot, secret);
  const path = `/s/${token}`;
  const { items, sensitive } = disclosure(snapshot);
  return {
    path,
    storyImagePath: `${path}/image?${imageQuery("story")}`,
    wideImagePath: `${path}/image?${imageQuery("og")}`,
    text: shareText(snapshot),
    alt: describe(snapshot).alt,
    reveals: items,
    sensitive,
    filename: `linear-wrapped-${snapshot.y}-${snapshot.c}`,
  };
}
