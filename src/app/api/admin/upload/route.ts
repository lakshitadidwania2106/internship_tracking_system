import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { importExcelFile } from "@/lib/importer";

const EXCEL_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);
const REPORT_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".txt"]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const batchYear = Number(formData.get("batchYear"));
    const semester = Number(formData.get("semester"));
    const sheetName = (formData.get("sheetName")?.toString() ?? "").trim() || undefined;
    const headerRowText = (formData.get("headerRowIndex")?.toString() ?? "").trim();
    const headerRowIndex = headerRowText ? Number(headerRowText) : undefined;
    const modeText = (formData.get("mode")?.toString() ?? "").trim();
    const courseCode = (formData.get("courseCode")?.toString() ?? "").trim() || undefined;
    const courseName = (formData.get("courseName")?.toString() ?? "").trim() || undefined;
    const creditsText = (formData.get("credits")?.toString() ?? "").trim();
    const credits = creditsText ? Number(creditsText) : undefined;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: "File is required." }, { status: 400 });
    }

    const fileName = file.name;
    const ext = path.extname(fileName).toLowerCase();
    const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    if (EXCEL_EXTENSIONS.has(ext)) {
      if (!batchYear || !semester) {
        return NextResponse.json(
          { message: "Batch year and semester are required for Excel imports." },
          { status: 400 },
        );
      }
      const uploadDir = path.join(process.cwd(), "data", "imports", "excel", "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, safeName);
      await fs.writeFile(filePath, bytes);

      const result = await importExcelFile({
        filePath,
        batchYear,
        semester,
        sheetName,
        headerRowIndex,
        mode: modeText === "marks" ? "marks" : "internship",
        courseCode,
        courseName,
        credits,
      });

      return NextResponse.json({
        message: "Excel imported successfully.",
        result,
      });
    }

    if (REPORT_EXTENSIONS.has(ext)) {
      const reportDir = path.join(process.cwd(), "data", "imports", "reports", "uploads");
      await fs.mkdir(reportDir, { recursive: true });
      const filePath = path.join(reportDir, safeName);
      await fs.writeFile(filePath, bytes);
      return NextResponse.json({
        message: "Document uploaded successfully. Include USN in filename for auto matching.",
        storedAs: safeName,
      });
    }

    return NextResponse.json(
      { message: "Unsupported file type. Use Excel/CSV for data import or PDF/DOC/DOCX/TXT for documents." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: "Upload failed.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
