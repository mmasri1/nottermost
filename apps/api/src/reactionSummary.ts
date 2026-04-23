import type { MessageReactionCount, MessageReactionSummary } from "@nottermost/shared";
import { prisma } from "./prisma.js";

export async function channelReactionMap(
  messageIds: string[],
  viewerId: string,
): Promise<Map<string, MessageReactionSummary[]>> {
  const map = new Map<string, MessageReactionSummary[]>();
  if (!messageIds.length) return map;

  const groups = await prisma.channelMessageReaction.groupBy({
    by: ["messageId", "emoji"],
    where: { messageId: { in: messageIds } },
    _count: { _all: true },
  });

  const mine = await prisma.channelMessageReaction.findMany({
    where: { messageId: { in: messageIds }, userId: viewerId },
    select: { messageId: true, emoji: true },
  });
  const meKey = new Set(mine.map((r) => `${r.messageId}:${r.emoji}`));

  for (const g of groups) {
    const list = map.get(g.messageId) ?? [];
    list.push({
      emoji: g.emoji,
      count: g._count._all,
      me: meKey.has(`${g.messageId}:${g.emoji}`),
    });
    map.set(g.messageId, list);
  }

  for (const [, list] of map) {
    list.sort((a, b) => a.emoji.localeCompare(b.emoji));
  }

  return map;
}

export async function dmReactionMap(messageIds: string[], viewerId: string): Promise<Map<string, MessageReactionSummary[]>> {
  const map = new Map<string, MessageReactionSummary[]>();
  if (!messageIds.length) return map;

  const groups = await prisma.messageReaction.groupBy({
    by: ["messageId", "emoji"],
    where: { messageId: { in: messageIds } },
    _count: { _all: true },
  });

  const mine = await prisma.messageReaction.findMany({
    where: { messageId: { in: messageIds }, userId: viewerId },
    select: { messageId: true, emoji: true },
  });
  const meKey = new Set(mine.map((r) => `${r.messageId}:${r.emoji}`));

  for (const g of groups) {
    const list = map.get(g.messageId) ?? [];
    list.push({
      emoji: g.emoji,
      count: g._count._all,
      me: meKey.has(`${g.messageId}:${g.emoji}`),
    });
    map.set(g.messageId, list);
  }

  for (const [, list] of map) {
    list.sort((a, b) => a.emoji.localeCompare(b.emoji));
  }

  return map;
}

export async function channelReactionList(messageId: string, viewerId: string): Promise<MessageReactionSummary[]> {
  return (await channelReactionMap([messageId], viewerId)).get(messageId) ?? [];
}

export async function dmReactionList(messageId: string, viewerId: string): Promise<MessageReactionSummary[]> {
  return (await dmReactionMap([messageId], viewerId)).get(messageId) ?? [];
}

export async function channelReactionCountsOnly(messageId: string): Promise<MessageReactionCount[]> {
  const rows = await prisma.channelMessageReaction.groupBy({
    by: ["emoji"],
    where: { messageId },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ emoji: r.emoji, count: r._count._all }))
    .sort((a, b) => a.emoji.localeCompare(b.emoji));
}

export async function dmReactionCountsOnly(messageId: string): Promise<MessageReactionCount[]> {
  const rows = await prisma.messageReaction.groupBy({
    by: ["emoji"],
    where: { messageId },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ emoji: r.emoji, count: r._count._all }))
    .sort((a, b) => a.emoji.localeCompare(b.emoji));
}
