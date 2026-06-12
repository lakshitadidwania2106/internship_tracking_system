import "dotenv/config";

import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseFilePath } from "@/lib/database-path";
import { createSqliteAdapter } from "@/lib/prisma-adapter";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaDbPath?: string;
};

const dbPath = getDatabaseFilePath();

function createPrismaClient() {
  return new PrismaClient({
    adapter: createSqliteAdapter(),
    log: ["error", "warn"],
  });
}

/** Recreate client if the DB path changed (e.g. after fixing DATABASE_URL). */
export const prisma =
  globalForPrisma.prisma && globalForPrisma.prismaDbPath === dbPath
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaDbPath = dbPath;
}
