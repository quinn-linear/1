import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/session";
import { DEFAULT_YEAR, LinearApiError, getWrappedStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Authenticated recap JSON for the signed-in viewer. Optional `?year=YYYY`. */
export async function GET(request: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });

  const raw = request.nextUrl.searchParams.get("year");
  const year = raw === null ? DEFAULT_YEAR : Number(raw);
  if (!Number.isInteger(year) || year < 2012 || year > new Date().getUTCFullYear()) {
    return NextResponse.json({ error: "invalid_year" }, { status: 400, headers: NO_STORE });
  }

  try {
    return NextResponse.json(await getWrappedStats(token, year), { headers: NO_STORE });
  } catch (err) {
    const kind = err instanceof LinearApiError ? err.kind : "unknown";
    const status = kind === "unauthorized" ? 401 : kind === "rate_limited" ? 429 : 502;
    return NextResponse.json({ error: kind }, { status, headers: NO_STORE });
  }
}
