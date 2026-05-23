import { NextRequest, NextResponse } from "next/server";
import { BATCH_SEMESTER_MAP } from "@/lib/constants";
import { ensureBatchSemester } from "@/lib/importer";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await context.params;
  const batchYear = Number(yearParam);
  if (!batchYear) {
    return NextResponse.json({ message: "Invalid batch year." }, { status: 400 });
  }

  const batch = await prisma.batch.findUnique({ where: { year: batchYear } });
  if (!batch) {
    return NextResponse.json({ message: "Batch not found. Create the batch first." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    semester?: number;
    reviewCount?: number;
    courseCode?: string;
    courseName?: string;
    credits?: number;
  } | null;

  const semester = Number(body?.semester);
  if (!Number.isFinite(semester)) {
    return NextResponse.json({ message: "`semester` is required." }, { status: 400 });
  }

  const allowed = BATCH_SEMESTER_MAP[batchYear] ?? [];
  if (allowed.length > 0 && !allowed.includes(semester)) {
    return NextResponse.json(
      { message: `Semester ${semester} is not allowed for batch ${batchYear}. Use: ${allowed.join(", ")}.` },
      { status: 400 },
    );
  }

  const reviewCount = body?.reviewCount !== undefined ? Number(body.reviewCount) : undefined;
  const credits = body?.credits !== undefined ? Number(body.credits) : undefined;

  const { semesterRecord } = await ensureBatchSemester({
    batchYear,
    semester,
    courseCode: body?.courseCode?.trim() || undefined,
    courseName: body?.courseName?.trim() || undefined,
    credits: credits !== undefined && Number.isFinite(credits) ? credits : undefined,
    reviewCount: reviewCount !== undefined && Number.isFinite(reviewCount) ? reviewCount : undefined,
  });

  return NextResponse.json({ semester: semesterRecord });
}
