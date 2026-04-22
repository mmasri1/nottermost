import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { publishChannelEvent } from "../ws/realtime.js";
import type { WsServerMessage } from "@nottermost/shared";

export const channelsRouter = Router();
channelsRouter.use(requireAuth);

async function requireWorkspaceMember(workspaceId: string, userId: string) {
  return await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { workspaceId: true, role: true },
  });
}

channelsRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const workspaceId = z.string().uuid().safeParse(req.query.workspaceId);
  if (!workspaceId.success) return res.status(400).json({ error: "invalid_workspace_id" });

  const membership = await requireWorkspaceMember(workspaceId.data, userId);
  if (!membership) return res.status(403).json({ error: "not_a_member" });

  const channels = await prisma.channel.findMany({
    where: {
      workspaceId: workspaceId.data,
      OR: [
        { isPrivate: false },
        { members: { some: { userId } } },
        { invites: { some: { inviteeId: userId } } },
      ],
    },
    orderBy: [{ isPrivate: "asc" }, { name: "asc" }],
    select: {
      id: true,
      workspaceId: true,
      name: true,
      isPrivate: true,
      createdAt: true,
      members: { where: { userId }, select: { userId: true } },
    },
  });

  return res.json(
    channels.map((c) => ({
      id: c.id,
      workspaceId: c.workspaceId,
      name: c.name,
      isPrivate: c.isPrivate,
      createdAt: c.createdAt.toISOString(),
      isMember: c.members.length > 0,
    })),
  );
});

const createChannelSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(80),
  isPrivate: z.boolean().optional().default(false),
});

channelsRouter.post("/", async (req, res) => {
  const userId = req.userId!;
  const parsed = createChannelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const membership = await requireWorkspaceMember(parsed.data.workspaceId, userId);
  if (!membership) return res.status(403).json({ error: "not_a_member" });

  try {
    const channel = await prisma.channel.create({
      data: {
        workspaceId: parsed.data.workspaceId,
        name: parsed.data.name,
        isPrivate: parsed.data.isPrivate,
        members: { create: { userId, role: "owner" } },
      },
    });

    return res.status(201).json({
      id: channel.id,
      workspaceId: channel.workspaceId,
      name: channel.name,
      isPrivate: channel.isPrivate,
      createdAt: channel.createdAt.toISOString(),
    });
  } catch {
    return res.status(409).json({ error: "channel_name_taken" });
  }
});

channelsRouter.post("/:id/join", async (req, res) => {
  const userId = req.userId!;
  const channelId = z.string().uuid().safeParse(req.params.id);
  if (!channelId.success) return res.status(400).json({ error: "invalid_channel_id" });

  const channel = await prisma.channel.findUnique({
    where: { id: channelId.data },
    select: { id: true, workspaceId: true, isPrivate: true },
  });
  if (!channel) return res.status(404).json({ error: "channel_not_found" });

  const wsMembership = await requireWorkspaceMember(channel.workspaceId, userId);
  if (!wsMembership) return res.status(403).json({ error: "not_a_member" });

  if (channel.isPrivate) {
    const invite = await prisma.channelInvite.findUnique({
      where: { channelId_inviteeId: { channelId: channel.id, inviteeId: userId } },
      select: { id: true },
    });
    if (!invite) return res.status(403).json({ error: "invite_required" });
  }

  try {
    await prisma.channelMember.create({
      data: { channelId: channel.id, userId, role: "member" },
    });
  } catch {
    // already a member
  }

  await prisma.channelInvite.deleteMany({
    where: { channelId: channel.id, inviteeId: userId },
  });

  return res.status(204).end();
});

channelsRouter.get("/invites", async (req, res) => {
  const userId = req.userId!;
  const workspaceId = z.string().uuid().safeParse(req.query.workspaceId);
  if (!workspaceId.success) return res.status(400).json({ error: "invalid_workspace_id" });

  const membership = await requireWorkspaceMember(workspaceId.data, userId);
  if (!membership) return res.status(403).json({ error: "not_a_member" });

  const invites = await prisma.channelInvite.findMany({
    where: { inviteeId: userId, channel: { workspaceId: workspaceId.data } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      channelId: true,
      createdAt: true,
      inviterId: true,
      inviter: { select: { email: true } },
      channel: { select: { name: true, workspaceId: true } },
    },
  });

  return res.json(
    invites.map((i) => ({
      id: i.id,
      channelId: i.channelId,
      channelName: i.channel.name,
      workspaceId: i.channel.workspaceId,
      inviterId: i.inviterId,
      inviterEmail: i.inviter.email,
      createdAt: i.createdAt.toISOString(),
    })),
  );
});

const createInviteSchema = z.object({ email: z.string().email() });
channelsRouter.post("/:id/invites", async (req, res) => {
  const userId = req.userId!;
  const channelId = z.string().uuid().safeParse(req.params.id);
  if (!channelId.success) return res.status(400).json({ error: "invalid_channel_id" });
  const parsed = createInviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const channel = await prisma.channel.findUnique({
    where: { id: channelId.data },
    select: { id: true, workspaceId: true },
  });
  if (!channel) return res.status(404).json({ error: "channel_not_found" });

  const wsMembership = await requireWorkspaceMember(channel.workspaceId, userId);
  if (!wsMembership) return res.status(403).json({ error: "not_a_member" });

  const meInChannel = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId } },
    select: { role: true },
  });
  if (!meInChannel) return res.status(403).json({ error: "not_in_channel" });

  const invitee = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (!invitee) return res.status(404).json({ error: "user_not_found" });

  const inviteeWsMembership = await requireWorkspaceMember(channel.workspaceId, invitee.id);
  if (!inviteeWsMembership) return res.status(404).json({ error: "user_not_in_workspace" });

  const existingMember = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId: invitee.id } },
    select: { userId: true },
  });
  if (existingMember) return res.status(409).json({ error: "already_member" });

  try {
    const invite = await prisma.channelInvite.create({
      data: { channelId: channel.id, inviterId: userId, inviteeId: invitee.id },
    });
    return res.status(201).json({ id: invite.id });
  } catch {
    return res.status(409).json({ error: "already_invited" });
  }
});

channelsRouter.post("/invites/:id/accept", async (req, res) => {
  const userId = req.userId!;
  const inviteId = z.string().uuid().safeParse(req.params.id);
  if (!inviteId.success) return res.status(400).json({ error: "invalid_invite_id" });

  const invite = await prisma.channelInvite.findUnique({
    where: { id: inviteId.data },
    select: { id: true, channelId: true, inviteeId: true, channel: { select: { workspaceId: true } } },
  });
  if (!invite) return res.status(404).json({ error: "invite_not_found" });
  if (invite.inviteeId !== userId) return res.status(403).json({ error: "not_your_invite" });

  const wsMembership = await requireWorkspaceMember(invite.channel.workspaceId, userId);
  if (!wsMembership) return res.status(403).json({ error: "not_a_member" });

  try {
    await prisma.channelMember.create({
      data: { channelId: invite.channelId, userId, role: "member" },
    });
  } catch {
    // already member
  }

  await prisma.channelInvite.delete({ where: { id: invite.id } });
  return res.status(204).end();
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

channelsRouter.get("/:id/messages", async (req, res) => {
  const userId = req.userId!;
  const channelId = z.string().uuid().safeParse(req.params.id);
  if (!channelId.success) return res.status(400).json({ error: "invalid_channel_id" });

  const limit = z.coerce.number().min(1).max(100).catch(30).parse(req.query.limit);
  const cursorRaw = z.string().optional().parse(req.query.cursor);
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  if (cursorRaw && !cursor) return res.status(400).json({ error: "invalid_cursor" });

  const channel = await prisma.channel.findUnique({
    where: { id: channelId.data },
    select: { id: true, workspaceId: true, isPrivate: true },
  });
  if (!channel) return res.status(404).json({ error: "channel_not_found" });

  const wsMembership = await requireWorkspaceMember(channel.workspaceId, userId);
  if (!wsMembership) return res.status(403).json({ error: "not_a_member" });

  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId } },
    select: { userId: true },
  });
  if (!member) return res.status(403).json({ error: "not_in_channel" });

  const where =
    cursor && cursor.createdAt && cursor.id
      ? {
          channelId: channel.id,
          OR: [
            { createdAt: { lt: new Date(cursor.createdAt) } },
            { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
          ],
        }
      : { channelId: channel.id };

  const msgs = await prisma.channelMessage.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = msgs.length > limit;
  const items = (hasMore ? msgs.slice(0, limit) : msgs).map((m) => ({
    id: m.id,
    channelId: m.channelId,
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

channelsRouter.post("/:id/messages", async (req, res) => {
  const userId = req.userId!;
  const channelId = z.string().uuid().safeParse(req.params.id);
  if (!channelId.success) return res.status(400).json({ error: "invalid_channel_id" });

  const parsed = createMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const channel = await prisma.channel.findUnique({
    where: { id: channelId.data },
    select: { id: true, workspaceId: true },
  });
  if (!channel) return res.status(404).json({ error: "channel_not_found" });

  const wsMembership = await requireWorkspaceMember(channel.workspaceId, userId);
  if (!wsMembership) return res.status(403).json({ error: "not_a_member" });

  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId } },
    select: { userId: true },
  });
  if (!member) return res.status(403).json({ error: "not_in_channel" });

  const msg = await prisma.channelMessage.create({
    data: { channelId: channel.id, senderId: userId, body: parsed.data.body },
  });

  const wsPayload: WsServerMessage = {
    type: "channelMessage.created",
    message: {
      id: msg.id,
      channelId: msg.channelId,
      senderId: msg.senderId,
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
    },
  };
  void publishChannelEvent(channel.id, wsPayload);

  return res.status(201).json({
    id: msg.id,
    channelId: msg.channelId,
    senderId: msg.senderId,
    body: msg.body,
    createdAt: msg.createdAt.toISOString(),
  });
});

