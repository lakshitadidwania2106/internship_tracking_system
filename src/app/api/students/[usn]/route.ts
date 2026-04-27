import { NextResponse } from "next/server";
import { getStudentByUsn } from "@/lib/data";

export async function GET(_: Request, context: { params: Promise<{ usn: string }> }) {
  const params = await context.params;
  const student = await getStudentByUsn(params.usn);

  if (!student) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({ student });
}
