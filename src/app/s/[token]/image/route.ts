import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { renderCard } from "@/lib/share/image";
import { decodeToken } from "@/lib/share/snapshot";
import { shareSecret } from "@/lib/share/server";
import { IMAGE_FORMATS, IMAGE_VERSION, parseFormat } from "@/lib/share/theme";

export const dynamic = "force-dynamic";

const fail = (status: number, message: string) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/**
 * Public share image for one signed snapshot. No login, no cookies read. Input
 * is bounded: the token is length-checked and signature-verified before it's
 * decoded, `f` must be `story` or `og`, and no remote URL is ever fetched.
 * Output depends only on the token and design version, so it is safe to cache publicly.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const params_ = request.nextUrl.searchParams;
  const format = parseFormat(params_.get("f"));
  const download = params_.get("download");
  // `r` is the design version: absent on links minted before versioning (still served, with the current design), otherwise it must be current.
  const version = params_.get("r");
  if (!format || (download !== null && download !== "1") || (version !== null && version !== IMAGE_VERSION)) return fail(400, "Bad request");

  const secret = shareSecret();
  if (!secret) return fail(503, "Sharing is not configured");
  const snapshot = decodeToken(token, secret);
  if (!snapshot) return fail(404, "Not found");

  // Immutable only when the URL pins the design version; unversioned legacy URLs must revalidate so a redesign can't stay stuck in caches.
  const cache = version ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate";
  const headers: Record<string, string> = { "Cache-Control": cache, "X-Content-Type-Options": "nosniff" };
  if (download) headers["Content-Disposition"] = `attachment; filename="linear-wrapped-${snapshot.y}-${snapshot.c}-${format}.png"`;
  return new ImageResponse(renderCard(snapshot, format), { ...IMAGE_FORMATS[format], headers });
}
