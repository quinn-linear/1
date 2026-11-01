import { cookies } from "next/headers";
import { SESSION_COOKIE, getCredentials, openSession } from "./auth";

/** Returns the Linear access token for the current visitor, or null. Server-only. */
export async function getAccessToken() {
  const creds = getCredentials();
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!creds || !value) return null;
  return openSession(value, creds.clientSecret);
}
