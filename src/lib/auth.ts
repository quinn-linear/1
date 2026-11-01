import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const STATE_COOKIE = "linear_oauth_state";
export const SESSION_COOKIE = "linear_session";
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
