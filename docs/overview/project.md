# Project overview

## What this repo is

Nottermost is a **Mattermost-inspired** team chat platform. The project intentionally keeps the product surface area “minimal but essential” so you can practice:

- **Distributed-system thinking** (realtime fanout, back-pressure, presence/typing)
- **Operational maturity** (repeatability, observability, deploy + rollback discipline)
- **Cost/latency trade-offs** (caching, async, data model choices)

## What’s implemented today (in this repo)

- **Auth**: email/password login with **JWT** (issued by API, used by HTTP + WebSocket)
- **Workspaces**: create workspace, invite/add members, profile + notification prefs
- **Channels**: public/private channels, invites, join flow
- **Channel messages**: pagination, edit/delete, threads (root + replies), reactions
- **DMs**: direct DMs + group DMs, pagination, edit/delete, reactions
- **Typing + presence**: over WebSockets (presence ping, typing start/stop)
- **Notifications**: mention-style notifications (based on simple mention parsing)
- **Files**: upload + grant model (stored locally in dev; deploy target is object storage)
- **Search**: endpoint exists (implementation details documented in API page)

## Repo layout

- `apps/api`: API + realtime WebSocket server + Prisma (Postgres)
- `apps/web`: Next.js frontend
- `packages/shared`: shared types (including WebSocket message types)
- `docker-compose.yml`: local dev stack (web + api + postgres + redis)

## How local dev works

Everything runs in Docker Compose:

- **Postgres 16** on `localhost:5432`
- **Redis 7** on `localhost:6379`
- **API** on `http://localhost:4000` with WebSocket at `ws://localhost:4000/ws`
- **Web** on `http://localhost:3000`

See `docs/getting-started/local-development.md`.
