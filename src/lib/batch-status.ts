import { prisma } from "@/lib/prisma";
import { deleteObjectBytes } from "@/lib/r2";

export async function getBatchFileStatus(batchYear: number, semester?: number) {
  const batch = await prisma.batch.findUnique({
    where: { year: batchYear },
    include: {
      semesters: { orderBy: { semester: "asc" } },
      _count: { select: { students: true } },
    },
  });

  if (!batch) {
    return null;
  }

  const storedFiles = await prisma.storedFile.findMany({
    where: {
      batchYear,
      ...(semester ? { semester } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const studentDocs = await prisma.studentDocument.findMany({
    where: {
      student: {
        batch: { year: batchYear },
        ...(semester ? { semesterRecord: { semester } } : {}),
      },
      storageKey: { not: null },
    },
    include: {
      student: { select: { usn: true, fullName: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const importJobs = await prisma.importJob.findMany({
    where: {
      batchYear,
      ...(semester ? { semester } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const reviewMarkCount = await prisma.studentReviewMark.count({
    where: {
      student: {
        batch: { year: batchYear },
        ...(semester ? { semesterRecord: { semester } } : {}),
      },
    },
  });

  return {
    batch,
    storedFiles,
    studentDocuments: studentDocs,
    importJobs,
    reviewMarkCount,
  };
}

export async function deleteStoredFileById(id: number) {
  const file = await prisma.storedFile.findUnique({ where: { id } });
  if (!file) return null;

  try {
    await deleteObjectBytes(file.storageKey);
  } catch {
    // Continue removing DB row even if blob delete fails.
  }

  await prisma.storedFile.delete({ where: { id } });
  return file;
}

export async function deleteStudentDocumentById(id: number) {
  const doc = await prisma.studentDocument.findUnique({ where: { id } });
  if (!doc) return null;

  if (doc.storageKey) {
    try {
      await deleteObjectBytes(doc.storageKey);
    } catch {
      // ignore
    }
  }

  await prisma.studentDocument.delete({ where: { id } });
  return doc;
}

export async function deleteBatchByYear(batchYear: number) {
  const batch = await prisma.batch.findUnique({ where: { year: batchYear } });
  if (!batch) return null;

  const files = await prisma.storedFile.findMany({ where: { batchYear } });
  for (const file of files) {
    try {
      await deleteObjectBytes(file.storageKey);
    } catch {
      // ignore
    }
  }

  const docs = await prisma.studentDocument.findMany({
    where: { student: { batchId: batch.id } },
    select: { storageKey: true },
  });
  for (const doc of docs) {
    if (!doc.storageKey) continue;
    try {
      await deleteObjectBytes(doc.storageKey);
    } catch {
      // ignore
    }
  }

  await prisma.batch.delete({ where: { id: batch.id } });
  return { year: batchYear, deletedFiles: files.length };
}
