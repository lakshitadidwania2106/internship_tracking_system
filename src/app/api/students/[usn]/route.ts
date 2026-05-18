import { NextResponse } from "next/server";
import { getStudentById, getStudentByUsn } from "@/lib/data";

/** Numeric path segments resolve by primary key; otherwise lookup by USN (existing behaviour). */
export async function GET(_: Request, context: { params: Promise<{ usn: string }> }) {
  const params = await context.params;
  const key = params.usn.trim();
  const student = /^\d+$/.test(key)
    ? await getStudentById(Number(key))
    : await getStudentByUsn(key);

  if (!student) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({ student });
}
