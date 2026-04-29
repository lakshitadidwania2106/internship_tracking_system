import { prisma } from "@/lib/prisma";

export async function getDashboardStats(batchYear?: number, semester?: number) {
  const where =
    batchYear && semester
      ? { batch: { year: batchYear }, semesterRecord: { semester } }
      : undefined;

  const [totalStudents, internshipCount] = await Promise.all([
    prisma.student.count({ where }),
    prisma.internship.count({
      where: where
        ? {
            student: where,
          }
        : undefined,
    }),
  ]);

  return {
    totalStudents,
    internshipCount,
    conversionRate: totalStudents > 0 ? Math.round((internshipCount / totalStudents) * 100) : 0,
  };
}

export async function searchStudents({
  batchYear,
  semester,
  usn,
}: {
  batchYear?: number;
  semester?: number;
  usn?: string;
}) {
  return prisma.student.findMany({
    where: {
      ...(batchYear ? { batch: { year: batchYear } } : {}),
      ...(semester ? { semesterRecord: { semester } } : {}),
      ...(usn ? { usn: { contains: usn.toUpperCase() } } : {}),
    },
    include: {
      internship: true,
      semesterRecord: true,
      batch: true,
      mapping: true,
      documents: true,
    },
    take: 50,
    orderBy: {
      usn: "asc",
    },
  });
}

export async function getStudentsForBatchSemester(batchYear: number, semester: number) {
  return prisma.student.findMany({
    where: {
      batch: { year: batchYear },
      semesterRecord: { semester },
    },
    include: {
      internship: true,
      semesterRecord: true,
      batch: true,
      mapping: true,
      documents: true,
    },
    orderBy: {
      usn: "asc",
    },
  });
}

export async function getRecentImportJobs() {
  return prisma.importJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export async function getStudentByUsn(usn: string) {
  return prisma.student.findUnique({
    where: { usn: usn.toUpperCase() },
    include: {
      internship: true,
      semesterRecord: true,
      batch: true,
      mapping: true,
      documents: true,
    },
  });
}
