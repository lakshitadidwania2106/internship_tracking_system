import { PrismaClient } from "@/generated/prisma/client";
import { createSqliteAdapter } from "@/lib/prisma-adapter";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createSqliteAdapter(),
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
