import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { MARK_UPLOAD_KINDS, STORED_FILE_KIND, type MarkUploadKind } from "@/lib/constants";
import type { ImportMode } from "@/lib/importer";
import { runExcelImport } from "@/lib/importer";
import { prisma } from "@/lib/prisma";
import { buildObjectKey, putObjectBytes } from "@/lib/r2";

const EXCEL_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);

function resolveKind(markKind: string): {
  storedKind: string;
  reviewNumber?: 1 | 2 | 3;
  mode: ImportMode;
} | null {
  switch (markKind) {
    case "review_1":
      return { storedKind: STORED_FILE_KIND.REVIEW_1_XLSX, reviewNumber: 1, mode: "internship" };
    case "review_2":
      return { storedKind: STORED_FILE_KIND.REVIEW_2_XLSX, reviewNumber: 2, mode: "internship" };
    case "review_3":
      return { storedKind: STORED_FILE_KIND.REVIEW_3_XLSX, reviewNumber: 3, mode: "internship" };
    case "final":
      return { storedKind: STORED_FILE_KIND.FINAL_MARKS_XLSX, mode: "marks" };
    case "internship_details":
      return { storedKind: STORED_FILE_KIND.INTERNSHIP_DETAILS_XLSX, mode: "internship" };
    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const batchYear = Number(formData.get("batchYear"));
    const semester = Number(formData.get("semester"));
    const markKindRaw = (formData.get("markKind") ?? formData.get("kind") ?? "").toString().trim();
    const sheetName = (formData.get("sheetName")?.toString() ?? "").trim() || undefined;
    const headerRowText = (formData.get("headerRowIndex")?.toString() ?? "").trim();
    const headerRowIndex = headerRowText ? Number(headerRowText) : undefined;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: "Excel file is required (`file` field)." }, { status: 400 });
    }

    if (!MARK_UPLOAD_KINDS.includes(markKindRaw as MarkUploadKind)) {
      return NextResponse.json(
        {
          message: `Invalid markKind. Use one of: ${MARK_UPLOAD_KINDS.join(", ")}.`,
        },
        { status: 400 },
      );
    }

    const resolved = resolveKind(markKindRaw);
    if (!resolved) {
      return NextResponse.json({ message: "Could not resolve upload kind." }, { status: 400 });
    }

    if (!batchYear || !semester) {
      return NextResponse.json({ message: "batchYear and semester are required." }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!EXCEL_EXTENSIONS.has(ext)) {
      return NextResponse.json({ message: "Upload an Excel or CSV file." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType =
      ext === ".csv"
        ? "text/csv"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    const storageKey = buildObjectKey({
      batchYear,
      semester,
      folder: resolved.storedKind,
      originalName: file.name,
    });

    await putObjectBytes(storageKey, buffer, contentType);

    const stored = await prisma.storedFile.create({
      data: {
        kind: resolved.storedKind,
        batchYear,
        semester,
        storageKey,
        originalName: file.name,
        contentType,
        byteSize: buffer.length,
      },
    });

    const result = await runExcelImport({
      buffer,
      sourceFileName: file.name,
      batchYear,
      semester,
      sheetName,
      headerRowIndex,
      mode: resolved.mode,
      reviewNumber: resolved.reviewNumber,
    });

    return NextResponse.json({
      message: "Marks workbook stored and imported.",
      storedFileId: stored.id,
      storageKey: stored.storageKey,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Marks upload failed.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
