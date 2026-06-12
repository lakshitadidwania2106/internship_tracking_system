import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
};

function getPgPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  if (!globalForPg.pgPool) {
    globalForPg.pgPool = new Pool({ connectionString });
  }

  return globalForPg.pgPool;
}

export function createPgAdapter() {
  return new PrismaPg(getPgPool());
}
