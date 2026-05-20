import { NextResponse } from "next/server";
import { deleteBatchByYear } from "@/lib/batch-status";

export async function DELETE(_: Request, context: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await context.params;
  const batchYear = Number(yearParam);
  if (!batchYear) {
    return NextResponse.json({ message: "Invalid batch year." }, { status: 400 });
  }

  const result = await deleteBatchByYear(batchYear);
  if (!result) {
    return NextResponse.json({ message: "Batch not found." }, { status: 404 });
  }

  return NextResponse.json({
    message: `Batch ${batchYear} and all related students, files, and records were deleted.`,
    ...result,
  });
}
