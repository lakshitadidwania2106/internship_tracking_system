import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const dbPath = path.join(process.cwd(), "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const students = await prisma.student.count();
const batches = await prisma.batch.findMany({
  include: { semesters: true, _count: { select: { students: true } } },
});
console.log("db:", dbPath);
console.log("students:", students);
console.log("batches:", JSON.stringify(batches, null, 2));
await prisma.$disconnect();
