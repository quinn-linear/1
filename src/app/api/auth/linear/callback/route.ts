import { NextRequest, NextResponse } from "next/server";
import {
  CALLBACK_PATH,
  LINEAR_TOKEN_URL,
  SESSION_COOKIE,
  STATE_COOKIE,
  getCredentials,
  sealSession,
  sessionCookieOptions,
  stateCookieOptions,
  statesMatch,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// Redirect targets are fixed paths (never user-supplied) so this can't be an open redirect.
function fail(origin: string, error: string) {
  const response = NextResponse.redirect(new URL(`/?error=${error}`, origin));
  response.cookies.set(STATE_COOKIE, "", { ...stateCookieOptions(), maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const creds = getCredentials();
  if (!creds) return fail(origin, "config");

  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  if (!statesMatch(expectedState, searchParams.get("state"))) return fail(origin, "state");

  const code = searchParams.get("code");
  if (searchParams.get("error") || !code) return fail(origin, "denied");

  let token: { access_token?: unknown; expires_in?: unknown };
  try {
    const res = await fetch(LINEAR_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: origin + CALLBACK_PATH,
        grant_type: "authorization_code",
        code,
      }),
      cache: "no-store",
    });
    if (!res.ok) return fail(origin, "token");
    token = await res.json();
  } catch {
    return fail(origin, "token");
  }
  if (typeof token.access_token !== "string" || !token.access_token) return fail(origin, "token");

  const expiresIn = typeof token.expires_in === "number" ? token.expires_in : undefined;
  const response = NextResponse.redirect(new URL("/wrapped", origin));
  response.cookies.set(
    SESSION_COOKIE,
    sealSession(token.access_token, creds.clientSecret),
    sessionCookieOptions(expiresIn),
  );
  response.cookies.set(STATE_COOKIE, "", { ...stateCookieOptions(), maxAge: 0 });
  return response;
}
