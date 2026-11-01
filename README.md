# Linear Wrapped

A Spotify Wrapped-style yearly recap for Linear (calendar year 2026). Built with Next.js (App Router), TypeScript and Tailwind CSS, deployable on Vercel.

## Status

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
