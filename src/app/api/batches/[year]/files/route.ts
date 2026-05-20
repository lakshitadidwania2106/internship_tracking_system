import { NextRequest, NextResponse } from "next/server";
import { getBatchFileStatus } from "@/lib/batch-status";

export async function GET(request: NextRequest, context: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await context.params;
  const batchYear = Number(yearParam);
  if (!batchYear) {
    return NextResponse.json({ message: "Invalid batch year." }, { status: 400 });
  }

  const semesterRaw = new URL(request.url).searchParams.get("semester");
  const semester = semesterRaw ? Number(semesterRaw) : undefined;

  const status = await getBatchFileStatus(batchYear, semester && Number.isFinite(semester) ? semester : undefined);
  if (!status) {
    return NextResponse.json({ message: "Batch not found." }, { status: 404 });
  }

  return NextResponse.json({
    batchYear,
    semester: semester ?? null,
    batch: status.batch,
    storedFiles: status.storedFiles,
    studentDocuments: status.studentDocuments,
    importJobs: status.importJobs,
    reviewMarkCount: status.reviewMarkCount,
  });
}
