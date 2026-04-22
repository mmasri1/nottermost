import http from "node:http";
import type { Express } from "express";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import type { WsClientMessage, WsServerMessage } from "@nottermost/shared";
import { startRealtime } from "./realtime.js";

type WsClient = {
  userId: string;
  ws: import("ws").WebSocket;
  subscribedThreadIds: Set<string>;
  subscribedChannelIds: Set<string>;
  typing: {
    channelIds: Set<string>;
    threadIds: Set<string>;
  };
  lastPresencePingAt: number;
};

const clients = new Set<WsClient>();

function safeSend(ws: import("ws").WebSocket, msg: WsServerMessage) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function parseAuthUserId(url: string | null | undefined) {
  if (!url) return null;
  const u = new URL(url, "http://localhost");
  const token = u.searchParams.get("token");
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function createHttpServerWithWs(app: Express) {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  void startRealtime(({ kind, id, payload }) => {
    for (const c of clients) {
      if (kind === "thread" && c.subscribedThreadIds.has(id)) safeSend(c.ws, payload);
      if (kind === "channel" && c.subscribedChannelIds.has(id)) safeSend(c.ws, payload);
    }
  });

  function broadcast(payload: WsServerMessage) {
    for (const c of clients) safeSend(c.ws, payload);
  }

  function broadcastTyping(args: { scope: "channel" | "dm"; channelId?: string; threadId?: string; userId: string; isTyping: boolean }) {
    const payload: WsServerMessage = { type: "typing.updated", ...args } as WsServerMessage;
    for (const c of clients) {
      if (args.scope === "channel" && args.channelId && c.subscribedChannelIds.has(args.channelId)) safeSend(c.ws, payload);
      if (args.scope === "dm" && args.threadId && c.subscribedThreadIds.has(args.threadId)) safeSend(c.ws, payload);
    }
  }

  wss.on("connection", (ws, req) => {
    const userId = parseAuthUserId(req.url);
    if (!userId) {
      ws.close(1008, "unauthorized");
      return;
    }

    const client: WsClient = {
      userId,
      ws,
      subscribedThreadIds: new Set(),
      subscribedChannelIds: new Set(),
      typing: { channelIds: new Set(), threadIds: new Set() },
      lastPresencePingAt: Date.now(),
    };
    clients.add(client);
    safeSend(ws, { type: "ready" });
    broadcast({ type: "presence.updated", userId, status: "online", lastSeenAt: new Date().toISOString() } as WsServerMessage);

    ws.on("message", (raw) => {
      let msg: WsClientMessage | null = null;
      try {
        msg = JSON.parse(raw.toString()) as WsClientMessage;
      } catch {
        return;
      }

      if (msg.type === "subscribe.thread") client.subscribedThreadIds.add(msg.threadId);
      if (msg.type === "unsubscribe.thread") client.subscribedThreadIds.delete(msg.threadId);
      if (msg.type === "subscribe.channel") client.subscribedChannelIds.add(msg.channelId);
      if (msg.type === "unsubscribe.channel") client.subscribedChannelIds.delete(msg.channelId);

      if (msg.type === "typing.start" && msg.scope === "channel") {
        client.typing.channelIds.add(msg.channelId);
        broadcastTyping({ scope: "channel", channelId: msg.channelId, userId, isTyping: true });
      }
      if (msg.type === "typing.stop" && msg.scope === "channel") {
        client.typing.channelIds.delete(msg.channelId);
        broadcastTyping({ scope: "channel", channelId: msg.channelId, userId, isTyping: false });
      }
      if (msg.type === "typing.start" && msg.scope === "dm") {
        client.typing.threadIds.add(msg.threadId);
        broadcastTyping({ scope: "dm", threadId: msg.threadId, userId, isTyping: true });
      }
      if (msg.type === "typing.stop" && msg.scope === "dm") {
        client.typing.threadIds.delete(msg.threadId);
        broadcastTyping({ scope: "dm", threadId: msg.threadId, userId, isTyping: false });
      }

      if (msg.type === "presence.ping") {
        client.lastPresencePingAt = Date.now();
        broadcast({ type: "presence.updated", userId, status: "online", lastSeenAt: new Date().toISOString() } as WsServerMessage);
      }
    });

    ws.on("close", () => {
      clients.delete(client);
      broadcast({ type: "presence.updated", userId, status: "offline", lastSeenAt: new Date().toISOString() } as WsServerMessage);
    });
  });

  return server;
}

