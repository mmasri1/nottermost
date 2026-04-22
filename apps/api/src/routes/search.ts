import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

export const searchRouter = Router();
searchRouter.use(requireAuth);

type Cursor = { createdAt: string; id: string };
function encodeCursor(c: Cursor) {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}
function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

const querySchema = z.object({
  workspaceId: z.string().uuid(),
  q: z.string().min(1).max(200),
  kind: z.enum(["all", "channel", "dm"]).optional().default("all"),
  channelId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  senderId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(30),
  cursor: z.string().optional(),
});

searchRouter.get("/messages", async (req, res) => {
  const userId = req.userId!;
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid_query" });

  const { workspaceId, q, kind, channelId, threadId, senderId, limit, cursor: cursorRaw } = parsed.data;
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  if (cursorRaw && !cursor) return res.status(400).json({ error: "invalid_cursor" });

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { workspaceId: true },
  });
  if (!membership) return res.status(403).json({ error: "not_a_member" });

  const channelIds =
    kind === "dm"
      ? []
      : (
          await prisma.channelMember.findMany({
            where: { userId, channel: { workspaceId } },
            select: { channelId: true },
          })
        ).map((x) => x.channelId);

  const threadIds =
    kind === "channel"
      ? []
      : (
          await prisma.dmParticipant.findMany({
            where: { userId, thread: { workspaceId } },
            select: { threadId: true },
          })
        ).map((x) => x.threadId);

  const takePerKind = Math.min(100, limit * 2);

  const [chMsgs, dmMsgs] = await Promise.all([
    channelIds.length && kind !== "dm"
      ? prisma.channelMessage.findMany({
          where: {
            channelId: channelId ? channelId : { in: channelIds },
            threadRootId: null,
            deletedAt: null,
            ...(senderId ? { senderId } : {}),
            body: { contains: q, mode: "insensitive" },
            ...(cursor
              ? {
                  OR: [
                    { createdAt: { lt: new Date(cursor.createdAt) } },
                    { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
                  ],
                }
              : {}),
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: takePerKind,
          select: { id: true, channelId: true, senderId: true, body: true, createdAt: true },
        })
      : Promise.resolve([]),
    threadIds.length && kind !== "channel"
      ? prisma.message.findMany({
          where: {
            threadId: threadId ? threadId : { in: threadIds },
            deletedAt: null,
            ...(senderId ? { senderId } : {}),
            body: { contains: q, mode: "insensitive" },
            ...(cursor
              ? {
                  OR: [
                    { createdAt: { lt: new Date(cursor.createdAt) } },
                    { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
                  ],
                }
              : {}),
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: takePerKind,
          select: { id: true, threadId: true, senderId: true, body: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  const items = [
    ...chMsgs.map((m) => ({
      kind: "channel" as const,
      id: m.id,
      channelId: m.channelId,
      threadId: null,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
    ...dmMsgs.map((m) => ({
      kind: "dm" as const,
      id: m.id,
      channelId: null,
      threadId: m.threadId,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map((m) => ({
      ...m,
      snippet:
        m.body.length <= 200
          ? m.body
          : m.body.toLowerCase().includes(q.toLowerCase())
            ? m.body.slice(Math.max(0, m.body.toLowerCase().indexOf(q.toLowerCase()) - 40), Math.min(m.body.length, m.body.toLowerCase().indexOf(q.toLowerCase()) + 160))
            : m.body.slice(0, 200),
    }));

  const nextCursor = items.length === limit ? encodeCursor({ createdAt: items[items.length - 1]!.createdAt, id: items[items.length - 1]!.id }) : null;
  return res.json({ items, nextCursor });
});

