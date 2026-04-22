export type ApiError = { error: string };

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type Workspace = {
  id: string;
  name: string;
  createdAt: string;
};

export type DirectThread = {
  id: string;
  workspaceId: string;
  userAId: string;
  userBId: string;
  createdAt: string;
};

export type Message = {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
};

export type Channel = {
  id: string;
  workspaceId: string;
  name: string;
  isPrivate: boolean;
  createdAt: string;
};

export type ChannelListItem = Channel & {
  isMember: boolean;
};

export type ChannelMember = {
  channelId: string;
  userId: string;
  role: string;
  createdAt: string;
};

export type ChannelInvite = {
  id: string;
  channelId: string;
  channelName: string;
  workspaceId: string;
  inviterId: string;
  inviterEmail: string;
  createdAt: string;
};

export type ChannelMessage = {
  id: string;
  channelId: string;
  senderId: string;
  body: string;
  createdAt: string;
  threadRootId?: string | null;
  replyToId?: string | null;
  replyCount?: number;
  lastReplyAt?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type WsClientMessage =
  | { type: "subscribe.thread"; threadId: string }
  | { type: "unsubscribe.thread"; threadId: string }
  | { type: "subscribe.channel"; channelId: string }
  | { type: "unsubscribe.channel"; channelId: string }
  | { type: "typing.start"; scope: "channel"; channelId: string }
  | { type: "typing.stop"; scope: "channel"; channelId: string }
  | { type: "typing.start"; scope: "dm"; threadId: string }
  | { type: "typing.stop"; scope: "dm"; threadId: string }
  | { type: "presence.ping" };

export type WsServerMessage =
  | { type: "ready" }
  | { type: "message.created"; message: Message }
  | { type: "channelMessage.created"; message: ChannelMessage }
  | { type: "message.updated"; message: Message }
  | { type: "channelMessage.updated"; message: ChannelMessage }
  | {
      type: "reaction.updated";
      scope: "channel" | "dm";
      channelId?: string;
      threadId?: string;
      messageId: string;
      emoji: string;
    }
  | {
      type: "typing.updated";
      scope: "channel" | "dm";
      channelId?: string;
      threadId?: string;
      userId: string;
      isTyping: boolean;
    }
  | {
      type: "presence.updated";
      userId: string;
      status: "online" | "away" | "offline";
      lastSeenAt: string;
    }
  | {
      type: "notification.created";
      notification: {
        id: string;
        kind: string;
        entityType: string;
        entityId: string;
        createdAt: string;
        readAt: string | null;
        workspaceId: string | null;
        channelId: string | null;
        threadId: string | null;
        snippet: string | null;
        fromUserId: string | null;
      };
    }
  | {
      type: "readState.updated";
      scope: "channel" | "dm";
      channelId?: string;
      threadId?: string;
      userId: string;
      lastReadAt: string;
    };

