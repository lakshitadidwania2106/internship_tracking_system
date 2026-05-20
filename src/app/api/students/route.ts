import { NextRequest, NextResponse } from "next/server";
import { searchStudents } from "@/lib/data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchYear = Number(searchParams.get("batch") ?? "") || undefined;
  const semester = Number(searchParams.get("semester") ?? "") || undefined;
  const query = searchParams.get("q") ?? searchParams.get("usn") ?? undefined;

  const students = await searchStudents({ batchYear, semester, query });
  return NextResponse.json({ students });
}
