# Linear Wrapped

A Spotify Wrapped-style yearly recap for Linear (calendar year 2026). Built with Next.js (App Router), TypeScript and Tailwind CSS, deployable on Vercel.

## Status

Step 2: read-only Linear OAuth sign-in, redirecting to a placeholder `/wrapped` page. Stats, cards and sharing come in later PRs.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm run build
```

## Linear OAuth setup

1. Create an OAuth application at https://linear.app/settings/api/applications/new.
2. Add callback URLs for each origin you use:
   - `http://localhost:3000/api/auth/linear/callback`
   - `https://<your-vercel-domain>/api/auth/linear/callback`
3. Copy `.env.example` to `.env.local` and set `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET` (also set them in Vercel project env vars).

Only the `read` scope is requested. Flow: `/api/auth/linear` sets a random `state` cookie and redirects to Linear; `/api/auth/linear/callback` verifies `state`, exchanges the code server-side, and stores the access token AES-256-GCM encrypted in an httpOnly, SameSite=Lax (Secure in production) cookie that lasts at most 24h, then redirects to `/wrapped`. The token is never sent to client code or logged, and nothing is stored in a database. Redirect targets are fixed paths, not user input.

## Deploy

Import the repo in Vercel and set the two env vars; the Next.js preset needs no other config.
