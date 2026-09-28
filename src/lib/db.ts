import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: env.databaseUrl }) });
}

export const db = globalForPrisma.prisma ?? create();
if (!env.isProd) globalForPrisma.prisma = db;
