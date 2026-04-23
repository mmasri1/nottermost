## Nottermost docs

Nottermost is a **Mattermost-inspired** team chat app built as a **small monorepo** with:

- **Web UI**: Next.js app (`apps/web`)
- **API**: Node.js + Express + Prisma (`apps/api`)
- **Realtime**: WebSocket server at `/ws`, with Redis pub/sub fanout (`apps/api/src/ws/*`)
- **Data**: Postgres (via Prisma schema), Redis (realtime + coordination)

### Start here

- **Project overview**: `docs/overview/project.md`
- **Local development**: `docs/getting-started/local-development.md`
- **Apps**
  - **API**: `docs/apps/api.md`
  - **Web**: `docs/apps/web.md`
- **Reference**
  - **Environment variables**: `docs/reference/environment.md`
  - **HTTP API**: `docs/reference/http-api.md`
  - **WebSocket protocol**: `docs/reference/websocket.md`
  - **Database schema**: `docs/reference/database.md`
- **Deploy (WIP)**: `docs/deploy/overview.md`

### What to document next

If your goal is “document everything” + “make a webpage for it”, the next steps after these pages are:

- **Architecture diagrams** (VPC/subnets, request flows, realtime fanout)
- **Deploy guides** per environment (dev/stage/prod)
- **Runbooks** (incidents, rollback, migrations, backups, cost checks)
