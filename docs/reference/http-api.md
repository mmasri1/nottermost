# HTTP API (overview)

This is a **human-first** overview of the implemented endpoints. For exact request/response shapes, refer to the route handlers in `apps/api/src/routes/*`.

## Auth

- `POST /auth/register`
- `POST /auth/login`

## Workspaces

- `GET /workspaces/me`
- `PATCH /workspaces/me/profile`
- `GET /workspaces`
- `POST /workspaces`
- `GET /workspaces/:id/members`
- `POST /workspaces/:id/members`
- `GET /workspaces/:id/me/notification-prefs`
- `PATCH /workspaces/:id/me/notification-prefs`

## DMs

- `GET /dm/threads?workspaceId=...`
- `POST /dm/threads` (direct or group)
- `GET /dm/threads/:id/messages` (cursor pagination)
- `POST /dm/threads/:id/messages`
- `PATCH /dm/threads/:threadId/messages/:messageId`
- `DELETE /dm/threads/:threadId/messages/:messageId`
- Reactions:
  - `POST /dm/threads/:threadId/messages/:messageId/reactions`
  - `DELETE /dm/threads/:threadId/messages/:messageId/reactions?emoji=...`
- Read state:
  - `POST /dm/threads/:threadId/read`

## Channels

- `GET /channels?workspaceId=...`
- `POST /channels`
- `POST /channels/:id/join`
- Invites:
  - `GET /channels/invites?workspaceId=...`
  - `POST /channels/:id/invites`
  - `POST /channels/invites/:id/accept`
- Messages (top-level + threads):
  - `GET /channels/:id/messages` (cursor pagination; returns thread reply aggregates)
  - `POST /channels/:id/messages`
  - `GET /channels/:id/threads/:rootMessageId/messages`
  - `PATCH /channels/:channelId/messages/:messageId`
  - `DELETE /channels/:channelId/messages/:messageId`
- Reactions:
  - `POST /channels/:channelId/messages/:messageId/reactions`
  - `DELETE /channels/:channelId/messages/:messageId/reactions?emoji=...`
- Read state:
  - `POST /channels/:channelId/read`

## Notifications

- `GET /notifications?workspaceId=...` (cursor pagination)
- `POST /notifications/:id/read`

## Files

- `POST /files/upload?workspaceId=...&channelId=...` (multipart form file field: `file`)
- `POST /files/upload?workspaceId=...&threadId=...` (multipart form file field: `file`)
- `GET /files/:id` (metadata + download URL)
- `GET /files/:id/download` (streams the file; access-checked)

## Search

- `GET /search/messages?workspaceId=...&q=...`
  - optional filters: `kind=all|channel|dm`, `channelId`, `threadId`, `senderId`
  - cursor pagination via `cursor=...`

## Source of truth

All endpoints are implemented in `apps/api/src/routes/*`.

This page will stay as the “map” and deeper details will live alongside per-feature docs.
