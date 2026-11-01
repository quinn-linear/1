import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getCredentials, logoutCookies, openSession } from "@/lib/auth";
import { forgetWrappedStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * Ends this app's session only: the cookie is cleared and the in-memory stats for
 * that token are dropped. The Linear token is not revoked and the visitor stays
 * signed in to Linear itself. A marker cookie makes the next connect show
 * Linear's consent screen, so another workspace can be chosen.
 */
export function POST(request: NextRequest) {
  const creds = getCredentials();
  const sealed = request.cookies.get(SESSION_COOKIE)?.value;
  const token = creds && sealed ? openSession(sealed, creds.clientSecret) : null;
  if (token) forgetWrappedStats(token);

  // 303 so the browser follows the redirect with GET.
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
  response.headers.set("Cache-Control", "no-store");
  for (const { name, value, options } of logoutCookies()) response.cookies.set(name, value, options);
  return response;
}
