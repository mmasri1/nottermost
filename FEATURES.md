# Features tracker

This file tracks which features are done, in progress, or not started.

## Implemented (done)

### Accounts / auth
- [X] Register + login (JWT)
- [X] Logout (client-side token removal)

### Workspaces
- [X] Create workspace
- [X] List my workspaces
- [X] View workspace members
- [X] Add member by email (owner-only)
- [X] Workspace overview page UX polish (compact actions)

### Direct messages (1:1)
- [X] Create/find DM thread between two workspace members
- [X] Thread page UI
- [X] Send message
- [X] Message history with cursor pagination (“Load older”)

### Realtime delivery
- [X] WebSocket connection (JWT via query param)
- [X] Subscribe to a thread
- [X] Receive `message.created` in real time
- [X] Redis pub/sub fan-out for message events

### Local dev
- [X] Docker Compose stack: web + api + Postgres + Redis
- [X] Basic health endpoint: `GET /healthz`

### Documentation/meta
- [X] Engineering guidelines for contributors + AI (`ENGINEERING_GUIDELINES.md`)
- [X] GitHub Pages entrypoint (`index.md` renders `README.md`)

### Channels
- [X] Public/private channels
- [X] Channel membership, invites
- [X] Channel list + channel messages

### Group conversations
- [X] Group DMs / multi-person threads
- [X] Threads / replies (reply-in-thread, thread view, unread thread activity)

### Messaging UX
- [X] Mentions & notifications (`@user`, `@channel`, notification prefs)
- [X] Reactions, edits, deletes (emoji reactions, edit/delete)
- [X] Typing indicators
- [X] Slack-like workspace pages + chat surfaces (message rows, headers, thread rail)
- [X] Light mode is default

### Workspace shell UX
- [X] Sidebar quick actions + Settings page (logout)
- [X] Global search in the top bar
- [X] Dynamic browser tab titles per page
- [X] Responsive app shell (mobile sidebar toggle + adaptive rails)

### Files
- [X] Uploads, previews, retention, permissions

### Search
- [X] Full-text search + filters (OpenSearch not wired)

### User profiles / admin
- [X] Display names, avatars, status, profile editing
- [ ] Roles/permissions beyond “owner/member”, user deactivation, audits

---

## Not implemented (not done)

### Reliability / production hardening
- [ ] Multi-instance WebSocket correctness (distributed subscription registry)
- [ ] Guaranteed delivery semantics (ack/retry, offline delivery beyond history)
- [ ] Rate limiting / abuse controls
- [ ] Observability (metrics/tracing/log correlation IDs/dashboards)
- [ ] Automated tests (unit/integration/e2e)
- [ ] Production deployment implementation (canary/blue-green/rolling pipelines, secrets rotation, etc.)