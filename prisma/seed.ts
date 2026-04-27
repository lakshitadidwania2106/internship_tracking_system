import { PrismaClient } from "../src/generated/prisma/client";
import { COURSE_DETAILS } from "../src/lib/constants";
import { createSqliteAdapter } from "../src/lib/prisma-adapter";
import { sampleRecords } from "../src/lib/sample-data";

const prisma = new PrismaClient({
  adapter: createSqliteAdapter(),
});

async function seed() {
  await prisma.studentDocument.deleteMany();
  await prisma.outcomeMapping.deleteMany();
  await prisma.internship.deleteMany();
  await prisma.student.deleteMany();
  await prisma.semesterRecord.deleteMany();
  await prisma.batch.deleteMany();

  for (const year of [2020, 2021]) {
    await prisma.batch.create({
      data: { year },
    });
  }

  for (const [key, course] of Object.entries(COURSE_DETAILS)) {
    const [yearText, semesterText] = key.split("-");
    const year = Number(yearText);
    const semester = Number(semesterText);
    const batch = await prisma.batch.findUniqueOrThrow({ where: { year } });

    await prisma.semesterRecord.create({
      data: {
        batchId: batch.id,
        semester,
        courseCode: course.code,
        courseName: course.name,
        credits: course.credits,
      },
    });
  }

  for (const row of sampleRecords) {
    const batch = await prisma.batch.findUniqueOrThrow({ where: { year: row.batchYear } });
    const semester = await prisma.semesterRecord.findUniqueOrThrow({
      where: {
        batchId_semester: {
          batchId: batch.id,
          semester: row.semester,
        },
      },
    });

    const student = await prisma.student.create({
      data: {
        usn: row.usn,
        fullName: row.fullName,
        batchId: batch.id,
        semesterRecordId: semester.id,
      },
    });

    await prisma.internship.create({
      data: {
        studentId: student.id,
        companyName: row.companyName,
        roleTitle: row.roleTitle,
        stipend: row.stipend,
        startDateRaw: row.startDateRaw,
        endDateRaw: row.endDateRaw,
        durationText: row.durationText,
        grade: row.grade,
        status: row.status,
      },
    });

    await prisma.outcomeMapping.create({
      data: {
        studentId: student.id,
        relevantPOs: row.relevantPOs,
        relevantPSOs: row.relevantPSOs,
        coMappingSummary: row.coMappingSummary,
      },
    });

    await prisma.studentDocument.create({
      data: {
        studentId: student.id,
        documentType: "report",
        fileLabel: `${row.usn}_Internship_Report.pdf`,
        storagePath: `${row.usn}_Internship_Report.pdf`,
        originalName: `${row.usn}_Internship_Report.pdf`,
      },
    });
  }
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
