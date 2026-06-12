import { buildBatchSemesterWhere, getVisibleSemestersForBatch } from "@/lib/batch-2021";
import { prisma } from "@/lib/prisma";

export async function getDashboardStats(batchYear?: number, semester?: number) {
  if (batchYear && semester) {
    const where = await buildBatchSemesterWhere(batchYear, semester);
    const [totalStudents, internshipCount] = await Promise.all([
      prisma.student.count({ where }),
      prisma.internship.count({ where: { student: where } }),
    ]);

    return {
      totalStudents,
      internshipCount,
      conversionRate: totalStudents > 0 ? Math.round((internshipCount / totalStudents) * 100) : 0,
    };
  }

  const [totalStudents, internshipCount] = await Promise.all([
    prisma.student.count(),
    prisma.internship.count(),
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
      _count: { select: { students: true } },
    },
    orderBy: { year: "desc" },
  });

  for (const batch of batches) {
    if (batch._count.students === 0) continue;

    const semesterOptions = await getVisibleSemestersForBatch(batch.year);
    const options =
      semesterOptions.length > 0 ? semesterOptions : (fallbackMap?.[batch.year] ?? [8]);

    for (const semester of [...options].sort((a, b) => b - a)) {
      const count = await prisma.student.count({
        where: await buildBatchSemesterWhere(batch.year, semester),
      });
      if (count > 0) {
        return { batchYear: batch.year, semester };
      }
    }

    return { batchYear: batch.year, semester: options[options.length - 1] ?? 8 };
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
      const visibleSemesters = await getVisibleSemestersForBatch(match.batch.year);
      const displaySemester = visibleSemesters.includes(match.semesterRecord.semester)
        ? match.semesterRecord.semester
        : (visibleSemesters[0] ?? match.semesterRecord.semester);

      return {
        batchYear: match.batch.year,
        semester: displaySemester,
        usnQuery: match.usn,
        contextAdjusted:
          (Number.isFinite(requestedBatch) && requestedBatch !== match.batch.year) ||
          (Number.isFinite(requestedSem) && requestedSem !== displaySemester),
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
    const options = input.batchMap[batchYear] ?? (await getVisibleSemestersForBatch(batchYear));
    semester = options[options.length - 1] ?? 8;
  }

  const validSemesters = input.batchMap[batchYear] ?? (await getVisibleSemestersForBatch(batchYear));
  if (!validSemesters.includes(semester)) {
    semester = validSemesters[validSemesters.length - 1] ?? validSemesters[0] ?? 8;
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
  query?: string;
}) {
  const q = (query ?? usn)?.trim();
  const whereQuery = q
    ? {
        OR: [{ usn: { contains: q.toUpperCase() } }, { fullName: { contains: q } }],
      }
    : {};

  const batchSemesterWhere =
    batchYear && semester ? await buildBatchSemesterWhere(batchYear, semester) : {};

  return prisma.student.findMany({
    where: {
      ...batchSemesterWhere,
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
    where: await buildBatchSemesterWhere(batchYear, semester),
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
      _count: { select: { students: true } },
    },
    orderBy: { year: "asc" },
  });

  const map: Record<number, number[]> = {};
  for (const batch of batches) {
    if (batch._count.students === 0) continue;
    const semesters = await getVisibleSemestersForBatch(batch.year);
    if (semesters.length > 0) {
      map[batch.year] = semesters;
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
