import { NextRequest, NextResponse } from "next/server";
import {
  CALLBACK_PATH,
  LINEAR_AUTHORIZE_URL,
  LINEAR_SCOPE,
  STATE_COOKIE,
  createState,
  getCredentials,
  stateCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const creds = getCredentials();
  if (!creds) return NextResponse.redirect(new URL("/?error=config", origin));

  const state = createState();
  const url = new URL(LINEAR_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: origin + CALLBACK_PATH,
    response_type: "code",
    scope: LINEAR_SCOPE,
    state,
  }).toString();

  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, stateCookieOptions());
  return response;
}
