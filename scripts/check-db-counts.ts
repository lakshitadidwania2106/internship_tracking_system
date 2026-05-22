import "dotenv/config";
import { getBatchSemesterMapFromDb } from "@/lib/data";
import { getDatabaseFilePath } from "@/lib/database-path";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("DB path:", getDatabaseFilePath());
  const total = await prisma.student.count();
  const map = await getBatchSemesterMapFromDb();
  const s2022 = await prisma.student.count({
    where: { batch: { year: 2022 }, semesterRecord: { semester: 8 } },
  });
  const s2020 = await prisma.student.count({
    where: { batch: { year: 2020 }, semesterRecord: { semester: 8 } },
  });
  const s2021sem6 = await prisma.student.count({
    where: { batch: { year: 2021 }, semesterRecord: { semester: 6 } },
  });
  const s2021sem8 = await prisma.student.count({
    where: { batch: { year: 2021 }, semesterRecord: { semester: 8 } },
  });
  console.log({ total, map, s2020, s2021sem6, s2021sem8, s2022 });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
