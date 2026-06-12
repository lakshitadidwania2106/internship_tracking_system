import "dotenv/config";
import { buildBatchSemesterWhere, getVisibleSemestersForBatch } from "@/lib/batch-semester";
import { getBatchSemesterMapFromDb } from "@/lib/data";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@"));
  const total = await prisma.student.count();
  const map = await getBatchSemesterMapFromDb();
  const s2020 = await prisma.student.count({
    where: await buildBatchSemesterWhere(2020, 8),
  });
  const s2021sem6 = await prisma.student.count({
    where: await buildBatchSemesterWhere(2021, 6),
  });
  const s2021sem8 = await prisma.student.count({
    where: await buildBatchSemesterWhere(2021, 8),
  });
  const visible2021 = await getVisibleSemestersForBatch(2021);
  console.log({ total, map, visible2021, s2020, s2021sem6, s2021sem8 });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
