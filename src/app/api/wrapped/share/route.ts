import { NextRequest, NextResponse } from "next/server";
import { toRecap } from "@/lib/recap";
import { getAccessToken } from "@/lib/session";
import { buildShareLink } from "@/lib/share/link";
import { buildSnapshot, isCardId } from "@/lib/share/snapshot";
import { shareSecret } from "@/lib/share/server";
import { DEFAULT_YEAR, LinearApiError, getWrappedStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

// Per-user response: never cacheable, never shared between cookies.
const HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const MAX_BODY = 256;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: HEADERS });

/**
 * Mints a share link for ONE card of the signed-in viewer's recap. The client
 * only names the card; the server decides what data goes in the snapshot, so a
 * caller can't smuggle extra content into a signed link.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return json({ error: "forbidden" }, 403);

  const token = await getAccessToken();
  if (!token) return json({ error: "unauthenticated" }, 401);

  const secret = shareSecret();
  if (!secret) return json({ error: "not_configured" }, 503);

  let card: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: "invalid_request" }, 413);
    card = (JSON.parse(raw) as { card?: unknown } | null)?.card;
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  if (!isCardId(card)) return json({ error: "invalid_card" }, 400);

  try {
    const recap = toRecap(await getWrappedStats(token, DEFAULT_YEAR));
    return json(buildShareLink(buildSnapshot(card, recap), secret));
  } catch (err) {
    const kind = err instanceof LinearApiError ? err.kind : "unknown";
    return json({ error: kind }, kind === "unauthorized" ? 401 : kind === "rate_limited" ? 429 : 502);
  }
}
