import "dotenv/config";
import { ensureAdminEmailSeeded } from "../src/lib/auth-server";
import { COURSE_DETAILS } from "../src/lib/constants";
import { prisma } from "../src/lib/prisma";

async function main() {
  await ensureAdminEmailSeeded();

  for (const year of [2020, 2021, 2022]) {
    await prisma.batch.upsert({
      where: { year },
      update: {},
      create: { year },
    });
  }

  for (const [key, course] of Object.entries(COURSE_DETAILS)) {
    const [yearText, semesterText] = key.split("-");
    const year = Number(yearText);
    const semester = Number(semesterText);
    const batch = await prisma.batch.findUniqueOrThrow({ where: { year } });

    await prisma.semesterRecord.upsert({
      where: {
        batchId_semester: { batchId: batch.id, semester },
      },
      update: {
        courseCode: course.code,
        courseName: course.name,
        credits: course.credits,
      },
      create: {
        batchId: batch.id,
        semester,
        courseCode: course.code,
        courseName: course.name,
        credits: course.credits,
      },
    });
  }

  const students = await prisma.student.count();
  console.log(`Database initialized. Students in DB: ${students}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
