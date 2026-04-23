## Nottermost

A **Mattermost-inspired** team chat app built to practice **distributed-system + AWS ops** end-to-end, using a deliberately minimal product surface area.

### Table of contents

- [Demo](#demo)
- [What we built](#what-we-built)
- [Architecture (current implementation)](#architecture-current-implementation)
- [Feature list (implemented)](#feature-list-implemented)
- [Local development](#local-development)
- [Documentation map](#documentation-map)

### Demo

![Nottermost demo placeholder](docs/assets/demo.svg)

See also: `docs/overview/demo.md`.

### What we built

Nottermost is a **small monorepo** with:

- **Web UI**: Next.js (`apps/web`)
- **API**: Node.js + Express + Prisma (`apps/api`)
- **Realtime**: WebSocket endpoint at `/ws` with Redis pub/sub fanout (`apps/api/src/ws/*`)
- **Data**: Postgres (Prisma schema) + Redis
- **Local orchestration**: `docker-compose.yml` + `.env`

### Architecture (current implementation)

- **Auth**: email/password → JWT; HTTP uses `Authorization: Bearer <token>`, WebSocket uses `?token=...`
- **HTTP API**: REST-ish endpoints under `/auth`, `/workspaces`, `/channels`, `/dm`, `/notifications`, `/files`, `/search`
- **Realtime**:
  - clients subscribe to channel IDs and DM thread IDs
  - API publishes events to Redis (`channel:*`, `thread:*`)
  - each API instance forwards events to subscribed WebSocket clients

### Feature list (implemented)

The high-level list lives here: `docs/overview/features.md`.

Highlights:

- **Workspaces**: create workspace, add members by email
- **Channels**: public/private, invites, join flow, read state
- **DMs**: direct and group, read state
- **Messaging**: pagination, edit/delete, reactions, channel threads (root + replies)
- **Presence + typing**: WebSocket-driven
- **Notifications**: mention-style notifications with per-workspace notification prefs
- **Files**: upload + authenticated download with channel/DM access checks
- **Search**: membership-scoped search across channels + DMs (simple contains query)

### Local development

- Copy `.env.example` → `.env`
- Run `docker compose up --build`
- Web: `http://localhost:3000`
- API: `http://localhost:4000` (`/healthz`)

Full guide: `docs/getting-started/local-development.md`.

### Documentation map

- **Start here**
  - `docs/overview/project.md`
  - `docs/overview/features.md`
  - `docs/overview/demo.md`
- **Apps**
  - `docs/apps/api.md`
  - `docs/apps/web.md`
- **Reference**
  - `docs/reference/environment.md`
  - `docs/reference/http-api.md`
  - `docs/reference/websocket.md`
  - `docs/reference/database.md`
- **Deploy (WIP)**
  - `docs/deploy/overview.md`
