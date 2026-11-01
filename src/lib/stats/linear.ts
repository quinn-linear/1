export const LINEAR_API_URL = "https://api.linear.app/graphql";

export type LinearErrorKind = "unauthorized" | "rate_limited" | "upstream" | "graphql" | "network";

/** Messages never contain the access token or raw response bodies. */
export class LinearApiError extends Error {
  kind: LinearErrorKind;
  constructor(kind: LinearErrorKind, message: string) {
    super(message);
    this.name = "LinearApiError";
    this.kind = kind;
  }
}

export interface ClientOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Retries after the first attempt. */
  maxRetries?: number;
  /** Longest single wait; a longer requested wait fails instead. */
  maxWaitMs?: number;
  baseDelayMs?: number;
}

interface GraphQLBody {
  data?: unknown;
  errors?: { message?: string; extensions?: { code?: string } }[];
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function retryDelay(res: Response | null, attempt: number, o: Required<ClientOptions>): number {
  const retryAfter = Number(res?.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  // Linear reports the bucket reset as epoch milliseconds.
  const reset = Number(res?.headers.get("x-ratelimit-requests-reset"));
  if (Number.isFinite(reset) && reset > 0) return Math.max(0, reset - o.now()) + 250;
  return o.baseDelayMs * 2 ** attempt;
}

/**
 * Returns a function that runs GraphQL operations against Linear with the
 * given OAuth token. Retries 429/5xx/network errors and RATELIMITED GraphQL
 * errors with bounded backoff.
 */
export function createLinearClient(token: string, options: ClientOptions = {}) {
  const o: Required<ClientOptions> = {
    fetch: options.fetch ?? fetch,
    sleep: options.sleep ?? defaultSleep,
    now: options.now ?? Date.now,
    maxRetries: options.maxRetries ?? 4,
    maxWaitMs: options.maxWaitMs ?? 15_000,
    baseDelayMs: options.baseDelayMs ?? 500,
  };

  return async function query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      let res: Response | null = null;
      let failure: LinearApiError;
      try {
        res = await o.fetch(LINEAR_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ query: document, variables }),
          cache: "no-store",
        });
        let body: GraphQLBody | null = null;
        try {
          body = (await res.json()) as GraphQLBody;
        } catch {
          // Non-JSON body: handled via status below.
        }
        const codes = body?.errors?.map((e) => e.extensions?.code) ?? [];

        if (res.status === 401 || codes.includes("AUTHENTICATION_ERROR")) {
          throw new LinearApiError("unauthorized", "Linear rejected the access token");
        }
        if (res.status === 429 || codes.includes("RATELIMITED")) {
          failure = new LinearApiError("rate_limited", "Linear rate limit exceeded");
        } else if (res.status >= 500) {
          failure = new LinearApiError("upstream", `Linear API returned ${res.status}`);
        } else if (!res.ok || body?.errors?.length || !body?.data) {
          // Not retryable: the request itself is bad. Don't echo error text.
          throw new LinearApiError("graphql", `Linear API request failed (${res.status})`);
        } else {
          return body.data as T;
        }
      } catch (err) {
        if (err instanceof LinearApiError) {
          if (err.kind === "unauthorized" || err.kind === "graphql") throw err;
          failure = err;
        } else {
          failure = new LinearApiError("network", "Could not reach the Linear API");
        }
      }

      if (attempt >= o.maxRetries) throw failure;
      const delay = retryDelay(res, attempt, o);
      if (delay > o.maxWaitMs) throw failure;
      await o.sleep(delay);
    }
  };
}

export type LinearClient = ReturnType<typeof createLinearClient>;

interface Connection<N> {
  nodes: N[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

/**
 * Follows `pageInfo` until exhausted or `maxPages` is reached. `select` picks the
 * connection out of the response; the document must declare `$after: String`.
 */
export async function paginate<N, R>(
  client: LinearClient,
  document: string,
  variables: Record<string, unknown>,
  select: (data: R) => Connection<N> | null | undefined,
  maxPages: number,
): Promise<{ nodes: N[]; truncated: boolean }> {
  const nodes: N[] = [];
  let after: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const data: R = await client<R>(document, { ...variables, after });
    const conn = select(data);
    if (!conn) throw new LinearApiError("graphql", "Unexpected Linear API response shape");
    nodes.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) return { nodes, truncated: false };
    after = conn.pageInfo.endCursor;
  }
  return { nodes, truncated: true };
}
