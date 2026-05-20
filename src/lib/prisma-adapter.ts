import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

function resolveSqlitePath() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const raw = url.replace(/^file:/i, "").trim();
  if (path.isAbsolute(raw)) {
    return raw;
  }
  return path.join(process.cwd(), raw.replace(/^\.\//, ""));
}

export function createSqliteAdapter() {
  const dbPath = resolveSqlitePath();
  return new PrismaBetterSqlite3({ url: `file:${dbPath}` });
}
