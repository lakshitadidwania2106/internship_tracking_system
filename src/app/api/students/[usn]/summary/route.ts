import { NextResponse } from "next/server";
import { generateStudentInternshipSummary } from "@/lib/student-summary";

export async function GET(_: Request, context: { params: Promise<{ usn: string }> }) {
  const { usn } = await context.params;
  const result = await generateStudentInternshipSummary(usn);

  if (!result.found) {
    return NextResponse.json({ message: "Student not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}
