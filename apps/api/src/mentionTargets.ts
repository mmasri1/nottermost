import { prisma } from "./prisma.js";

/** Matches legacy tokens like `@local@domain.tld` (leading @ stripped before email lookup). */
export function extractEmailMentions(body: string): string[] {
  const matches = body.match(/@[^\s@]+@[^\s@]+\.[^\s@]+/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

function hasAtWord(body: string, word: "channel" | "here") {
  const re = new RegExp(`(?:^|[^a-zA-Z0-9])@${word}(?:$|[^a-zA-Z0-9])`, "i");
  return re.test(body);
}

/** Slack-style broadcast to everyone in the current channel (members only). */
export function hasAtChannel(body: string): boolean {
  return hasAtWord(body, "channel");
}

/**
 * Slack-style ping for people who are "around". We do not track presence yet, so this behaves like `@channel`.
 */
export function hasAtHere(body: string): boolean {
  return hasAtWord(body, "here");
}

/** `#general` style references to another channel name in the same workspace (case-insensitive). */
export function extractHashedChannelSlugs(body: string): string[] {
  const matches = body.match(/#([^\s#]+)/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

export async function filterUsersAllowingChannelMentions(workspaceId: string, userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const rows = await prisma.workspaceMember.findMany({
    where: { workspaceId, userId: { in: userIds } },
    select: { userId: true, notifyChannelMentions: true },
  });
  const map = new Map(rows.map((r) => [r.userId, r.notifyChannelMentions]));
  return userIds.filter((id) => map.get(id) !== false);
}

export async function filterUsersAllowingDmMentions(workspaceId: string, userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [];
  const rows = await prisma.workspaceMember.findMany({
    where: { workspaceId, userId: { in: userIds } },
    select: { userId: true, notifyDmMentions: true },
  });
  const map = new Map(rows.map((r) => [r.userId, r.notifyDmMentions]));
  return userIds.filter((id) => map.get(id) !== false);
}

/**
 * Resolve user IDs to notify for channel message mentions (emails, @channel/@here, and #other-channel).
 */
export async function resolveChannelMentionRecipientIds(args: {
  body: string;
  channelId: string;
  workspaceId: string;
  senderId: string;
}): Promise<string[]> {
  const { body, channelId, workspaceId, senderId } = args;
  const ids = new Set<string>();

  const emails = extractEmailMentions(body);
  if (emails.length) {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    if (users.length) {
      const wsMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId, userId: { in: users.map((u) => u.id) } },
        select: { userId: true },
      });
      for (const m of wsMembers) ids.add(m.userId);
    }
  }

  if (hasAtChannel(body) || hasAtHere(body)) {
    const members = await prisma.channelMember.findMany({ where: { channelId }, select: { userId: true } });
    for (const m of members) ids.add(m.userId);
  }

  const slugs = extractHashedChannelSlugs(body);
  for (const slug of slugs) {
    const ch = await prisma.channel.findFirst({
      where: {
        workspaceId,
        name: { equals: slug, mode: "insensitive" },
        OR: [{ isPrivate: false }, { members: { some: { userId: senderId } } }],
      },
      select: { id: true },
    });
    if (!ch) continue;
    const members = await prisma.channelMember.findMany({ where: { channelId: ch.id }, select: { userId: true } });
    for (const m of members) ids.add(m.userId);
  }

  ids.delete(senderId);
  return Array.from(ids);
}

export async function resolveDmMentionRecipientIds(args: { body: string; threadId: string; senderId: string }): Promise<string[]> {
  const { body, threadId, senderId } = args;
  const emails = extractEmailMentions(body);
  if (!emails.length) return [];

  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  if (!users.length) return [];

  const participants = await prisma.dmParticipant.findMany({
    where: { threadId, userId: { in: users.map((u) => u.id) } },
    select: { userId: true },
  });

  return participants.map((p) => p.userId).filter((id) => id !== senderId);
}
