import { prisma } from "@/lib/prisma";
import { buildStudentMarksRecord, extractFinalTotal } from "@/lib/marks-distribution";
import { buildStudentProfileAnalytics } from "@/lib/analytics";

async function main() {
  const students = await prisma.student.findMany({
    where: { batch: { year: 2021 } },
    take: 2,
    include: { internship: true, reviewMarks: true, semesterRecord: true, batch: true },
  });
  for (const s of students) {
    const record = buildStudentMarksRecord(s, 6);
    const profile = buildStudentProfileAnalytics(s, 2021, 6);
    console.log({
      usn: s.usn,
      storedSem: s.semesterRecord.semester,
      finalTotal: extractFinalTotal(record.finalRow, 6),
      profileFinal: profile.finalTotal,
      marks100: record.finalRow["MARKS (100)"],
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
