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
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type WsClientMessage =
  | { type: "subscribe.thread"; threadId: string }
  | { type: "unsubscribe.thread"; threadId: string }
  | { type: "subscribe.channel"; channelId: string }
  | { type: "unsubscribe.channel"; channelId: string };

export type WsServerMessage =
  | { type: "ready" }
  | { type: "message.created"; message: Message }
  | { type: "channelMessage.created"; message: ChannelMessage };

