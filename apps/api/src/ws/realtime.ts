import { createClient, type RedisClientType } from "redis";
import type { WsServerMessage } from "@nottermost/shared";
import { env } from "../env.js";

let pub: RedisClientType | null = null;
let sub: RedisClientType | null = null;
let started = false;

export type DeliverLocal = (threadId: string, payload: WsServerMessage) => void;
let deliverLocal: DeliverLocal | null = null;

const channelForThread = (threadId: string) => `thread:${threadId}`;

export async function startRealtime(deliver: DeliverLocal) {
  deliverLocal = deliver;
  if (started) return;
  started = true;

  pub = createClient({ url: env.REDIS_URL });
  sub = createClient({ url: env.REDIS_URL });

  await pub.connect();
  await sub.connect();

  await sub.pSubscribe("thread:*", (message, channel) => {
    const threadId = channel.startsWith("thread:") ? channel.slice("thread:".length) : null;
    if (!threadId) return;
    let payload: WsServerMessage | null = null;
    try {
      payload = JSON.parse(message) as WsServerMessage;
    } catch {
      return;
    }
    deliverLocal?.(threadId, payload);
  });
}

export async function publishThreadEvent(threadId: string, payload: WsServerMessage) {
  if (!pub) {
    // If realtime isn't started yet, do nothing (dev safety).
    return;
  }
  await pub.publish(channelForThread(threadId), JSON.stringify(payload));
}

