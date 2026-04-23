# Changelog

All notable changes to this repository will be documented in this file.

The format is based on **Keep a Changelog**, and this project aims to follow **Semantic Versioning** once versioned releases begin.

## [Unreleased]

### Added
- Docker-first local dev stack: `docker-compose.yml` (web, api, Postgres, Redis) + `.env.example`
- Monorepo scaffolding:
  - `apps/api` (Node/Express + WebSockets)
  - `apps/web` (Next.js)
  - `packages/shared` (shared TypeScript types)
- API features:
  - JWT auth (`/auth/register`, `/auth/login`)
  - Workspaces + membership management
  - 1:1 DM threads + messages with cursor pagination
  - WebSocket realtime `message.created` with Redis pub/sub fan-out
  - Health endpoint (`GET /healthz`)
- Web UI:
  - Register/login pages
  - Workspace list/create
  - Workspace members page (including “add member by email”)
  - DM thread page with history pagination + live updates
- Channels:
  - Public/private channels with membership, invites, and join flow
  - Channel list in workspace UI + channel page with message history and realtime updates
- Files:
  - Uploads API + authenticated downloads with channel/DM access checks
  - File attachments on channel + DM messages (web UI: attach + render links)
- Search:
  - Message search endpoint scoped to workspace and membership (channels + DMs)
  - Web search page under a workspace
- User profiles:
  - Prisma fields on `User` for display name, avatar URL, and status text
  - `PATCH /workspaces/me/profile` plus profile fields on `GET /workspaces/me` and workspace member listings
  - Web workspace profile page + sidebar header display
- Messaging (reactions & message actions):
  - Channel and DM list APIs include `editedAt`, `deletedAt`, and per-viewer reaction summaries
  - WebSocket `reaction.updated` carries aggregate counts plus actor/delta for correct multi-client `me` state
  - Web: channel and DM thread views support quick emoji reactions, edit, soft-delete display, and (edited) markers
- Mentions and notification preferences:
  - Channel mentions: `@local@domain.tld`, `@channel` / `@here`, and `#channel-name` (cross-channel, membership-aware)
  - Per-workspace toggles on `WorkspaceMember` with `GET/PATCH /workspaces/:id/me/notification-prefs`
  - Web: workspace profile page includes mention help + notification checkboxes
- Documentation/meta:
  - Repository policies: `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`, `CODE_OF_CONDUCT.md`
  - GitHub templates: issue templates + PR template
  - `FEATURES.md` feature tracker
  - `ENGINEERING_GUIDELINES.md` workflow/commit rules for humans + AI
  - `index.md` for docs landing page
  - `docs/` documentation scaffold (overview, getting started, apps, reference, deploy)
  - `ROADMAP.md` infra-first roadmap

### Changed
- README tightened while preserving architecture; added operational maturity, production deployments, incident handling, scaling, and real-environment monitoring sections
- README: add local Docker development instructions
- Web UI: updated typography and refreshed the light theme (teal/slate), including less-rounded cards/inputs/buttons
- Web UI: overhauled chat layout and composer for a more usable, Slack-like experience; aligned workspace pages with the same “Slack-like” UI primitives
- Web UI: improve workspace shell (sidebar quick actions, global search in top bar, settings page) and set dynamic tab titles per page
- Web UI: remove internal IDs from the UI and display member/channel names instead; refine top-bar search + sidebar settings placement
- Web UI: make workspace shell responsive (mobile sidebar toggle, collapse right rails/threads on small screens) and switch profile/workspace pages to full-bleed layouts
- `index.md`: convert from “include README” to a docs homepage with links into `docs/`

### Fixed
- Local Docker builds: avoid `workspace:*` dependency spec in container npm installs
- API startup in Docker: initialize Prisma only after dev schema sync/generate
- Channel thread pane: “Load older” for paginated thread replies
- Local Docker dev images: improved npm install reliability and caching for the monorepo Dockerfiles
- Channels: fix `useMemo is not defined` crash in `ChatMessageRow`
- Sidebar: fix Home item showing as active while in a channel/DM page
- Top bar search: fix search icon overlapping placeholder/value on some browsers
- Sidebar: pin Settings to the bottom (independent of channel/DM list height)
- Workspace page: tighten button sizing/row layout and remove add-member tip text
- Workspace invites + login: normalize emails to avoid case-sensitivity issues

