import { NextResponse } from "next/server";
import { listStudentsForBatchYear } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, context: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await context.params;
  const batchYear = Number(yearParam);
  if (!batchYear) {
    return NextResponse.json({ message: "Invalid batch year." }, { status: 400 });
  }

  const batch = await prisma.batch.findUnique({ where: { year: batchYear } });
  if (!batch) {
    return NextResponse.json({ message: "Batch not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const semesterRaw = url.searchParams.get("semester");
  const semester = semesterRaw ? Number(semesterRaw) : undefined;

  const students =
    semester && Number.isFinite(semester)
      ? await prisma.student.findMany({
          where: {
            batchId: batch.id,
            semesterRecord: { semester },
          },
          include: {
            internship: true,
            semesterRecord: true,
            batch: true,
            reviewMarks: { orderBy: { reviewNumber: "asc" } },
          },
          orderBy: { usn: "asc" },
        })
      : await listStudentsForBatchYear(batchYear);

  return NextResponse.json({ batchYear, semester: semester ?? null, students });
}
