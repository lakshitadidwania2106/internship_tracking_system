import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { STORED_FILE_KIND } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { storePdfZipEntriesInDb } from "@/lib/report-pdf-import";
import { buildObjectKey, putObjectBytes } from "@/lib/r2";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const batchYear = Number(formData.get("batchYear"));
    const semester = Number(formData.get("semester"));

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: "ZIP file is required (`file` field)." }, { status: 400 });
    }

    if (!batchYear || !semester) {
      return NextResponse.json({ message: "batchYear and semester are required." }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (ext !== ".zip") {
      return NextResponse.json({ message: "Upload a .zip archive of student report PDFs." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = buildObjectKey({
      batchYear,
      semester,
      folder: STORED_FILE_KIND.REPORTS_ZIP,
      originalName: file.name,
    });

    await putObjectBytes(storageKey, buffer, "application/zip");

    const stored = await prisma.storedFile.create({
      data: {
        kind: STORED_FILE_KIND.REPORTS_ZIP,
        batchYear,
        semester,
        storageKey,
        originalName: file.name,
        contentType: "application/zip",
        byteSize: buffer.length,
      },
    });

    const pdfImport = await storePdfZipEntriesInDb({
      zipBuffer: buffer,
      batchYear,
      semester,
    });

    return NextResponse.json({
      message: "Reports archive stored; PDFs linked to students where USNs matched.",
      storedFileId: stored.id,
      storageKey: stored.storageKey,
      byteSize: stored.byteSize,
      pdfImport,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Reports upload failed.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
