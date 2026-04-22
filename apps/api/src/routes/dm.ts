import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { publishThreadEvent } from "../ws/realtime.js";
import type { WsServerMessage } from "@nottermost/shared";

export const dmRouter = Router();
dmRouter.use(requireAuth);

function normalizePair(a: string, b: string) {
  return a < b ? [a, b] : [b, a];
}

const createThreadSchema = z.object({
  workspaceId: z.string().uuid(),
  otherUserId: z.string().uuid(),
});

dmRouter.post("/threads", async (req, res) => {
  const userId = req.userId!;
  const parsed = createThreadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const { workspaceId, otherUserId } = parsed.data;
  if (otherUserId === userId) return res.status(400).json({ error: "invalid_other_user" });

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { workspaceId: true },
  });
  if (!membership) return res.status(403).json({ error: "not_a_member" });

  const otherMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: otherUserId } },
    select: { workspaceId: true },
  });
  if (!otherMembership) return res.status(404).json({ error: "user_not_in_workspace" });

  const [userAId, userBId] = normalizePair(userId, otherUserId);

  const thread =
    (await prisma.directThread.findUnique({
      where: { workspaceId_userAId_userBId: { workspaceId, userAId, userBId } },
    })) ??
    (await prisma.directThread.create({
      data: { workspaceId, userAId, userBId },
    }));

  return res.status(201).json({
    id: thread.id,
    workspaceId: thread.workspaceId,
    userAId: thread.userAId,
    userBId: thread.userBId,
    createdAt: thread.createdAt.toISOString(),
  });
});

dmRouter.get("/threads", async (req, res) => {
  const userId = req.userId!;
  const workspaceId = z.string().uuid().safeParse(req.query.workspaceId);
  if (!workspaceId.success) return res.status(400).json({ error: "invalid_workspace_id" });

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspaceId.data, userId } },
    select: { workspaceId: true },
  });
  if (!membership) return res.status(403).json({ error: "not_a_member" });

  const threads = await prisma.directThread.findMany({
    where: {
      workspaceId: workspaceId.data,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json(
    threads.map((t) => ({
      id: t.id,
      workspaceId: t.workspaceId,
      userAId: t.userAId,
      userBId: t.userBId,
      createdAt: t.createdAt.toISOString(),
    })),
  );
});

const createMessageSchema = z.object({ body: z.string().min(1).max(4000) });

type MsgCursor = { createdAt: string; id: string };
function encodeCursor(c: MsgCursor) {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}
function decodeCursor(raw: string): MsgCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as MsgCursor;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

dmRouter.get("/threads/:id/messages", async (req, res) => {
  const userId = req.userId!;
  const threadId = z.string().uuid().safeParse(req.params.id);
  if (!threadId.success) return res.status(400).json({ error: "invalid_thread_id" });

  const limit = z.coerce.number().min(1).max(100).catch(30).parse(req.query.limit);
  const cursorRaw = z.string().optional().parse(req.query.cursor);
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  if (cursorRaw && !cursor) return res.status(400).json({ error: "invalid_cursor" });

  const thread = await prisma.directThread.findUnique({
    where: { id: threadId.data },
    select: { id: true, workspaceId: true, userAId: true, userBId: true },
  });
  if (!thread) return res.status(404).json({ error: "thread_not_found" });
  if (thread.userAId !== userId && thread.userBId !== userId)
    return res.status(403).json({ error: "not_in_thread" });

  const where =
    cursor && cursor.createdAt && cursor.id
      ? {
          threadId: thread.id,
          OR: [
            { createdAt: { lt: new Date(cursor.createdAt) } },
            { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
          ],
        }
      : { threadId: thread.id };

  const msgs = await prisma.message.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = msgs.length > limit;
  const items = (hasMore ? msgs.slice(0, limit) : msgs).map((m) => ({
    id: m.id,
    threadId: m.threadId,
    senderId: m.senderId,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));

  const nextCursor =
    hasMore && items.length
      ? encodeCursor({ createdAt: items[items.length - 1]!.createdAt, id: items[items.length - 1]!.id })
      : null;

  return res.json({ items, nextCursor });
});

dmRouter.post("/threads/:id/messages", async (req, res) => {
  const userId = req.userId!;
  const threadId = z.string().uuid().safeParse(req.params.id);
  if (!threadId.success) return res.status(400).json({ error: "invalid_thread_id" });

  const parsed = createMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const thread = await prisma.directThread.findUnique({
    where: { id: threadId.data },
    select: { id: true, userAId: true, userBId: true },
  });
  if (!thread) return res.status(404).json({ error: "thread_not_found" });
  if (thread.userAId !== userId && thread.userBId !== userId)
    return res.status(403).json({ error: "not_in_thread" });

  const msg = await prisma.message.create({
    data: { threadId: thread.id, senderId: userId, body: parsed.data.body },
  });

  const wsPayload: WsServerMessage = {
    type: "message.created",
    message: {
      id: msg.id,
      threadId: msg.threadId,
      senderId: msg.senderId,
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
    },
  };
  void publishThreadEvent(thread.id, wsPayload);

  return res.status(201).json({
    id: msg.id,
    threadId: msg.threadId,
    senderId: msg.senderId,
    body: msg.body,
    createdAt: msg.createdAt.toISOString(),
  });
});

