import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { getDatabaseFilePath } from "@/lib/database-path";

export function createSqliteAdapter() {
  const dbPath = getDatabaseFilePath();
  // Adapter strips the "file:" prefix and opens that path with better-sqlite3.
  return new PrismaBetterSqlite3({ url: `file:${dbPath}` });
}
