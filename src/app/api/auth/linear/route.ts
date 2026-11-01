import { NextRequest, NextResponse } from "next/server";
import { RECONNECT_COOKIE, STATE_COOKIE, buildAuthorizeUrl, createState, getCredentials, reconnectCookieOptions, stateCookieOptions, wantsWorkspaceChoice } from "@/lib/auth";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const creds = getCredentials();
  if (!creds) return NextResponse.redirect(new URL("/?error=config", origin));

  const state = createState();
  // After signing out (or with ?switch=1) Linear's consent screen is shown again so another workspace can be chosen.
  const chooseWorkspace = wantsWorkspaceChoice(request.cookies.get(RECONNECT_COOKIE)?.value, searchParams.get("switch"));
  const response = NextResponse.redirect(buildAuthorizeUrl({ clientId: creds.clientId, origin, state, chooseWorkspace }));
  response.cookies.set(STATE_COOKIE, state, stateCookieOptions());
  // The marker is spent once the consent screen has been requested.
  if (chooseWorkspace) response.cookies.set(RECONNECT_COOKIE, "", { ...reconnectCookieOptions(), maxAge: 0 });
  return response;
}
