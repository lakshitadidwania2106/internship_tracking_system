import fs from "node:fs";
import path from "node:path";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");

for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  const file = `${dbPath}${suffix}`;
  if (fs.existsSync(file)) {
    fs.rmSync(file, { force: true });
    console.log(`Removed ${path.relative(process.cwd(), file)}`);
  }
}

console.log("Database files cleared. Run: npm run db:migrate");
