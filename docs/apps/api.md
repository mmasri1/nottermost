# `apps/api` (API + realtime)

## What it is

The API is an **Express** server that exposes HTTP routes plus a **WebSocket** endpoint for realtime updates.

- **HTTP**: `http://localhost:4000`
- **Health**: `GET /healthz`
- **WebSocket**: `/ws` (query param `token=...`)

## Runtime dependencies

- **Postgres**: Prisma connects via `DATABASE_URL`
- **Redis**: used for realtime pub/sub fanout via `REDIS_URL`

## Entry point

The server starts from `src/server.ts`:

- sets up CORS (via `CORS_ORIGIN`)
- mounts routers:
  - `/auth`
  - `/workspaces`
  - `/dm`
  - `/channels`
  - `/notifications`
  - `/files`
  - `/search`
- attaches WebSocket server on the same HTTP server at `/ws`
- runs dev startup hooks (local convenience)

## Authentication model (today)

- `POST /auth/register` and `POST /auth/login` issue a JWT.
- For HTTP routes, the token is validated by `requireAuth` middleware.
- For WebSockets, the token is read from the connection URL query string:
  - `ws://host/ws?token=<jwt>`

## Realtime delivery (today)

The realtime path is intentionally simple:

- WebSocket clients **subscribe** to specific DM threads and/or channels
- The API publishes events into Redis channels:
  - `thread:<threadId>`
  - `channel:<channelId>`
- Each API instance subscribes to `thread:*` and `channel:*` and forwards to connected clients

See `docs/reference/websocket.md` for the message types and subscription flow.

## Data model

The Prisma schema is in `prisma/schema.prisma` (Postgres).

See `docs/reference/database.md` for an entity-level overview.
