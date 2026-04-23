# WebSocket protocol (overview)

## URL

The API hosts a WebSocket server at:

- `/ws?token=<jwt>`

If the token is missing or invalid, the connection is closed with code `1008` (`unauthorized`).

## Connection lifecycle

- On connect (authorized), server sends: `ready`
- Clients then subscribe to the data they want:
  - DM threads (by `threadId`)
  - channels (by `channelId`)

## Subscriptions

Client messages:

- `subscribe.thread` / `unsubscribe.thread`
- `subscribe.channel` / `unsubscribe.channel`

Server delivery is filtered:

- thread-scoped events go only to clients subscribed to that `threadId`
- channel-scoped events go only to clients subscribed to that `channelId`

## Typing + presence

Client messages:

- `typing.start` / `typing.stop` (scope: `channel` or `dm`)
- `presence.ping`

Server messages broadcast:

- `typing.updated`
- `presence.updated`

## Message events

The API publishes server messages for:

- DM messages: `message.created`, `message.updated`
- Channel messages: `channelMessage.created`, `channelMessage.updated`
- Reactions: `reaction.updated` (scope `dm` or `channel`)
- Read state: `readState.updated` (scope `dm` or `channel`)

## Implementation notes (today)

Realtime is implemented as:

- WebSocket connections terminate in the API service (`apps/api/src/ws/server.ts`)
- events are fanned out via Redis pub/sub (`apps/api/src/ws/realtime.ts`)

This is a dev-friendly pattern that also demonstrates how to fan out across multiple API instances.
