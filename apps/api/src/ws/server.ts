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

  wss.on("connection", (ws, req) => {
    const userId = parseAuthUserId(req.url);
    if (!userId) {
      ws.close(1008, "unauthorized");
      return;
    }

    const client: WsClient = { userId, ws, subscribedThreadIds: new Set(), subscribedChannelIds: new Set() };
    clients.add(client);
    safeSend(ws, { type: "ready" });

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
    });

    ws.on("close", () => {
      clients.delete(client);
    });
  });

  return server;
}

