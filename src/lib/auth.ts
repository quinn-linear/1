import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const STATE_COOKIE = "linear_oauth_state";
export const SESSION_COOKIE = "linear_session";
/** Marker (no data) set by sign out: the next connect must show Linear's consent screen so another workspace can be picked. */
export const RECONNECT_COOKIE = "linear_reconnect";
export const START_PATH = "/api/auth/linear";
export const CALLBACK_PATH = "/api/auth/linear/callback";

export const LINEAR_AUTHORIZE_URL = "https://linear.app/oauth/authorize";
export const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";
/** Read-only access: never request write/admin scopes. */
export const LINEAR_SCOPE = "read";

const STATE_MAX_AGE = 10 * 60;
const SESSION_MAX_AGE = 24 * 60 * 60;

export function getCredentials() {
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function cookieOptions(maxAge: number, path = "/") {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path,
    maxAge,
  };
}

const RECONNECT_MAX_AGE = 60 * 60;
export const reconnectCookieOptions = () => cookieOptions(RECONNECT_MAX_AGE, START_PATH);

export const stateCookieOptions = () => cookieOptions(STATE_MAX_AGE, CALLBACK_PATH);

export function sessionCookieOptions(expiresInSeconds?: number) {
  const ttl = expiresInSeconds && expiresInSeconds > 0 ? expiresInSeconds : SESSION_MAX_AGE;
  return cookieOptions(Math.min(ttl, SESSION_MAX_AGE));
}

export function createState() {
  return randomBytes(32).toString("base64url");
}

export function statesMatch(expected: string | undefined, actual: string | null) {
  if (!expected || !actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The access token is encrypted (AES-256-GCM) before it goes into the cookie, so
// it is opaque and tamper-evident even though the cookie is httpOnly. The key is
// derived from LINEAR_CLIENT_SECRET, so no extra env var is needed.
function sessionKey(clientSecret: string) {
  return Buffer.from(
    hkdfSync("sha256", clientSecret, "linear-wrapped", "session-cookie", 32),
  );
}

export function sealSession(token: string, clientSecret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(clientSecret), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

export function openSession(value: string, clientSecret: string): string | null {
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", sessionKey(clientSecret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * The Linear authorize URL. `prompt=consent` is Linear's documented way to show the
 * consent screen every time, even when all scopes were granted before, which is
 * what lets a person connect a different workspace. Without it Linear approves a
 * repeat request silently and the same workspace comes straight back.
 * Scope stays read-only and the redirect URI is the fixed callback path.
 */
export function buildAuthorizeUrl({ clientId, origin, state, chooseWorkspace }: { clientId: string; origin: string; state: string; chooseWorkspace: boolean }) {
  const params: Record<string, string> = {
    client_id: clientId,
    redirect_uri: origin + CALLBACK_PATH,
    response_type: "code",
    scope: LINEAR_SCOPE,
    state,
  };
  if (chooseWorkspace) params.prompt = "consent";
  const url = new URL(LINEAR_AUTHORIZE_URL);
  url.search = new URLSearchParams(params).toString();
  return url;
}

/** Consent is forced after a sign out (cookie) or when the visitor explicitly asks to switch (`?switch=1`). */
export function wantsWorkspaceChoice(reconnectCookie: string | undefined, switchParam: string | null) {
  return reconnectCookie === "1" || switchParam === "1";
}

type CookieSpec = { name: string; value: string; options: ReturnType<typeof cookieOptions> };

/**
 * What sign out sets: the session and any half-finished OAuth state are cleared,
 * and the reconnect marker makes the next connect show Linear's consent screen.
 * The marker carries no data. The Linear token itself is not revoked here.
 */
export function logoutCookies(): CookieSpec[] {
  return [
    { name: SESSION_COOKIE, value: "", options: { ...sessionCookieOptions(), maxAge: 0 } },
    { name: STATE_COOKIE, value: "", options: { ...stateCookieOptions(), maxAge: 0 } },
    { name: RECONNECT_COOKIE, value: "1", options: reconnectCookieOptions() },
  ];
}
