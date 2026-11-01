# Linear Wrapped

A Spotify Wrapped-style yearly recap for Linear (calendar year 2026). Built with Next.js (App Router), TypeScript and Tailwind CSS, deployable on Vercel.

## Status

Step 1: scaffold and landing page. The "Sign in with Linear" button is a disabled placeholder; OAuth, stats, cards and sharing come in later PRs.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm run build
```

## Environment

Copy `.env.example` to `.env.local`. `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET` are not used yet; they will be required by the OAuth step.

## Deploy

Import the repo in Vercel; the Next.js preset works with no extra config.
