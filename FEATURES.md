# Features tracker

This file tracks what’s implemented vs not implemented for the current “Slack clone” scope.

## Implemented (done)

### Accounts / auth
- [X] Register + login (JWT)
- [X] Logout (client-side token removal)

### Workspaces
- [X] Create workspace
- [X] List my workspaces
- [X] View workspace members
- [X] Add member by email (owner-only)

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

---

## Not implemented (not done)

### Channels
- [ ] Public/private channels
- [ ] Channel membership, invites
- [ ] Channel list + channel messages

### Group conversations
- [ ] Group DMs / multi-person threads
- [ ] Threads / replies (reply-in-thread, thread view, unread thread activity)

### Messaging UX
- [ ] Mentions & notifications (`@user`, `@channel`, notification prefs)
- [ ] Reactions, edits, deletes (emoji reactions, edit/delete, pinning, saved items)
- [ ] Typing indicators
- [ ] Presence
- [ ] Read states (unread counts, read markers, last-read)
- [ ] Light mode is default
- [ ] Design exactly like Slack (layout + icons + overall look)

### Files
- [ ] Uploads, previews, retention, permissions

### Search
- [ ] Full-text search + filters (OpenSearch not wired)

### User profiles / admin
- [ ] Display names, avatars, status, profile editing
- [ ] Roles/permissions beyond “owner/member”, user deactivation, audits

### Reliability / production hardening
- [ ] Multi-instance WebSocket correctness (distributed subscription registry)
- [ ] Guaranteed delivery semantics (ack/retry, offline delivery beyond history)
- [ ] Rate limiting / abuse controls
- [ ] Observability (metrics/tracing/log correlation IDs/dashboards)
- [ ] Automated tests (unit/integration/e2e)
- [ ] Production deployment implementation (canary/blue-green/rolling pipelines, secrets rotation, etc.)
