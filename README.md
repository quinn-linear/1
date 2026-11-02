# Linear Wrapped

A Spotify Wrapped-style yearly recap for Linear (calendar year 2026). Built with Next.js (App Router), TypeScript and Tailwind CSS, deployable on Vercel.

## Status

Visual redesign (on top of step 7, merged in #7): near-black, Linear-style dark UI with a per-card accent, abstract data charts (activity ring, scrubbable monthly area chart, streak day-chain, share meters, age track) and a holographic collectible summary card with iridescent foil, specular glare, sparkles and pointer/touch tilt (idle sway; static under `prefers-reduced-motion`). Share images (1080x1920, 1200x630) use the same palette, and the summary image draws the card as a static hologram. Stats, OAuth, share-token schema, privacy disclosures and caveats are unchanged. The summary card shows only what its share image shows (plus the viewer's own name on screen).

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

`/wrapped` renders a 16-card, full-screen story (Framer Motion): intro, issues closed, archetype, peak month, longest streak, the comeback, biggest project, constellation, scope shapeshifter, top collaborator, integrations, the one that got away, label of the year, signature move, photo finish, summary (the holographic card stays last). Navigate by tapping (left third goes back), swiping, arrow keys / space, the prev/next buttons, or the progress segments. Cards do not auto-advance. Reduced motion is respected (`MotionConfig reducedMotion="user"`, no count-up or orbit).

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

**Loading.** `/wrapped` checks the session cookie first (signed-out visitors redirect immediately), then streams: the stats crawl runs inside a `<Suspense>` boundary. The fallback is blank (the dark desk) for the first 400ms (`LOADING_DELAY_MS`), so a fast load shows no flash; after that it shows the PET boot's 17-band Linear mark and "loading your Linear workspace". It is indeterminate on purpose (no progress bar or percentage). The sweep plays once and is static under `prefers-reduced-motion`; screen readers get one `role="status"` message. The "Enter recap" screen after it is kept: its click is what allows full screen.

**Empty and sparse.** Zero closed issues shows a dedicated page instead of 16 empty cards: it explains how "closed" is counted, keeps the real metrics we do have (oldest open issue, workspace integrations, undercount note if truncated) and links to Open Linear, `/wrapped?cards=1` (the full story anyway) and Sign out. Fewer than 10 closed issues (the same cutoff as the archetype's "insufficient data") shows the full story with an honest note on the intro card. Nothing is estimated.

**Metadata.** Absolute URLs come from `SITE_URL` (https only, or http on localhost; set it at build time for a custom domain), else the Vercel production domain, else the deployment's `VERCEL_URL`, else `http://localhost:3000`. They are never derived from request headers. The landing page has a canonical URL and Open Graph/Twitter tags with a generic image (`/opengraph-image`, the intro card, no user data). `/s/<token>` builds its title, description, canonical and `og:`/`twitter:` tags (wide 1200x630 image) only after the token's length and signature verify; malformed or forged links get a generic "Link not found" title and `noindex`, and the page itself returns 404. Shared pages stay `noindex` (previews work, search indexing doesn't). `/wrapped` metadata is static, generic and `noindex, nofollow`; nothing about the viewer goes into it. Vercel preview deployments are often behind Vercel authentication, so crawlers may not be able to fetch preview URLs.

Not changed (earlier limitations stand): 5000-issue list cap, collaborator as a creator/assignee proxy, workspace-level integrations, non-revocable share links, and `?` for non-Latin characters in share images.

## Five more recap cards: metric definitions

All five use the data the stats engine already fetches (no new calls or OAuth scopes; the issue `title` was added to the existing completed-issues query for Photo Finish). Everything is viewer-local (their Linear timezone, UTC fallback), counts the same closed issues as the rest of the recap, and inherits the 5,000-issue cap. Thresholds live in `src/lib/stats/types.ts` (`COMEBACK_RULES`, `SCOPE_RULES`, `SIGNATURE_RULES`); logic and tie-breaks in `src/lib/stats/insights.ts`. Nothing here claims a cause: these describe completions in Linear, not effort, time off or intent.

| Card | Definition | Missing data |
| --- | --- | --- |
| **The Comeback** | *Quiet stretch*: 14+ consecutive local days with zero completions, bounded by a completion on both sides (time before the first or after the last completion is never a stretch). *Burst*: completions in the 7 days starting on the first active day after it, clipped to Dec 31 and to today while the year runs; must be 5+. Best = largest burst, then longer stretch, then earlier. | Unavailable with a reason: fewer than 2 active days, no 14+ day stretch, or stretches without a 5+ burst. |
| **Scope Shapeshifter** | Closed issues per local quarter. A quarter qualifies with 5+ closed issues. *Shift* = total variation distance (half the sum of absolute share differences, shown as 0-100%) between the first and last qualifying quarter, separately for projects (one bucket per project plus "no project") and labels (one per label plus "no label"; a multi-label issue counts once per label). Chart shows the 4 biggest buckets (ties by id) plus Other and None. Wording: 50%+ "Full shapeshift", 25%+ "Shifting scope", else "Steady scope". | Unavailable with fewer than two qualifying quarters. Labels and projects are those currently on each issue, grouped by the quarter it closed; label history is not read. |
| **Your Year as a Constellation** | Projects as stars (top 12; ties by name then id). Star area is proportional to closed issues (radius ~ sqrt); position is decorative. A visible ordered list is the text equivalent. Separate from the workspace-integrations card. | Closed issues without a project are counted in a note, not drawn. No stars when none have a project. |
| **Photo Finish** | The latest completion by instant inside the selected year: local date, HH:MM and issue title (never the id or URL). Exact ties go to the smaller issue id. Days before Dec 31 are shown only once the year is over; otherwise it says it is the latest *so far*. | Null when nothing closed. A missing/blank title shows as "an issue". |
| **Signature Move** | Among closed issues with a project and 1+ label (N), the pair with the highest lift = (n_pl x N) / (n_p x n_l), needing 3+ issues and lift >= 1.5; ties go to more issues, then project id, then label id. Compared only with the viewer's own work, so it is not claimed to be unique across a team. | Unavailable with fewer than 3 eligible issues, or when no pair stands out (e.g. a single project and label). The card states how many closed issues were eligible. |

**Sharing.** Each new card has its own signed snapshot, public page, metadata and 1080x1920 / 1200x630 PNGs (image URLs keep the `r=<IMAGE_VERSION>` design version). Comeback shares local dates and counts; Scope shares quarterly totals and shift percentages with no names; Constellation shares up to 5 project names (24 characters each) plus counts; Signature shares the project and label names; Photo Finish shares the issue title, date and time. The share dialog lists exactly that and requires confirmation for the name-bearing cards. The holographic summary is unchanged.

## Retro redesign

The whole experience is a 1980s computer in halftone. `/` is the supplied halftone beige PET on a lamp-lit desk (`public/retro/pet.webp`, 1672x941; its CRT is blank) filling the whole viewport (cover crop, never stretched; `lib/retro/cover.ts` maps the screen overlay, drop target, dust and cassette through the same crop) with a live terminal laid over the glass, showing only the Linear mark and a blinking cursor, and a halftone cassette (`public/retro/cassette.webp`) lying on the notepad at the lower right (pulled inside the screen where a phone's crop hides the notepad). There is no visible title or instruction text; the cassette's accessible name explains it. Drag the cassette onto the computer (the screen glows while it is over it) and let go: the screen says `ACCESS GRANTED` and, about 1.3 s later, the same tab goes to Linear's real read-only OAuth page (a full-page redirect: no popup, no embedded Linear). The cassette is one focusable control: Enter, Space or a tap does the same. A skip-link-style "Sign in with Linear" link (visible on keyboard focus) and a `<noscript>` link are the only other ways in. A few dust motes drift in the lamp beam (a small canvas, `components/retro/DustMotes.tsx`; still under reduced motion, paused off screen and in hidden tabs). `/wrapped` starts with an "Enter recap" screen, runs the 16 cards on the tube with a compact dock (Prev, Next, Share, Sound, Full screen), and ends on the year-end report: a dot-matrix print-out on tractor-feed paper with the archetype's halftone badge and a Share button (on hover or focus, always visible on touch screens). Sign out is a small control in the top bar of the final card. Sharing to X opens its composer with text and the public card link (the card's wide `og:image` is the preview); X's web intent cannot attach an image, so the dialog also offers saving the PNG, and the system share sheet with the PNG where the browser supports sharing files. Loading, empty and error states, the share dialog, the public `/s/<token>` page and the share images use the same palette (`src/lib/retro/palette.ts`).

**Replacing the computer art.** Everything about the picture is in `src/lib/retro/art.ts`. Swap `public/retro/pet.webp` for an image of the same composition (a blank CRT) and update `PET_SCREEN` (the glass as fractions of the image, measured from its pixels), `PET_BEAM`/`BEAM_POLYGON` (the lamp beam the dust lives in) and, if needed, `PET_VIEWS.tight` (the phone crop). The overlay is positioned from those fractions only, so it stays pinned at any width. `retro.test.ts` checks the file against the numbers.

**Full screen.** Browsers only allow the Fullscreen API from a user gesture, and the OAuth redirect discards that gesture, so the app cannot go fullscreen by itself after sign-in. The first click on "Enter recap" (or the dock's Full screen control) asks; if the browser refuses or has no API (iPhone Safari) the recap simply fills the window and says so. Esc is the browser's own exit and is never undone; a visible X also exits (`lib/fullscreen.ts`).

**Signing out and switching workspace.** Sign out clears the session, drops this token's in-memory stats and sets a data-free marker so the next connect sends `prompt=consent` (Linear's documented way to show the consent screen again, which allows connecting another workspace). It does not revoke the token or sign you out of Linear. `/api/auth/linear?switch=1` does the same on demand.

**Sound** (`src/lib/retro/sound.ts`, `components/retro/Sound.tsx`): synthesized with WebAudio (no samples). A sound only ever plays in direct response to the visitor's own click or key press (disk insert/load, terminal key ticks, card advance); the AudioContext is not created before that. The **SND ON/OFF** key is visible on the landing and on every card, remembered in `localStorage`, defaults to off under `prefers-reduced-motion`, and the disk sound shortens to a click. Master gain is 0.12, each sound is length-capped and rate-limited. **Ambience** (`lib/retro/ambience.ts`): turning sound on also starts a very quiet machine-room hum (60 Hz mains, harmonic, fan rush) with a soft beep every 12-32 s, on the same AudioContext. Sound is **off by default**; only an explicit "on" is saved, and a saved "on" still waits for the first click or key press. Muting stops the hum and cancels beeps at once; hiding the tab stops and suspends, showing it resumes. Unsupported WebAudio or a refused resume is a silent no-op. The landing has a small corner sound button synced with the recap dock.

**Share images** are versioned `r=ht1` (halftone design): the summary is the dot-matrix print-out lying on a dark desk, the archetype card shows the halftone badge, and every other card keeps the lavender CRT look. Links minted earlier keep working: no `r`, `r=pet3`, `r=pet2`, `r=pet1` and `r=holo2` are still accepted (and answered with the current design, with revalidating cache headers). The public print-out never contains the viewer's name; the badge is a local file chosen by the verified snapshot's archetype id.


## Retro refinement notes

- **Landing** fits one screen (no page scroll). The CRT shows a boot screen with the Linear mark drawn as geometry (17 scanline bands cut by three 45-degree strips, `src/lib/retro/logo.ts`) beside "Linear wrapped", revealed band by band, skipped by any key/touch, instant under reduced motion.
- **Cassette** is rendered in a portal on `document.body` at the top z-index, so it is above the computer while dragged; a drop outside the computer springs back, and the grant can only happen once.
- **Recap** is a full-screen CRT. `Fit` lays each card out so it is fully visible (shrinking, then 2-3 columns on short wide screens); only below a 0.5 scale does a card scroll (accessibility fallback). Cards load block by block (tap or Enter skips; reduced motion is instant).
- **Browser checks:** `PREVIEW_FIXTURES=1 npm start` (with any `LINEAR_CLIENT_ID`/`LINEAR_CLIENT_SECRET`), then `CHROME=/path/to/chrome-headless-shell BASE=http://127.0.0.1:3000 node scripts/browser-check.mjs [landing|boot|dust|drag|story|print|dock|fullscreen|art]`. `/preview/<full|sparse|zero|long>?card=<id>` (also `&gate=1`, `&archetype=<id>`) is a 404 unless `PREVIEW_FIXTURES=1`.
