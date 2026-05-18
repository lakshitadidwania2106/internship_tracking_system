import path from "node:path";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { buildObjectKey, putObjectBytes } from "@/lib/r2";

export const INTERNSHIP_REPORT_PDF_TYPE = "internship_report_pdf";

/** Typical VTU-style USN embedded in filenames (e.g. 1DS21AI001). */
export function extractUsnFromPath(filePath: string): string | null {
  const normalized = filePath.toUpperCase().replace(/\\/g, "/");
  const match = normalized.match(/(1[A-Z]{2}\d{2}[A-Z]{2}\d{3})/);
  return match?.[1] ?? null;
}

export type PdfZipImportResult = {
  linked: number;
  unmatchedPdfCount: number;
  unmatchedSamples: string[];
};

export async function storePdfZipEntriesInDb(params: {
  zipBuffer: Buffer;
  batchYear: number;
  semester: number;
}): Promise<PdfZipImportResult> {
  const zip = await JSZip.loadAsync(params.zipBuffer);
  const unmatchedSamples: string[] = [];
  let linked = 0;
  let unmatchedPdfCount = 0;

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  for (const entry of entries) {
    const relativePath = entry.name.replace(/\\/g, "/");
    if (relativePath.includes("__MACOSX")) continue;
    if (!relativePath.toLowerCase().endsWith(".pdf")) continue;

    const usn = extractUsnFromPath(relativePath);
    if (!usn) {
      unmatchedPdfCount += 1;
      if (unmatchedSamples.length < 15) unmatchedSamples.push(relativePath);
      continue;
    }

    const student = await prisma.student.findFirst({
      where: {
        usn,
        batch: { year: params.batchYear },
        semesterRecord: { semester: params.semester },
      },
    });

    if (!student) {
      unmatchedPdfCount += 1;
      if (unmatchedSamples.length < 15) unmatchedSamples.push(`${relativePath} (no student ${usn})`);
      continue;
    }

    const pdfBuffer = Buffer.from(await entry.async("arraybuffer"));
    const basename = path.basename(relativePath);
    const safeBase = basename.replace(/[^a-zA-Z0-9._-]/g, "_");

    const storageKey = buildObjectKey({
      batchYear: params.batchYear,
      semester: params.semester,
      folder: "student_report_pdf",
      originalName: `${usn}-${safeBase}`,
    });

    await putObjectBytes(storageKey, pdfBuffer, "application/pdf");

    const existing = await prisma.studentDocument.findFirst({
      where: {
        studentId: student.id,
        documentType: INTERNSHIP_REPORT_PDF_TYPE,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (existing) {
      await prisma.studentDocument.update({
        where: { id: existing.id },
        data: {
          storageKey,
          storagePath: basename,
          fileLabel: basename,
          originalName: relativePath,
        },
      });
    } else {
      await prisma.studentDocument.create({
        data: {
          studentId: student.id,
          documentType: INTERNSHIP_REPORT_PDF_TYPE,
          storagePath: basename,
          fileLabel: basename,
          originalName: relativePath,
          storageKey,
        },
      });
    }

    linked += 1;
  }

  return { linked, unmatchedPdfCount, unmatchedSamples };
}
