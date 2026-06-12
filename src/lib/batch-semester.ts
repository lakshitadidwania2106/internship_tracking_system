import type { Prisma } from "@/generated/prisma/client";
import { BATCH_2021_YEAR } from "@/lib/batch-2021-constants";
import { prisma } from "@/lib/prisma";

export type Batch2021Mode = "sem6_native" | "sem8_native" | "split" | "sem8_stored_sem6_view";

type SemesterCounts = {
  sem6: number;
  sem8: number;
  total: number;
};

async function getBatch2021Counts(batchId: number): Promise<SemesterCounts> {
  const [sem6, sem8, total] = await Promise.all([
    prisma.student.count({
      where: { batchId, semesterRecord: { semester: 6 } },
    }),
    prisma.student.count({
      where: { batchId, semesterRecord: { semester: 8 } },
    }),
    prisma.student.count({ where: { batchId } }),
  ]);
  return { sem6, sem8, total };
}

export function resolveBatch2021Mode(counts: SemesterCounts): Batch2021Mode {
  if (counts.total === 0) return "sem6_native";
  if (counts.sem6 > 0 && counts.sem8 > 0) return "split";
  if (counts.sem6 > 0) return "sem6_native";
  if (counts.sem8 > 0) return "sem8_stored_sem6_view";
  return "sem6_native";
}

export async function getBatch2021Mode(batchYear: number): Promise<Batch2021Mode> {
  if (batchYear !== BATCH_2021_YEAR) return "sem6_native";
  const batch = await prisma.batch.findUnique({ where: { year: batchYear } });
  if (!batch) return "sem6_native";
  return resolveBatch2021Mode(await getBatch2021Counts(batch.id));
}

function directSemesterWhere(batchYear: number, semester: number): Prisma.StudentWhereInput {
  return {
    batch: { year: batchYear },
    semesterRecord: { semester },
  };
}

export function buildBatchSemesterWhereWithMode(
  batchYear: number,
  semester: number,
  mode: Batch2021Mode,
): Prisma.StudentWhereInput {
  if (batchYear !== BATCH_2021_YEAR) {
    return directSemesterWhere(batchYear, semester);
  }

  if (semester === 6) {
    if (mode === "sem8_stored_sem6_view") {
      return { batch: { year: BATCH_2021_YEAR } };
    }
    return directSemesterWhere(BATCH_2021_YEAR, 6);
  }

  if (semester === 8) {
    return directSemesterWhere(BATCH_2021_YEAR, 8);
  }

  return directSemesterWhere(batchYear, semester);
}

export async function buildBatchSemesterWhere(
  batchYear: number,
  semester: number,
): Promise<Prisma.StudentWhereInput> {
  if (batchYear !== BATCH_2021_YEAR) {
    return directSemesterWhere(batchYear, semester);
  }
  const mode = await getBatch2021Mode(batchYear);
  return buildBatchSemesterWhereWithMode(batchYear, semester, mode);
}

/** Semesters that should appear in filters and the all-batches summary table. */
export async function getVisibleSemestersForBatch(batchYear: number): Promise<number[]> {
  if (batchYear === 2020 || batchYear === 2022) {
    const count = await prisma.student.count({
      where: directSemesterWhere(batchYear, 8),
    });
    return count > 0 ? [8] : [];
  }

  if (batchYear !== BATCH_2021_YEAR) {
    const batch = await prisma.batch.findUnique({
      where: { year: batchYear },
      include: { semesters: { orderBy: { semester: "asc" } } },
    });
    if (!batch) return [];
    const visible: number[] = [];
    for (const sem of batch.semesters) {
      const count = await prisma.student.count({
        where: directSemesterWhere(batchYear, sem.semester),
      });
      if (count > 0) visible.push(sem.semester);
    }
    return visible;
  }

  const batch = await prisma.batch.findUnique({ where: { year: BATCH_2021_YEAR } });
  if (!batch) return [];

  const counts = await getBatch2021Counts(batch.id);
  if (counts.total === 0) return [];

  const mode = resolveBatch2021Mode(counts);
  switch (mode) {
    case "sem6_native":
      return [6];
    case "sem8_native":
      return [8];
    case "split":
      return [6, 8];
    case "sem8_stored_sem6_view":
      return [6, 8];
    default:
      return [6];
  }
}

export function semesterViewNote(batchYear: number, mode: Batch2021Mode): string | null {
  if (batchYear !== BATCH_2021_YEAR) return null;
  if (mode === "sem8_stored_sem6_view") {
    return "Batch 2021 semester 6 shows all students whose records were imported on semester 8 rows.";
  }
  if (mode === "split") {
    return "Batch 2021 has separate semester 6 and semester 8 student cohorts.";
  }
  return null;
}
