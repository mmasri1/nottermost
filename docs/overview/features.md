# Features (implemented)

This page describes what’s **implemented in the current repo**, not the aspirational AWS target architecture.

## Accounts & auth

- **Register** and **login** with email/password
- **JWT** issued by API
- Token used for:
  - HTTP requests (`Authorization: Bearer <token>`)
  - WebSocket connect (`/ws?token=<token>`)

## Workspaces

- Create a workspace
- Workspace membership:
  - list members
  - add member by email (owner-only)
- Per-workspace notification preferences:
  - opt in/out of channel mention notifications
  - opt in/out of DM mention notifications

## Profiles

- Profile fields:
  - display name
  - avatar URL (HTTP/HTTPS only)
  - status text
- Update via API and view in workspace UI

## Channels

- Create channels:
  - public or private
  - creator becomes owner in the channel
- Join channels:
  - public channels are joinable
  - private channels require an invite
- Channel invites:
  - invite a workspace member to a channel
  - accept an invite

## Channel messaging

- Send messages to channels
- Cursor-based pagination for history
- Message actions:
  - edit own messages
  - soft-delete own messages
- Reactions:
  - add/remove emoji reactions
  - aggregate reaction counts returned and updated in realtime
- Threads:
  - top-level messages + thread replies
  - thread reply count + last reply time returned with top-level history

## Direct messages (DMs)

- Direct DM threads (1:1)
- Group DM threads (3–20 participants) with optional name
- Cursor-based pagination for history
- Message actions:
  - edit own messages
  - soft-delete own messages
- Reactions:
  - add/remove emoji reactions
  - aggregate reaction counts returned and updated in realtime

## Realtime (WebSockets)

- Subscribe/unsubscribe to:
  - channel IDs
  - DM thread IDs
- Events delivered in realtime:
  - new/updated messages (DM + channel)
  - reactions updates
  - read-state updates
  - typing indicators
  - presence updates (online/offline, last seen)

## Notifications

- Mention-style notifications created on message send (best-effort)
- Notifications list:
  - cursor pagination
  - mark read

## Files

- Upload file to a **channel** or **DM thread** scope (max 25MB)
- Download is authenticated and access-checked against membership/grants
- Storage is **local disk** in dev (a deploy target is object storage)

## Search

- Search messages in a workspace across:
  - channels you’re a member of
  - DM threads you participate in
- Optional filters:
  - kind: `all | channel | dm`
  - channelId / threadId
  - senderId

Implementation note: this is currently a simple case-insensitive “contains” query, not OpenSearch-backed indexing.
