import { prisma } from "../prisma.js";

/**
 * Idempotent backfill to support group DMs while preserving existing direct threads/messages.
 *
 * This repo currently uses `prisma db push` (no prisma/migrations). We still need to
 * migrate existing data from `DirectThread` into the new `DmThread` + `DmParticipant`
 * tables so the app can uniformly query DMs.
 */
export async function backfillDmThreadsFromDirectThreads() {
  const directThreads = await prisma.directThread.findMany({
    select: { id: true, workspaceId: true, userAId: true, userBId: true, createdAt: true },
  });

  for (const t of directThreads) {
    // Create DmThread with same id so existing Message.threadId remains valid.
    await prisma.dmThread.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        workspaceId: t.workspaceId,
        kind: "direct",
        createdAt: t.createdAt,
        directUserAId: t.userAId,
        directUserBId: t.userBId,
        participants: {
          create: [
            { userId: t.userAId, role: "member", joinedAt: t.createdAt },
            { userId: t.userBId, role: "member", joinedAt: t.createdAt },
          ],
        },
      },
      update: {},
    });
  }
}

