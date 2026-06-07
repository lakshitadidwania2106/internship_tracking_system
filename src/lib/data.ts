import { DASHBOARD_SEMESTER_OPTIONS } from "@/lib/constants";
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

const studentInclude = {
  internship: true,
  semesterRecord: true,
  batch: true,
  mapping: true,
  documents: true,
  reviewMarks: { orderBy: { reviewNumber: "asc" as const } },
};

/** Pick the newest batch/semester that actually has students. */
export async function getDefaultBatchSemester(fallbackMap?: Record<number, number[]>) {
  const batches = await prisma.batch.findMany({
    include: {
      semesters: { orderBy: { semester: "desc" } },
      _count: { select: { students: true } },
    },
    orderBy: { year: "desc" },
  });

  for (const batch of batches) {
    if (batch._count.students === 0) continue;
    for (const sem of batch.semesters) {
      const count = await prisma.student.count({
        where: { batchId: batch.id, semesterRecord: { semester: sem.semester } },
      });
      if (count > 0) {
        return { batchYear: batch.year, semester: sem.semester };
      }
    }
    return { batchYear: batch.year, semester: batch.semesters[0]?.semester ?? 8 };
  }

  const years = fallbackMap ? Object.keys(fallbackMap).map(Number).sort((a, b) => b - a) : [];
  if (years.length > 0) {
    const year = years[0];
    const sems = fallbackMap![year] ?? [8];
    return { batchYear: year, semester: sems[sems.length - 1] ?? 8 };
  }
  return { batchYear: 2022, semester: 8 };
}

/** Find a student by USN or name across all batches (for search). */
export async function findStudentByQuery(query: string) {
  const q = query.trim();
  if (q.length < 2) return null;

  const upper = q.toUpperCase();
  return prisma.student.findFirst({
    where: {
      OR: [{ usn: { contains: upper } }, { fullName: { contains: q } }],
    },
    include: { batch: true, semesterRecord: true },
    orderBy: { usn: "asc" },
  });
}

export async function resolveDashboardFilters(input: {
  batch?: string;
  semester?: string;
  usn?: string;
  batchMap: Record<number, number[]>;
}) {
  const usnQuery = input.usn?.trim() ?? "";
  const batchOptions = Object.keys(input.batchMap)
    .map(Number)
    .sort((a, b) => a - b);

  if (usnQuery.length >= 2) {
    const match = await findStudentByQuery(usnQuery);
    if (match) {
      const requestedBatch = Number(input.batch);
      const requestedSem = Number(input.semester);
      return {
        batchYear: match.batch.year,
        semester: match.semesterRecord.semester,
        usnQuery: match.usn,
        contextAdjusted:
          (Number.isFinite(requestedBatch) && requestedBatch !== match.batch.year) ||
          (Number.isFinite(requestedSem) && requestedSem !== match.semesterRecord.semester),
      };
    }
  }

  let batchYear = Number(input.batch);
  let semester = Number(input.semester);

  if (!batchYear || !batchOptions.includes(batchYear)) {
    const def = await getDefaultBatchSemester(input.batchMap);
    batchYear = def.batchYear;
    semester = def.semester;
  } else if (!semester) {
    semester = DASHBOARD_SEMESTER_OPTIONS[DASHBOARD_SEMESTER_OPTIONS.length - 1];
  }

  if (!DASHBOARD_SEMESTER_OPTIONS.includes(semester as (typeof DASHBOARD_SEMESTER_OPTIONS)[number])) {
    semester = DASHBOARD_SEMESTER_OPTIONS.includes(8)
      ? 8
      : DASHBOARD_SEMESTER_OPTIONS[0];
  }

  return {
    batchYear,
    semester,
    usnQuery,
    contextAdjusted: false,
  };
}

export async function searchStudents({
  batchYear,
  semester,
  usn,
  query,
}: {
  batchYear?: number;
  semester?: number;
  usn?: string;
  /** USN or partial name */
  query?: string;
}) {
  const q = (query ?? usn)?.trim();
  const whereQuery = q
    ? {
        OR: [{ usn: { contains: q.toUpperCase() } }, { fullName: { contains: q } }],
      }
    : {};

  return prisma.student.findMany({
    where: {
      ...(batchYear ? { batch: { year: batchYear } } : {}),
      ...(semester ? { semesterRecord: { semester } } : {}),
      ...whereQuery,
    },
    include: studentInclude,
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
    include: studentInclude,
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

export async function getBatchSemesterMapFromDb() {
  const batches = await prisma.batch.findMany({
    include: {
      semesters: {
        select: { id: true, semester: true },
        orderBy: { semester: "asc" },
      },
      _count: { select: { students: true } },
    },
    orderBy: { year: "asc" },
  });

  const map: Record<number, number[]> = {};
  for (const batch of batches) {
    if (batch._count.students === 0) continue;

    const semestersWithStudents: number[] = [];
    for (const sem of batch.semesters) {
      const count = await prisma.student.count({
        where: { batchId: batch.id, semesterRecordId: sem.id },
      });
      if (count > 0) {
        semestersWithStudents.push(sem.semester);
      }
    }

    if (semestersWithStudents.length > 0) {
      map[batch.year] = semestersWithStudents;
    }
  }
  return map;
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
      reviewMarks: { orderBy: { reviewNumber: "asc" } },
    },
  });
}

export async function getStudentById(id: number) {
  return prisma.student.findUnique({
    where: { id },
    include: {
      internship: true,
      semesterRecord: true,
      batch: true,
      mapping: true,
      documents: true,
      reviewMarks: { orderBy: { reviewNumber: "asc" } },
    },
  });
}

export async function listBatchesDetailed() {
  return prisma.batch.findMany({
    include: {
      semesters: {
        orderBy: { semester: "asc" },
      },
      _count: { select: { students: true } },
    },
    orderBy: { year: "asc" },
  });
}

export async function listStudentsForBatchYear(batchYear: number) {
  return prisma.student.findMany({
    where: { batch: { year: batchYear } },
    include: {
      internship: true,
      semesterRecord: true,
      batch: true,
      reviewMarks: { orderBy: { reviewNumber: "asc" } },
    },
    orderBy: { usn: "asc" },
  });
}
