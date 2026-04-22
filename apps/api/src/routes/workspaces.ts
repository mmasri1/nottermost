import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

export const workspacesRouter = Router();
workspacesRouter.use(requireAuth);

workspacesRouter.get("/me", async (req, res) => {
  const userId = req.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, avatarUrl: true, statusText: true },
  });
  if (!user) return res.status(404).json({ error: "user_not_found" });
  return res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    statusText: user.statusText,
  });
});

const profilePatchSchema = z.object({
  displayName: z.union([z.string().max(80), z.null()]).optional(),
  avatarUrl: z.union([z.string().max(2048), z.null()]).optional(),
  statusText: z.union([z.string().max(120), z.null()]).optional(),
});

workspacesRouter.patch("/me/profile", async (req, res) => {
  const userId = req.userId!;
  const parsed = profilePatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const data: {
    displayName?: string | null;
    avatarUrl?: string | null;
    statusText?: string | null;
  } = {};

  if (parsed.data.displayName !== undefined) {
    const v = parsed.data.displayName;
    if (v === null) data.displayName = null;
    else {
      const trimmed = v.trim();
      data.displayName = trimmed.length ? trimmed : null;
    }
  }

  if (parsed.data.avatarUrl !== undefined) {
    const v = parsed.data.avatarUrl;
    if (v === null) data.avatarUrl = null;
    else {
      const trimmed = v.trim();
      if (!trimmed.length) data.avatarUrl = null;
      else if (!(trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
        return res.status(400).json({ error: "invalid_avatar_url" });
      } else data.avatarUrl = trimmed;
    }
  }

  if (parsed.data.statusText !== undefined) {
    const v = parsed.data.statusText;
    if (v === null) data.statusText = null;
    else {
      const trimmed = v.trim();
      data.statusText = trimmed.length ? trimmed : null;
    }
  }

  if (!Object.keys(data).length) return res.status(400).json({ error: "empty_patch" });

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, displayName: true, avatarUrl: true, statusText: true },
  });

  return res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    statusText: user.statusText,
  });
});

workspacesRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const workspaces = await prisma.workspace.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "desc" },
  });
  return res.json(
    workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      createdAt: w.createdAt.toISOString(),
    })),
  );
});

const createSchema = z.object({ name: z.string().min(1).max(80) });
workspacesRouter.post("/", async (req, res) => {
  const userId = req.userId!;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const ws = await prisma.workspace.create({
    data: {
      name: parsed.data.name,
      members: { create: { userId, role: "owner" } },
    },
  });

  return res.status(201).json({
    id: ws.id,
    name: ws.name,
    createdAt: ws.createdAt.toISOString(),
  });
});

const notifPrefsSchema = z.object({
  notifyChannelMentions: z.boolean().optional(),
  notifyDmMentions: z.boolean().optional(),
});

workspacesRouter.get("/:id/me/notification-prefs", async (req, res) => {
  const userId = req.userId!;
  const workspaceId = z.string().uuid().safeParse(req.params.id);
  if (!workspaceId.success) return res.status(400).json({ error: "invalid_workspace_id" });

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspaceId.data, userId } },
    select: { notifyChannelMentions: true, notifyDmMentions: true },
  });
  if (!membership) return res.status(403).json({ error: "not_a_member" });

  return res.json({
    notifyChannelMentions: membership.notifyChannelMentions,
    notifyDmMentions: membership.notifyDmMentions,
  });
});

workspacesRouter.patch("/:id/me/notification-prefs", async (req, res) => {
  const userId = req.userId!;
  const workspaceId = z.string().uuid().safeParse(req.params.id);
  if (!workspaceId.success) return res.status(400).json({ error: "invalid_workspace_id" });

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspaceId.data, userId } },
    select: { workspaceId: true },
  });
  if (!membership) return res.status(403).json({ error: "not_a_member" });

  const parsed = notifPrefsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const data: { notifyChannelMentions?: boolean; notifyDmMentions?: boolean } = {};
  if (parsed.data.notifyChannelMentions !== undefined) data.notifyChannelMentions = parsed.data.notifyChannelMentions;
  if (parsed.data.notifyDmMentions !== undefined) data.notifyDmMentions = parsed.data.notifyDmMentions;
  if (!Object.keys(data).length) return res.status(400).json({ error: "empty_patch" });

  const updated = await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId: workspaceId.data, userId } },
    data,
    select: { notifyChannelMentions: true, notifyDmMentions: true },
  });

  return res.json({
    notifyChannelMentions: updated.notifyChannelMentions,
    notifyDmMentions: updated.notifyDmMentions,
  });
});

workspacesRouter.get("/:id/members", async (req, res) => {
  const userId = req.userId!;
  const workspaceId = z.string().uuid().safeParse(req.params.id);
  if (!workspaceId.success) return res.status(400).json({ error: "invalid_workspace_id" });

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspaceId.data, userId } },
    select: { workspaceId: true },
  });
  if (!membership) return res.status(403).json({ error: "not_a_member" });

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspaceId.data },
    select: { user: { select: { id: true, email: true, displayName: true, avatarUrl: true, statusText: true } }, role: true },
    orderBy: { userId: "asc" },
  });

  return res.json(
    members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      statusText: m.user.statusText,
      role: m.role,
    })),
  );
});

const addMemberSchema = z.object({ email: z.string().email(), role: z.string().min(1).max(32).default("member") });
workspacesRouter.post("/:id/members", async (req, res) => {
  const userId = req.userId!;
  const workspaceId = z.string().uuid().safeParse(req.params.id);
  if (!workspaceId.success) return res.status(400).json({ error: "invalid_workspace_id" });

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspaceId.data, userId } },
    select: { role: true },
  });
  if (!membership) return res.status(403).json({ error: "not_a_member" });
  if (membership.role !== "owner") return res.status(403).json({ error: "insufficient_role" });

  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.status(404).json({ error: "user_not_found" });

  try {
    await prisma.workspaceMember.create({
      data: { workspaceId: workspaceId.data, userId: user.id, role: parsed.data.role },
    });
  } catch {
    return res.status(409).json({ error: "already_member" });
  }

  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, displayName: true, avatarUrl: true, statusText: true },
  });
  if (!fresh) return res.status(500).json({ error: "user_missing" });

  return res.status(201).json({
    id: fresh.id,
    email: fresh.email,
    displayName: fresh.displayName,
    avatarUrl: fresh.avatarUrl,
    statusText: fresh.statusText,
    role: parsed.data.role,
  });
});

