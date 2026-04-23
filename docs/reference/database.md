# Database (Prisma + Postgres)

The canonical data model lives in `apps/api/prisma/schema.prisma`.

## Core entities

- **User**
  - email/password auth
  - profile fields: `displayName`, `avatarUrl`, `statusText`
- **Workspace**
  - members via `WorkspaceMember` (role + notification prefs)
- **DMs**
  - `DmThread` + `DmParticipant` + `Message`
  - reactions via `MessageReaction`
  - read state via `DmReadState`
- **Channels**
  - `Channel` + `ChannelMember` + `ChannelInvite`
  - messages via `ChannelMessage` (supports threading via `threadRootId`)
  - reactions via `ChannelMessageReaction`
  - read state via `ChannelReadState`
- **Notifications**
  - `Notification` with `kind` + `entityType` + `entityId`
- **Files**
  - `FileObject` + `FileGrant`
  - attachments: `ChannelMessageAttachment`, `DmMessageAttachment`

## Notable modeling choices

- **Channel threads**: replies are messages whose `threadRootId` points at the root message.
- **Direct vs group DMs**:
  - direct threads store a deterministic `(directUserAId, directUserBId)` pair for uniqueness
  - group threads store `kind=group` + optional `name`
- **File access**: `FileGrant` is the gatekeeper (grants by channel or dm thread).

## Migrations

In local dev, the API runs a dev-only schema sync step on startup. In real deployments, you’ll want explicit migration strategy (CI/CD step + rollback plan).
