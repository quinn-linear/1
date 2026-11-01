# Linear Wrapped

A Spotify Wrapped-style yearly recap for Linear (calendar year 2026). Built with Next.js (App Router), TypeScript and Tailwind CSS, deployable on Vercel.

## Status

Step 7 (final) adds the loading screen, empty/sparse states and share/landing metadata (below), on top of step 6 (merged in #6).

Step 6 adds per-card sharing (below), on top of step 5 (merged in #5).

Step 5 adds the `/wrapped` story cards (below), on top of step 4 (merged in #4).

Step 4 adds archetype classification on top of the step 3 stats engine (merged in #3).

Step 3: server-side stats engine on top of the step 2 read-only OAuth sign-in. `/wrapped` is still a placeholder; archetypes, cards and sharing come in later PRs.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm test           # stats engine unit tests (node:test, Node 22.18+)
npm run build
```

## Linear OAuth setup

1. Create an OAuth application at https://linear.app/settings/api/applications/new.
2. Add callback URLs for each origin you use:
   - `http://localhost:3000/api/auth/linear/callback`
   - `https://<your-vercel-domain>/api/auth/linear/callback`
3. Copy `.env.example` to `.env.local` and set `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET` (also set them in Vercel project env vars).

Only the `read` scope is requested. Flow: `/api/auth/linear` sets a random `state` cookie and redirects to Linear; `/api/auth/linear/callback` verifies `state`, exchanges the code server-side, and stores the access token AES-256-GCM encrypted in an httpOnly, SameSite=Lax (Secure in production) cookie that lasts at most 24h, then redirects to `/wrapped`. The token is never sent to client code or logged, and nothing is stored in a database. Redirect targets are fixed paths, not user input.

## Stats engine

`src/lib/stats` builds a typed JSON recap (`WrappedStats`, see `types.ts`) for a calendar year (default 2026, `getWrappedStats(token, year)`). `/wrapped` computes it server-side on the first visit after login, and `GET /api/wrapped/stats[?year=YYYY]` returns it for the signed-in user (`private, no-store`). Nothing is stored: results live only in a 10-minute in-memory memo keyed by a hash of the token, never in cookies or a database.

Semantics:
- "Closed" = issue currently assigned to the viewer with `completedAt` in the year. Canceled issues are excluded.
- Days, hours, weekdays and months use the viewer's Linear `timezone` (UTC if unset/invalid). The year is bounded in local time: the API query is padded by 14h and results are filtered by local year.
- Streak = longest run of consecutive local calendar days with at least one closed issue.
- Biggest project / label of year = most closed issues / most-used label on closed issues. Ties go to the earliest month or lowest id.
- Top collaborator = person sharing the most closed issues with the viewer as creator/assignee.
- Oldest open issue = earliest `createdAt` among assigned issues not completed or canceled.

Limitations (also returned in `limitations`): `completedAt` is the latest close time; issues reassigned away from the viewer are not counted; comments, mentions and subscribers are not used for collaboration; integrations are workspace-level and may be `unavailable` under the `read` scope; each list is capped at 5000 issues (`truncated: true` if hit). Requests retry 429/5xx/`RATELIMITED` with bounded backoff (honoring `Retry-After`/rate-limit reset, max 4 retries, 15s per wait).

## Deploy

Import the repo in Vercel and set the two env vars; the Next.js preset needs no other config.

## Archetypes

`classifyArchetype` (`src/lib/stats/archetype.ts`) is a pure function over the viewer-local `completions` counts; the result is returned as `archetype` in the stats payload (and its id as `summary.archetype`) with display name, tagline, description and the counts behind the decision. No extra API calls.

- Fewer than 10 closed issues: Steady Builder (`insufficient-data`).
- A trait qualifies at or above its share of all completions: Night Owl (local hour >= 21) 35%, Early Bird (hour < 9) 35%, Weekend Warrior (Sat/Sun) 20%, Friday Shipper 30%.
- Several qualify: the one furthest past its own threshold wins; exact ties go Night Owl, Early Bird, Weekend Warrior, Friday Shipper.
- None qualify: Steady Builder.

Thresholds are judgment calls (no spec was given) and live in `THRESHOLD_PERCENT`. Same completion-time and 5000-issue-cap caveats as the stats apply; the live Linear schema has still not been verified.

## Story cards

`/wrapped` renders an 11-card, full-screen story (Framer Motion): intro, issues closed, archetype, peak month, longest streak, biggest project, top collaborator, integrations, the one that got away, label of the year, summary. Navigate by tapping (left third goes back), swiping, arrow keys / space, the prev/next buttons, or the progress segments. Cards do not auto-advance. Reduced motion is respected (`MotionConfig reducedMotion="user"`, no count-up or orbit).

The server page computes `WrappedStats` and passes only `toRecap(stats)` (`src/lib/recap.ts`) to the client: no ids, raw timestamps or tokens. Missing metrics render a short note, never made-up data. Honest caveats are on the cards: collaborator is a creator/assignee proxy, integrations are workspace-level (or "can't see these" when unreadable), and counts may be undercounts when `truncated`. Dedicated empty/loading states, share images and meta tags are later steps.

## Sharing (step 6)

Every story card has a **Share** button that opens a panel with: Share on X (opens X's own composer with prefilled text; nothing is posted for you), Copy link, Download image (1080x1920) and Download wide image (1200x630). Nothing is created until the panel opens, and sharing one card never publishes the rest of the recap.

**Stateless links, no database.** `POST /api/wrapped/share {card}` (signed-in only, `private, no-store`) builds a snapshot of just that card on the server from the safe `Recap` and returns `/s/<token>`. The token is `base64url(JSON).hmac`: the card's minimum data, validated strictly on every read (exact keys, ranges, text cleaned of control/bidi characters and length-capped) and HMAC-signed (key derived from `LINEAR_CLIENT_SECRET` via a separate HKDF context) so nobody can mint arbitrary cards on our domain. `/s/<token>` (page) and `/s/<token>/image?f=story|og[&download=1]` are public, never read cookies, and only depend on the token, so images are cached `public, immutable`.

What a link contains per card: year plus that card's displayed values. Named cards (project, collaborator, issue title, label, integration names) are flagged in the panel with an explicit list of what becomes public and a required checkbox. Never included: tokens, ids, issue identifiers/URLs, avatars, timestamps, the viewer's name, or raw stats. The summary card shares counts and archetype only, not project/collaborator/label/issue names.

Limits and honest limitations:
- The token is capped at 1,024 characters (worst case is about 600), so `/s/<token>` stays well under the ~2,000-character URL limit. Names are capped at 40 characters, issue titles at 80 (truncated with an ellipsis), and at most 8 integration names.
- The data lives in the link itself, so a link **cannot be revoked or expired**; anyone who has it can view that card. Rotating `LINEAR_CLIENT_SECRET` invalidates all links (and sessions).
- Links are not anonymous by themselves: a named card shows whatever names it contains.
- Images use `next/og` (Next's bundled `@vercel/og`) with the bundled Geist Regular font (no bold weight). To avoid render-time requests to emoji/font CDNs, image text is limited to Latin characters; other characters show as `?` in the image (the shared page and link text keep them).
- Image generation is CPU-bound; abuse is bounded by signature checks (only app-minted tokens render) and CDN caching, but there is no rate limiter.
- Card caveats carry over: counts cap at 5000 issues (`truncated` shows an undercount note), collaborator is a creator/assignee proxy, and integrations are workspace-level.

## Loading, empty states and metadata (step 7)

**Loading.** `/wrapped` checks the session cookie first (signed-out visitors redirect immediately), then streams: the stats crawl runs inside a `<Suspense>` boundary, so a playful loading screen is sent right away and swapped for the story when stats are ready. It is indeterminate on purpose (we can't know how far the Linear calls are), so there is no progress bar or percentage; the cycling lines only say what is being looked at. Motion is CSS-only, off under `prefers-reduced-motion` (the lines also stop cycling), and screen readers get one `role="status"` message.

**Empty and sparse.** Zero closed issues shows a dedicated page instead of 11 empty cards: it explains how "closed" is counted, keeps the real metrics we do have (oldest open issue, workspace integrations, undercount note if truncated) and links to Open Linear, `/wrapped?cards=1` (the full story anyway) and Sign out. Fewer than 10 closed issues (the same cutoff as the archetype's "insufficient data") shows the full story with an honest note on the intro card. Nothing is estimated.

**Metadata.** Absolute URLs come from `SITE_URL` (https only, or http on localhost; set it at build time for a custom domain), else the Vercel production domain, else the deployment's `VERCEL_URL`, else `http://localhost:3000`. They are never derived from request headers. The landing page has a canonical URL and Open Graph/Twitter tags with a generic image (`/opengraph-image`, the intro card, no user data). `/s/<token>` builds its title, description, canonical and `og:`/`twitter:` tags (wide 1200x630 image) only after the token's length and signature verify; malformed or forged links get a generic "Link not found" title and `noindex`, and the page itself returns 404. Shared pages stay `noindex` (previews work, search indexing doesn't). `/wrapped` metadata is static, generic and `noindex, nofollow`; nothing about the viewer goes into it. Vercel preview deployments are often behind Vercel authentication, so crawlers may not be able to fetch preview URLs.

Not changed (earlier limitations stand): 5000-issue list cap, collaborator as a creator/assignee proxy, workspace-level integrations, non-revocable share links, and `?` for non-Latin characters in share images.
