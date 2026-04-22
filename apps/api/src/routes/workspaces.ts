import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";

export const workspacesRouter = Router();
workspacesRouter.use(requireAuth);

workspacesRouter.get("/me", async (req, res) => {
  const userId = req.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) return res.status(404).json({ error: "user_not_found" });
  return res.json({ id: user.id, email: user.email });
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
    select: { user: { select: { id: true, email: true } }, role: true },
    orderBy: { userId: "asc" },
  });

  return res.json(
    members.map((m) => ({ id: m.user.id, email: m.user.email, role: m.role })),
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

  return res.status(201).json({ id: user.id, email: user.email, role: parsed.data.role });
});

