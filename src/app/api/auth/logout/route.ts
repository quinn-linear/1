import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  // 303 so the browser follows the redirect with GET.
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
