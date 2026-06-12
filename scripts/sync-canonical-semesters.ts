import { PrismaClient } from "../src/generated/prisma/client";
import { BATCH_SEMESTER_MAP } from "../src/lib/constants";
import { createSqliteAdapter } from "../src/lib/prisma-adapter";

const prisma = new PrismaClient({ adapter: createSqliteAdapter() });

async function main() {
  for (const [yearText, semesters] of Object.entries(BATCH_SEMESTER_MAP)) {
    const year = Number(yearText);
    const batch = await prisma.batch.findUnique({ where: { year } });
    if (!batch) continue;

    const targetSem = await prisma.semesterRecord.findFirst({
      where: { batchId: batch.id, semester: semesters[0] },
    });

    const invalid = await prisma.semesterRecord.findMany({
      where: {
        batchId: batch.id,
        semester: { notIn: semesters },
      },
    });

    for (const sem of invalid) {
      if (targetSem) {
        const moved = await prisma.student.updateMany({
          where: { semesterRecordId: sem.id },
          data: { semesterRecordId: targetSem.id },
        });
        console.log(`Batch ${year}: moved ${moved.count} students from sem ${sem.semester} → ${semesters[0]}`);
      }
      await prisma.semesterRecord.delete({ where: { id: sem.id } });
      console.log(`Batch ${year}: removed semester ${sem.semester}`);
    }
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
