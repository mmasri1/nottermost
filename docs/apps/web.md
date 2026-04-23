# `apps/web` (Next.js frontend)

## What it is

The web app is a **Next.js** UI that talks to the API over:

- HTTP (`NEXT_PUBLIC_API_URL`)
- WebSockets (`NEXT_PUBLIC_WS_URL`)

## Pages (high level)

- `/` landing
- `/register` register
- `/login` login
- `/app` authenticated area
  - workspace creation
  - per-workspace views for channels, DMs, search, threads, profile, settings

## Local dev

In Docker Compose, the web app runs on `http://localhost:3000` and is configured via `.env`:

- `NEXT_PUBLIC_API_URL=http://localhost:4000`
- `NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws`

## Build output

`next.config.ts` uses `output: "standalone"`, which is useful for containerized deployments.
