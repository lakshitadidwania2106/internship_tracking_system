import {
  buildStudentMarksRecord,
  extractFinalTotal,
  extractReducedMarks,
  findColumnByPattern,
  type StudentWithMarks,
} from "@/lib/marks-distribution";
import type { StudentRetrievalContext } from "@/lib/ai/student-retrieval";

export function toStudentWithMarks(ctx: StudentRetrievalContext & {
  reviewMarks?: Array<{ reviewNumber: number; rowJson: string }>;
  sourceRowRawJson?: string | null;
}): StudentWithMarks {
  return {
    usn: ctx.usn,
    fullName: ctx.fullName,
    batch: { year: ctx.batchYear },
    semesterRecord: { semester: ctx.semester },
    internship: {
      sourceRowRawJson: ctx.sourceRowRawJson ?? null,
    },
    reviewMarks: ctx.reviewMarks ?? [],
  };
}

export function performanceCategory(total: number | null): string {
  if (total == null) return "Not available";
  if (total >= 90) return "Excellent";
  if (total >= 80) return "Very good";
  if (total >= 70) return "Good";
  if (total >= 60) return "Satisfactory";
  if (total >= 50) return "Average";
  return "Needs improvement";
}

function reviewTotal(row: Record<string, string>): string | null {
  for (const [key, value] of Object.entries(row)) {
    const norm = key.toLowerCase();
    if ((norm.includes("total") || norm.includes("max")) && value.trim()) {
      return value.trim();
    }
  }
  const nums = Object.values(row)
    .map((v) => Number(String(v).replace(/[^\d.-]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 100);
  if (nums.length === 0) return null;
  return String(Math.max(...nums));
}

export function formatStudentMarksAnswer(
  ctx: StudentRetrievalContext & {
    reviewMarks?: Array<{ reviewNumber: number; rowJson: string }>;
    sourceRowRawJson?: string | null;
  },
): string {
  const record = buildStudentMarksRecord(toStudentWithMarks(ctx));
  const finalTotal = extractFinalTotal(record.finalRow);
  const reduced = extractReducedMarks(record.finalRow);
  const category = performanceCategory(finalTotal);

  const lines: string[] = [
    `Marks — ${ctx.fullName} (${ctx.usn})`,
    "",
  ];

  const reviewLines: string[] = [];
  for (const n of [1, 2, 3] as const) {
    if (!record.hasReviewData[n]) continue;
    const row = record.reviews[n] ?? {};
    const total = reviewTotal(row);
    reviewLines.push(
      total
        ? `Review ${n}: ${total}${total.includes("/") ? "" : " (total)"}`
        : `Review ${n}: recorded (see component marks below)`,
    );
  }

  if (reviewLines.length) {
    lines.push("Reviews:", ...reviewLines.map((l) => `• ${l}`), "");
  }

  const evalSnap = ctx.evaluation;
  if (evalSnap.totalMarks || evalSnap.reportMarks || evalSnap.presentationMarks) {
    lines.push("Final evaluation:");
    if (evalSnap.reportMarks) lines.push(`• Report: ${evalSnap.reportMarks}`);
    if (evalSnap.presentationMarks) lines.push(`• Presentation: ${evalSnap.presentationMarks}`);
    if (evalSnap.totalMarks) lines.push(`• Total: ${evalSnap.totalMarks}`);
    lines.push("");
  } else if (record.hasFinalData) {
    const totalLabel =
      finalTotal != null
        ? `${finalTotal}/100`
        : findColumnByPattern(record.finalRow, /total|max/i) ?? "—";
    lines.push(`Final total: ${totalLabel}`);
    if (reduced) lines.push(`Reduced marks: ${reduced}`);
    lines.push("");
  }

  if (finalTotal != null) {
    lines.push(`Performance: ${category} (${finalTotal}/100).`);
    lines.push(buildPerformanceNarrative(ctx, finalTotal, category, reviewLines.length));
  } else if (!reviewLines.length && !record.hasFinalData) {
    lines.push("No marks found in imported Excel data for this student yet.");
  } else if (reviewLines.length) {
    lines.push(buildPerformanceNarrative(ctx, null, category, reviewLines.length));
  }

  if (ctx.internship?.grade) {
    lines.push(`Grade on record: ${ctx.internship.grade}.`);
  }

  return lines.join("\n");
}

function buildPerformanceNarrative(
  ctx: StudentRetrievalContext,
  finalTotal: number | null,
  category: string,
  reviewCount: number,
): string {
  const grade = ctx.internship?.grade?.trim();
  const gradeBit = grade ? ` Grade on record: ${grade}.` : "";
  if (finalTotal != null && finalTotal >= 80) {
    return `Overall performance is strong.${reviewCount ? " Scores are consistent across review rounds." : ""}${gradeBit}`;
  }
  if (finalTotal != null && finalTotal >= 60) {
    return `Overall performance is satisfactory with room to grow.${gradeBit}`;
  }
  if (reviewCount >= 2) {
    return `Review marks are on file across ${reviewCount} rounds.${gradeBit}`;
  }
  return gradeBit || "See component marks above for detail.";
}

export function formatPerformanceSummary(
  ctx: StudentRetrievalContext & {
    reviewMarks?: Array<{ reviewNumber: number; rowJson: string }>;
    sourceRowRawJson?: string | null;
  },
): string {
  const record = buildStudentMarksRecord(toStudentWithMarks(ctx));
  const finalTotal = extractFinalTotal(record.finalRow);
  const category = performanceCategory(finalTotal);
  const topCo = ctx.profile.coAlignments[0];

  const parts: string[] = [
    `${ctx.fullName} (${ctx.usn}) performed ${category.toLowerCase()} overall.`,
  ];

  if (finalTotal != null) {
    parts.push(`Final internship score: ${finalTotal}/100.`);
  } else if (ctx.evaluation.totalMarks) {
    parts.push(`Recorded total: ${ctx.evaluation.totalMarks}.`);
  }

  const reviewCount = [1, 2, 3].filter((n) => record.hasReviewData[n as 1 | 2 | 3]).length;
  if (reviewCount > 0) {
    parts.push(`${reviewCount} review round(s) on file.`);
  }

  if (ctx.internship) {
    parts.push(
      `Internship: ${ctx.internship.roleTitle} at ${ctx.internship.companyName}.`,
    );
  }

  if (topCo) {
    parts.push(`Strongest outcome alignment: ${topCo.coId}.`);
  }

  parts.push(buildPerformanceNarrative(ctx, finalTotal, category, reviewCount));

  return parts.join(" ");
}

/** Compact marks line for student summary block */
export function marksSummaryLine(
  ctx: StudentRetrievalContext & {
    reviewMarks?: Array<{ reviewNumber: number; rowJson: string }>;
    sourceRowRawJson?: string | null;
  },
): string {
  const record = buildStudentMarksRecord(toStudentWithMarks(ctx));
  const finalTotal = extractFinalTotal(record.finalRow);
  if (finalTotal != null) {
    return `Final ${finalTotal}/100 (${performanceCategory(finalTotal).toLowerCase()})`;
  }
  if (ctx.evaluation.totalMarks) return `Total ${ctx.evaluation.totalMarks}`;
  const reviews = [1, 2, 3].filter((n) => record.hasReviewData[n as 1 | 2 | 3]).length;
  if (reviews) return `${reviews} review sheet(s) on file`;
  return "Marks not imported yet";
}
