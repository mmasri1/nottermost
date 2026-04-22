import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { publishThreadEvent } from "../ws/realtime.js";
import type { WsServerMessage } from "@nottermost/shared";
import { filterUsersAllowingDmMentions, resolveDmMentionRecipientIds } from "../mentionTargets.js";

export const dmRouter = Router();
dmRouter.use(requireAuth);

function normalizePair(a: string, b: string) {
  return a < b ? [a, b] : [b, a];
}

const createThreadSchema = z.union([
  z.object({
    workspaceId: z.string().uuid(),
    otherUserId: z.string().uuid(),
  }),
  z.object({
    workspaceId: z.string().uuid(),
    memberIds: z.array(z.string().uuid()).min(2).max(20),
    name: z.string().min(1).max(80).optional(),
  }),
]);

dmRouter.post("/threads", async (req, res) => {
  const userId = req.userId!;
  const parsed = createThreadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const workspaceId = parsed.data.workspaceId;

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { workspaceId: true },
  });
  if (!membership) return res.status(403).json({ error: "not_a_member" });

  // Direct thread creation (backward compatible)
  if ("otherUserId" in parsed.data) {
    const { otherUserId } = parsed.data;
    if (otherUserId === userId) return res.status(400).json({ error: "invalid_other_user" });

    const otherMembership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: otherUserId } },
      select: { workspaceId: true },
    });
    if (!otherMembership) return res.status(404).json({ error: "user_not_in_workspace" });

    const [userAId, userBId] = normalizePair(userId, otherUserId);

    const thread =
      (await prisma.dmThread.findUnique({
        where: { workspaceId_directUserAId_directUserBId: { workspaceId, directUserAId: userAId, directUserBId: userBId } },
      })) ??
      (await prisma.dmThread.create({
        data: {
          workspaceId,
          kind: "direct",
          directUserAId: userAId,
          directUserBId: userBId,
          participants: {
            create: [
              { userId: userAId, role: "member" },
              { userId: userBId, role: "member" },
            ],
          },
        },
      }));

    return res.status(201).json({
      id: thread.id,
      workspaceId: thread.workspaceId,
      userAId: thread.directUserAId,
      userBId: thread.directUserBId,
      createdAt: thread.createdAt.toISOString(),
    });
  }

  // Group DM thread creation
  const uniqueMembers = Array.from(new Set([userId, ...parsed.data.memberIds]));
  if (uniqueMembers.length < 3) return res.status(400).json({ error: "group_requires_3_plus" });

  const wsMembers = await prisma.workspaceMember.findMany({
    where: { workspaceId, userId: { in: uniqueMembers } },
    select: { userId: true },
  });
  if (wsMembers.length !== uniqueMembers.length) return res.status(404).json({ error: "member_not_in_workspace" });

  const thread = await prisma.dmThread.create({
    data: {
      workspaceId,
      kind: "group",
      name: parsed.data.name,
      participants: {
        create: uniqueMembers.map((id) => ({ userId: id, role: id === userId ? "owner" : "member" })),
      },
    },
  });

  return res.status(201).json({
    id: thread.id,
    workspaceId: thread.workspaceId,
    kind: thread.kind,
    name: thread.name,
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

  const threads = await prisma.dmThread.findMany({
    where: {
      workspaceId: workspaceId.data,
      participants: { some: { userId } },
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      workspaceId: true,
      kind: true,
      name: true,
      createdAt: true,
      directUserAId: true,
      directUserBId: true,
      participants: {
        select: { userId: true, user: { select: { email: true } } },
        orderBy: { joinedAt: "asc" },
      },
      messages: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return res.json(
    threads.map((t) => ({
      id: t.id,
      workspaceId: t.workspaceId,
      kind: t.kind,
      name: t.name,
      createdAt: t.createdAt.toISOString(),
      userAId: t.directUserAId,
      userBId: t.directUserBId,
      participantEmails: t.participants.map((p) => p.user.email),
      lastMessageAt: t.messages[0]?.createdAt.toISOString() ?? null,
    })),
  );
});

const createMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  fileIds: z.array(z.string().uuid()).max(10).optional(),
});

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

  const thread = await prisma.dmThread.findUnique({
    where: { id: threadId.data },
    select: { id: true, workspaceId: true },
  });
  if (!thread) return res.status(404).json({ error: "thread_not_found" });

  const participant = await prisma.dmParticipant.findUnique({
    where: { threadId_userId: { threadId: thread.id, userId } },
    select: { userId: true },
  });
  if (!participant) return res.status(403).json({ error: "not_in_thread" });

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

  const thread = await prisma.dmThread.findUnique({
    where: { id: threadId.data },
    select: { id: true, workspaceId: true },
  });
  if (!thread) return res.status(404).json({ error: "thread_not_found" });

  const participant = await prisma.dmParticipant.findUnique({
    where: { threadId_userId: { threadId: thread.id, userId } },
    select: { userId: true },
  });
  if (!participant) return res.status(403).json({ error: "not_in_thread" });

  const msg = await prisma.message.create({
    data: { threadId: thread.id, senderId: userId, body: parsed.data.body },
  });

  if (parsed.data.fileIds?.length) {
    const files = await prisma.fileObject.findMany({
      where: { id: { in: parsed.data.fileIds }, workspaceId: thread.workspaceId },
      select: { id: true },
    });
    await prisma.dmMessageAttachment.createMany({
      data: files.map((f) => ({ messageId: msg.id, fileId: f.id })),
      skipDuplicates: true,
    });
    await prisma.fileGrant.createMany({
      data: files.map((f) => ({ fileId: f.id, kind: "dmThread", threadId: thread.id })),
      skipDuplicates: true,
    });
  }

  // Mentions -> notifications (best-effort).
  const mentionRecipients = await resolveDmMentionRecipientIds({
    body: msg.body,
    threadId: thread.id,
    senderId: userId,
  });
  const allowedRecipients = await filterUsersAllowingDmMentions(thread.workspaceId, mentionRecipients);
  if (allowedRecipients.length) {
    await prisma.notification.createMany({
      data: allowedRecipients.map((uid) => ({
        userId: uid,
        kind: "mention",
        entityType: "dmMessage",
        entityId: msg.id,
        fromUserId: userId,
        workspaceId: thread.workspaceId,
        threadId: thread.id,
        snippet: msg.body.slice(0, 140),
      })),
    });
  }

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

const editDmMessageSchema = z.object({ body: z.string().min(1).max(4000) });
dmRouter.patch("/threads/:threadId/messages/:messageId", async (req, res) => {
  const userId = req.userId!;
  const threadId = z.string().uuid().safeParse(req.params.threadId);
  const messageId = z.string().uuid().safeParse(req.params.messageId);
  if (!threadId.success) return res.status(400).json({ error: "invalid_thread_id" });
  if (!messageId.success) return res.status(400).json({ error: "invalid_message_id" });
  const parsed = editDmMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const participant = await prisma.dmParticipant.findUnique({
    where: { threadId_userId: { threadId: threadId.data, userId } },
    select: { userId: true },
  });
  if (!participant) return res.status(403).json({ error: "not_in_thread" });

  const msg = await prisma.message.findUnique({
    where: { id: messageId.data },
    select: { id: true, threadId: true, senderId: true, deletedAt: true, createdAt: true },
  });
  if (!msg || msg.threadId !== threadId.data) return res.status(404).json({ error: "message_not_found" });
  if (msg.deletedAt) return res.status(409).json({ error: "message_deleted" });
  if (msg.senderId !== userId) return res.status(403).json({ error: "not_message_author" });

  const updated = await prisma.message.update({
    where: { id: msg.id },
    data: { body: parsed.data.body, editedAt: new Date() },
  });

  const wsPayload: WsServerMessage = {
    type: "message.updated" as any,
    message: {
      id: updated.id,
      threadId: updated.threadId,
      senderId: updated.senderId,
      body: updated.body,
      createdAt: updated.createdAt.toISOString(),
      editedAt: updated.editedAt?.toISOString() ?? null,
      deletedAt: updated.deletedAt?.toISOString() ?? null,
    } as any,
  };
  void publishThreadEvent(threadId.data, wsPayload);
  return res.json({ ok: true });
});

dmRouter.delete("/threads/:threadId/messages/:messageId", async (req, res) => {
  const userId = req.userId!;
  const threadId = z.string().uuid().safeParse(req.params.threadId);
  const messageId = z.string().uuid().safeParse(req.params.messageId);
  if (!threadId.success) return res.status(400).json({ error: "invalid_thread_id" });
  if (!messageId.success) return res.status(400).json({ error: "invalid_message_id" });

  const participant = await prisma.dmParticipant.findUnique({
    where: { threadId_userId: { threadId: threadId.data, userId } },
    select: { userId: true },
  });
  if (!participant) return res.status(403).json({ error: "not_in_thread" });

  const msg = await prisma.message.findUnique({
    where: { id: messageId.data },
    select: { id: true, threadId: true, senderId: true, deletedAt: true, createdAt: true },
  });
  if (!msg || msg.threadId !== threadId.data) return res.status(404).json({ error: "message_not_found" });
  if (msg.deletedAt) return res.status(204).end();
  if (msg.senderId !== userId) return res.status(403).json({ error: "not_message_author" });

  const updated = await prisma.message.update({
    where: { id: msg.id },
    data: { deletedAt: new Date(), deletedById: userId },
  });

  const wsPayload: WsServerMessage = {
    type: "message.updated" as any,
    message: {
      id: updated.id,
      threadId: updated.threadId,
      senderId: updated.senderId,
      body: "",
      createdAt: updated.createdAt.toISOString(),
      editedAt: updated.editedAt?.toISOString() ?? null,
      deletedAt: updated.deletedAt?.toISOString() ?? null,
    } as any,
  };
  void publishThreadEvent(threadId.data, wsPayload);
  return res.status(204).end();
});

const reactionSchema = z.object({ emoji: z.string().min(1).max(32) });
dmRouter.post("/threads/:threadId/messages/:messageId/reactions", async (req, res) => {
  const userId = req.userId!;
  const threadId = z.string().uuid().safeParse(req.params.threadId);
  const messageId = z.string().uuid().safeParse(req.params.messageId);
  if (!threadId.success) return res.status(400).json({ error: "invalid_thread_id" });
  if (!messageId.success) return res.status(400).json({ error: "invalid_message_id" });
  const parsed = reactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const participant = await prisma.dmParticipant.findUnique({
    where: { threadId_userId: { threadId: threadId.data, userId } },
    select: { userId: true },
  });
  if (!participant) return res.status(403).json({ error: "not_in_thread" });

  const msg = await prisma.message.findUnique({ where: { id: messageId.data }, select: { id: true, threadId: true, deletedAt: true } });
  if (!msg || msg.threadId !== threadId.data) return res.status(404).json({ error: "message_not_found" });
  if (msg.deletedAt) return res.status(409).json({ error: "message_deleted" });

  try {
    await prisma.messageReaction.create({ data: { messageId: msg.id, userId, emoji: parsed.data.emoji } });
  } catch {
    // already reacted
  }

  const wsPayload: WsServerMessage = { type: "reaction.updated" as any, scope: "dm", threadId: threadId.data, messageId: msg.id, emoji: parsed.data.emoji } as any;
  void publishThreadEvent(threadId.data, wsPayload);
  return res.status(201).json({ ok: true });
});

dmRouter.delete("/threads/:threadId/messages/:messageId/reactions", async (req, res) => {
  const userId = req.userId!;
  const threadId = z.string().uuid().safeParse(req.params.threadId);
  const messageId = z.string().uuid().safeParse(req.params.messageId);
  if (!threadId.success) return res.status(400).json({ error: "invalid_thread_id" });
  if (!messageId.success) return res.status(400).json({ error: "invalid_message_id" });
  const emoji = z.string().min(1).max(32).safeParse(req.query.emoji);
  if (!emoji.success) return res.status(400).json({ error: "invalid_emoji" });

  const participant = await prisma.dmParticipant.findUnique({
    where: { threadId_userId: { threadId: threadId.data, userId } },
    select: { userId: true },
  });
  if (!participant) return res.status(403).json({ error: "not_in_thread" });

  await prisma.messageReaction.deleteMany({ where: { messageId: messageId.data, userId, emoji: emoji.data } });
  const wsPayload: WsServerMessage = { type: "reaction.updated" as any, scope: "dm", threadId: threadId.data, messageId: messageId.data, emoji: emoji.data } as any;
  void publishThreadEvent(threadId.data, wsPayload);
  return res.status(204).end();
});

dmRouter.post("/threads/:threadId/read", async (req, res) => {
  const userId = req.userId!;
  const threadId = z.string().uuid().safeParse(req.params.threadId);
  if (!threadId.success) return res.status(400).json({ error: "invalid_thread_id" });

  const participant = await prisma.dmParticipant.findUnique({
    where: { threadId_userId: { threadId: threadId.data, userId } },
    select: { userId: true },
  });
  if (!participant) return res.status(403).json({ error: "not_in_thread" });

  const lastReadAt = new Date();
  await prisma.dmReadState.upsert({
    where: { threadId_userId: { threadId: threadId.data, userId } },
    create: { threadId: threadId.data, userId, lastReadAt },
    update: { lastReadAt },
  });

  const wsPayload: WsServerMessage = { type: "readState.updated" as any, scope: "dm", threadId: threadId.data, userId, lastReadAt: lastReadAt.toISOString() } as any;
  void publishThreadEvent(threadId.data, wsPayload);
  return res.status(204).end();
});

