type Env = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Turns a configured value into a bare origin, or null if it isn't safe to
 * publish in metadata: only https (http only for localhost), no credentials,
 * and any path/query/hash is dropped. A missing scheme (Vercel's `VERCEL_URL`
 * style) is treated as https.
 */
export function normalizeOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    if (url.username || url.password) return null;
    if (url.protocol === "https:") return url.origin;
    if (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname)) return url.origin;
    return null;
  } catch {
    return null;
  }
}

/**
 * The public origin used for canonical URLs and Open Graph images. Never taken
 * from request headers, so a spoofed Host can't change what crawlers see.
 * Order: explicit `SITE_URL`, the Vercel production domain (production
 * deployments only), this deployment's own `VERCEL_URL`, any Vercel production
 * domain, then localhost for development.
 */
export function resolveSiteOrigin(env: Env = process.env): string {
  const onVercelProduction = env.VERCEL_ENV === "production";
  const candidates = [
    env.SITE_URL,
    onVercelProduction ? env.VERCEL_PROJECT_PRODUCTION_URL : undefined,
    env.VERCEL_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
  ];
  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate);
    if (origin) return origin;
  }
  const port = /^\d{1,5}$/.test(env.PORT ?? "") ? env.PORT : "3000";
  return `http://localhost:${port}`;
}
