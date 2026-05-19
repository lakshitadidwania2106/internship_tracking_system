import path from "node:path";

/**
 * SQLite file used by the app and by `DATABASE_URL=file:./prisma/dev.db`.
 * Kept explicit so we never open an empty `./dev.db` at the project root.
 */
export function getDatabaseFilePath(): string {
  return path.resolve(process.cwd(), "prisma", "dev.db");
}
