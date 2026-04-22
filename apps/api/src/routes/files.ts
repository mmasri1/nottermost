import { Router } from "express";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import multer from "multer";

import { prisma } from "../prisma.js";
import { requireAuth } from "../auth.js";
import { env } from "../env.js";

export const filesRouter = Router();
filesRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB

async function ensureFilesDir() {
  await fs.mkdir(env.FILES_DIR, { recursive: true });
}

function storageKeyFor(workspaceId: string, fileId: string, original: string) {
  const ext = path.extname(original).slice(0, 16);
  return path.posix.join(workspaceId, `${fileId}${ext ? ext : ""}`);
}

async function requireWorkspaceMember(workspaceId: string, userId: string) {
  return await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { workspaceId: true },
  });
}

const uploadQuery = z.object({
  workspaceId: z.string().uuid(),
  channelId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
});

filesRouter.post("/upload", upload.single("file"), async (req, res) => {
  const userId = req.userId!;
  const parsed = uploadQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid_query" });
  if (!req.file) return res.status(400).json({ error: "missing_file" });

  const { workspaceId, channelId, threadId } = parsed.data;
  if ((channelId ? 1 : 0) + (threadId ? 1 : 0) !== 1) return res.status(400).json({ error: "scope_required" });

  const membership = await requireWorkspaceMember(workspaceId, userId);
  if (!membership) return res.status(403).json({ error: "not_a_member" });

  // Scope permission: validate membership to channel or dm thread
  if (channelId) {
    const ch = await prisma.channel.findUnique({ where: { id: channelId }, select: { id: true, workspaceId: true } });
    if (!ch || ch.workspaceId !== workspaceId) return res.status(404).json({ error: "channel_not_found" });
    const cm = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId: ch.id, userId } },
      select: { userId: true },
    });
    if (!cm) return res.status(403).json({ error: "not_in_channel" });
  }

  if (threadId) {
    const part = await prisma.dmParticipant.findUnique({
      where: { threadId_userId: { threadId, userId } },
      select: { thread: { select: { workspaceId: true } } },
    });
    if (!part) return res.status(403).json({ error: "not_in_thread" });
    if (part.thread.workspaceId !== workspaceId) return res.status(404).json({ error: "thread_not_found" });
  }

  await ensureFilesDir();

  const fileId = crypto.randomUUID();
  const storageKey = storageKeyFor(workspaceId, fileId, req.file.originalname);
  const abs = path.join(env.FILES_DIR, storageKey);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, req.file.buffer);

  const sha256 = crypto.createHash("sha256").update(req.file.buffer).digest("hex");

  const created = await prisma.fileObject.create({
    data: {
      id: fileId,
      workspaceId,
      uploaderId: userId,
      storageKey,
      filename: req.file.originalname,
      contentType: req.file.mimetype || "application/octet-stream",
      sizeBytes: req.file.size,
      sha256,
      grants: {
        create: [{ kind: channelId ? "channel" : "dmThread", channelId: channelId ?? null, threadId: threadId ?? null }],
      },
    },
  });

  return res.status(201).json({
    id: created.id,
    filename: created.filename,
    contentType: created.contentType,
    sizeBytes: created.sizeBytes,
    createdAt: created.createdAt.toISOString(),
    url: `/files/${created.id}/download`,
  });
});

filesRouter.get("/:id", async (req, res) => {
  const userId = req.userId!;
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "invalid_file_id" });

  const file = await prisma.fileObject.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      workspaceId: true,
      uploaderId: true,
      createdAt: true,
      filename: true,
      contentType: true,
      sizeBytes: true,
      sha256: true,
      grants: { select: { kind: true, channelId: true, threadId: true } },
    },
  });
  if (!file) return res.status(404).json({ error: "file_not_found" });

  // Must be in workspace and have access to at least one grant scope.
  const membership = await requireWorkspaceMember(file.workspaceId, userId);
  if (!membership) return res.status(403).json({ error: "not_a_member" });

  let allowed = false;
  for (const g of file.grants) {
    if (g.kind === "channel" && g.channelId) {
      const cm = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: g.channelId, userId } },
        select: { userId: true },
      });
      if (cm) {
        allowed = true;
        break;
      }
    }
    if (g.kind === "dmThread" && g.threadId) {
      const part = await prisma.dmParticipant.findUnique({
        where: { threadId_userId: { threadId: g.threadId, userId } },
        select: { userId: true },
      });
      if (part) {
        allowed = true;
        break;
      }
    }
  }
  if (!allowed) return res.status(403).json({ error: "no_access" });

  return res.json({
    id: file.id,
    filename: file.filename,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    sha256: file.sha256,
    createdAt: file.createdAt.toISOString(),
    url: `/files/${file.id}/download`,
  });
});

filesRouter.get("/:id/download", async (req, res) => {
  const userId = req.userId!;
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "invalid_file_id" });

  const file = await prisma.fileObject.findUnique({
    where: { id: id.data },
    select: { id: true, workspaceId: true, storageKey: true, filename: true, contentType: true, grants: { select: { kind: true, channelId: true, threadId: true } } },
  });
  if (!file) return res.status(404).json({ error: "file_not_found" });

  const membership = await requireWorkspaceMember(file.workspaceId, userId);
  if (!membership) return res.status(403).json({ error: "not_a_member" });

  let allowed = false;
  for (const g of file.grants) {
    if (g.kind === "channel" && g.channelId) {
      const cm = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: g.channelId, userId } },
        select: { userId: true },
      });
      if (cm) {
        allowed = true;
        break;
      }
    }
    if (g.kind === "dmThread" && g.threadId) {
      const part = await prisma.dmParticipant.findUnique({
        where: { threadId_userId: { threadId: g.threadId, userId } },
        select: { userId: true },
      });
      if (part) {
        allowed = true;
        break;
      }
    }
  }
  if (!allowed) return res.status(403).json({ error: "no_access" });

  const abs = path.join(env.FILES_DIR, file.storageKey);
  try {
    await fs.stat(abs);
  } catch {
    return res.status(404).json({ error: "file_missing_on_disk" });
  }

  res.setHeader("content-type", file.contentType);
  res.setHeader("content-disposition", `inline; filename=\"${encodeURIComponent(file.filename)}\"`);
  return res.sendFile(abs);
});

