"use client";

import { extractFinalTotal, buildStudentMarksRecord } from "@/lib/marks-distribution";
import { Search } from "lucide-react";

type StudentRow = {
  usn: string;
  fullName: string;
  internship: { companyName: string; roleTitle: string; sourceRowRawJson: string | null } | null;
};

export function CompactStudentList({
  students,
  focusUsn,
  batchYear,
  semester,
}: {
  students: StudentRow[];
  focusUsn?: string;
  batchYear: number;
  semester: number;
}) {
  if (students.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-slate-50 px-4 py-8 text-center text-sm text-muted">
        No students in batch {batchYear}, semester {semester}.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {students.slice(0, 50).map((student) => {
        const record = buildStudentMarksRecord({
          usn: student.usn,
          fullName: student.fullName,
          internship: student.internship,
        });
        const marks = extractFinalTotal(record.finalRow);
        const isFocus = focusUsn && student.usn.toUpperCase() === focusUsn.toUpperCase();

        return (
          <a
            key={student.usn}
            href={`/?tab=overview&batch=${batchYear}&semester=${semester}&usn=${encodeURIComponent(student.usn)}`}
            className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm transition hover:border-primary/40 hover:bg-slate-50 ${
              isFocus ? "border-[#9ad9cf] bg-[#f0faf8] ring-1 ring-[#9ad9cf]" : "border-border bg-white"
            }`}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-[var(--dsce-navy)]">{student.fullName}</p>
              <p className="text-xs text-muted">{student.usn}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-muted">{student.internship?.companyName ?? "No company"}</p>
              <p className="font-semibold text-primary">{marks !== null ? `${marks}/100` : "—"}</p>
            </div>
          </a>
        );
      })}
      {students.length > 50 ? (
        <p className="text-center text-xs text-muted">
          Showing 50 of {students.length}. Use search to find a specific USN.
        </p>
      ) : null}
    </div>
  );
}

export function StudentSearchHint() {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-[#9ad9cf] bg-[#f0faf8] px-4 py-3 text-sm text-slate-700">
      <Search className="h-4 w-4 shrink-0 text-primary" />
      Search by USN above to open a student profile with review timeline and skill charts.
    </p>
  );
}
