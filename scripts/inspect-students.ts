import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const byBatch = await prisma.student.groupBy({
    by: ["batchId"],
    _count: true,
  });
  const batches = await prisma.batch.findMany();
  for (const row of byBatch) {
    const b = batches.find((x) => x.id === row.batchId);
    console.log(`Batch ${b?.year}: ${row._count} students`);
  }

  const sample2022 = await prisma.student.findMany({
    where: { batch: { year: 2022 } },
    take: 8,
    select: { usn: true, fullName: true },
    orderBy: { usn: "asc" },
  });
  console.log("Sample 2022 USNs:", sample2022);

  const count2020batch = await prisma.student.count({
    where: { batch: { year: 2020 }, semesterRecord: { semester: 8 } },
  });
  console.log("Students on batch 2020 sem 8:", count2020batch);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
