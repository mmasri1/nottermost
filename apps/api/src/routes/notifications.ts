import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

type NotifCursor = { createdAt: string; id: string };
function encodeCursor(c: NotifCursor) {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}
function decodeCursor(raw: string): NotifCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as NotifCursor;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

notificationsRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const workspaceId = z.string().uuid().optional().safeParse(req.query.workspaceId);
  if (!workspaceId.success) return res.status(400).json({ error: "invalid_workspace_id" });

  const limit = z.coerce.number().min(1).max(100).catch(30).parse(req.query.limit);
  const cursorRaw = z.string().optional().parse(req.query.cursor);
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  if (cursorRaw && !cursor) return res.status(400).json({ error: "invalid_cursor" });

  const where: any = { userId };
  if (workspaceId.data) where.workspaceId = workspaceId.data;
  if (cursor) {
    where.OR = [
      { createdAt: { lt: new Date(cursor.createdAt) } },
      { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
    ];
  }

  const notifs = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = notifs.length > limit;
  const items = (hasMore ? notifs.slice(0, limit) : notifs).map((n) => ({
    id: n.id,
    kind: n.kind,
    entityType: n.entityType,
    entityId: n.entityId,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt ? n.readAt.toISOString() : null,
    fromUserId: n.fromUserId,
    workspaceId: n.workspaceId,
    channelId: n.channelId,
    threadId: n.threadId,
    snippet: n.snippet,
  }));

  const nextCursor =
    hasMore && items.length
      ? encodeCursor({ createdAt: items[items.length - 1]!.createdAt, id: items[items.length - 1]!.id })
      : null;

  return res.json({ items, nextCursor });
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const userId = req.userId!;
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "invalid_notification_id" });

  const existing = await prisma.notification.findUnique({ where: { id: id.data }, select: { id: true, userId: true } });
  if (!existing) return res.status(404).json({ error: "notification_not_found" });
  if (existing.userId !== userId) return res.status(403).json({ error: "not_your_notification" });

  await prisma.notification.update({ where: { id: existing.id }, data: { readAt: new Date() } });
  return res.status(204).end();
});

