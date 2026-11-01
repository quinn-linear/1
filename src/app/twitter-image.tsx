import { ImageResponse } from "next/og";
import { renderCard } from "@/lib/share/image";
import { IMAGE_FORMATS } from "@/lib/share/theme";
import { DEFAULT_YEAR } from "@/lib/stats";

export const alt = `Linear Wrapped ${DEFAULT_YEAR}: your year in Linear, wrapped.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Generic landing preview: the intro card, no user data. */
export default function Image() {
  return new ImageResponse(renderCard({ v: 1, y: DEFAULT_YEAR, c: "intro" }, "og"), IMAGE_FORMATS.og);
}
