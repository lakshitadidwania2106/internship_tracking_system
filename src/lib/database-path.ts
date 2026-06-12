import path from "node:path";

/**
 * Resolves the SQLite file from DATABASE_URL (e.g. file:./dev.db).
 * Defaults to project-root dev.db where imported Excel data lives.
 */
export function getDatabaseFilePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const raw = url.replace(/^file:/i, "").trim();
  if (path.isAbsolute(raw)) {
    return raw;
  }
  return path.resolve(process.cwd(), raw);
}
