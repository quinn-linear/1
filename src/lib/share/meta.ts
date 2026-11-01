import type { Metadata } from "next";
import { describe } from "./copy.ts";
import { decodeToken } from "./snapshot.ts";
import { IMAGE_FORMATS, imageQuery } from "./theme.ts";

const SITE_NAME = "Linear Wrapped";
const TITLE_MAX = 70;
const DESCRIPTION_MAX = 200;

const clip = (text: string, max: number) => {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
};
const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();
const noPeriod = (text: string) => text.replace(/\.$/, "");

/** Not found / malformed / unsigned: nothing about the link is revealed, and nothing is indexed. */
export const UNAVAILABLE_METADATA: Metadata = {
  title: "Link not found",
  robots: { index: false, follow: false },
};

/**
 * Preview metadata for `/s/<token>`. The token is length-checked and
 * signature-verified before any URL is built from it, so a malformed or forged
 * link never reaches crawlers' `og:` tags; it gets `UNAVAILABLE_METADATA`.
 * All URLs are absolute and built from the configured `origin`, and the image
 * is the wide 1200x630 route. Shared pages stay `noindex`: previews work, search
 * indexing doesn't.
 */
export function shareMetadata(token: string, secret: string | null, origin: string): Metadata {
  const snapshot = secret ? decodeToken(token, secret) : null;
  if (!snapshot) return UNAVAILABLE_METADATA;

  const copy = describe(snapshot);
  const headline = [copy.big, copy.headline].filter(Boolean).join(" ");
  const title = clip(oneLine(`${copy.kicker}: ${noPeriod(headline)}`), TITLE_MAX);
  const description = clip(
    oneLine([copy.body, `Get your own Linear Wrapped ${snapshot.y}.`].filter(Boolean).join(" ")),
    DESCRIPTION_MAX,
  );
  const url = `${origin}/s/${token}`;
  const { width, height } = IMAGE_FORMATS.og;
  const image = `${url}/image?${imageQuery("og")}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: false },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url,
      images: [{ url: image, width, height, alt: copy.alt, type: "image/png" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [{ url: image, alt: copy.alt }] },
  };
}
