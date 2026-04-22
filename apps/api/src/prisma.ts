import type { PrismaClient } from "@prisma/client";

export let prisma: PrismaClient;

export async function initPrisma() {
  if (prisma) return prisma;
  const mod = await import("@prisma/client");
  prisma = new mod.PrismaClient();
  await prisma.$connect();
  return prisma;
}

