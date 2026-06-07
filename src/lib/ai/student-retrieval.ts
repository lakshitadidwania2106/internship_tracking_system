import { prisma } from "@/lib/prisma";
import {
  analyzeStudentProfile,
  type NlpAnalysisResult,
} from "@/lib/ai/text-utils";
import {
  buildStudentOutcomeProfile,
  type StudentOutcomeInput,
  type StudentOutcomeProfile,
} from "@/lib/ai/student-outcomes";

const USN_PATTERN = /\b\dDS\d{2}AI\d{3}\b/gi;

export type EvaluationSnapshot = {
  totalMarks?: string;
  reportMarks?: string;
  presentationMarks?: string;
  evaluatorName?: string;
  internshipTitle?: string;
};

export type StudentRetrievalContext = {
  usn: string;
  fullName: string;
  batchYear: number;
  semester: number;
  internship: {
    companyName: string;
    roleTitle: string;
    stipend: string | null;
    durationText: string | null;
    startDateRaw: string | null;
    endDateRaw: string | null;
    grade: string | null;
    status: string | null;
  } | null;
  mapping: {
    relevantPOs: string | null;
    relevantPSOs: string | null;
    coMappingSummary: string | null;
    justification: string | null;
  } | null;
  evaluation: EvaluationSnapshot;
  excelRowSnippet: string;
  nlp: NlpAnalysisResult;
  profile: StudentOutcomeProfile;
  documentLabels: string[];
  hasReportPdf: boolean;
  reviewMarks: Array<{ reviewNumber: number; rowJson: string }>;
  sourceRowRawJson: string | null;
};

const STOPWORDS = new Set([
  "what", "which", "did", "internship", "company", "student", "name", "show", "list",
  "mapping", "outcome", "outcomes", "this", "that", "their", "about", "explain", "why",
  "how", "the", "for", "and", "with", "from", "compare", "between",
]);

function parseEvaluation(rawJson?: string | null): EvaluationSnapshot {
  if (!rawJson) return {};
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    const evaluation = (parsed.evaluation ?? {}) as Record<string, unknown>;
    return {
      totalMarks: String(evaluation.totalMarks ?? parsed["Total Marks"] ?? ""),
      reportMarks: String(evaluation.reportMarks ?? parsed["Report Marks"] ?? ""),
      presentationMarks: String(evaluation.presentationMarks ?? parsed["Presentation Marks"] ?? ""),
      evaluatorName: String(evaluation.evaluatorName ?? parsed["Evaluator"] ?? ""),
      internshipTitle: String(
        evaluation.internshipTitle ??
          parsed["INTERNSHIP TITLE"] ??
          parsed["Internship Title"] ??
          "",
      ),
    };
  } catch {
    return {};
  }
}

function flattenExcelRow(rawJson?: string | null, maxLen = 1200): string {
  if (!rawJson) return "";
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    const parts: string[] = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (key === "evaluation" || value == null || value === "") continue;
      parts.push(`${key}: ${String(value)}`);
    }
    const evalBlock = parsed.evaluation as Record<string, unknown> | undefined;
    if (evalBlock) {
      for (const [key, value] of Object.entries(evalBlock)) {
        if (value != null && value !== "") parts.push(`${key}: ${String(value)}`);
      }
    }
    return parts.join(". ").slice(0, maxLen);
  } catch {
    return "";
  }
}

export async function loadStudentRecord(usn: string) {
  return prisma.student.findUnique({
    where: { usn: usn.toUpperCase() },
    include: {
      internship: true,
      mapping: true,
      batch: true,
      semesterRecord: true,
      documents: true,
      reviewMarks: { orderBy: { reviewNumber: "asc" } },
    },
  });
}

export async function buildStudentRetrievalContext(
  student: NonNullable<Awaited<ReturnType<typeof loadStudentRecord>>>,
): Promise<StudentRetrievalContext> {
  const outcomeInput: StudentOutcomeInput = {
    usn: student.usn,
    fullName: student.fullName,
    internship: student.internship
      ? {
          companyName: student.internship.companyName,
          roleTitle: student.internship.roleTitle,
        }
      : null,
    mapping: student.mapping,
    nlp: undefined,
    evaluation: parseEvaluation(student.internship?.sourceRowRawJson),
    excelRowSnippet: flattenExcelRow(student.internship?.sourceRowRawJson),
    sourceRowRawJson: student.internship?.sourceRowRawJson ?? null,
  };

  const nlp = analyzeStudentProfile({
    roleTitle: student.internship?.roleTitle ?? "",
    companyName: student.internship?.companyName ?? "",
    coMappingSummary: student.mapping?.coMappingSummary,
    justification: student.mapping?.justification,
    sourceRowRawJson: student.internship?.sourceRowRawJson,
  });

  outcomeInput.nlp = nlp;
  const profile = buildStudentOutcomeProfile(outcomeInput);

  const documentLabels = student.documents.map((d) => d.fileLabel);
  const hasReportPdf = student.documents.some(
    (d) => d.storageKey != null && /\.pdf$/i.test(d.fileLabel),
  );

  return {
    usn: student.usn,
    fullName: student.fullName,
    batchYear: student.batch.year,
    semester: student.semesterRecord.semester,
    internship: student.internship
      ? {
          companyName: student.internship.companyName,
          roleTitle: student.internship.roleTitle,
          stipend: student.internship.stipend,
          durationText: student.internship.durationText,
          startDateRaw: student.internship.startDateRaw,
          endDateRaw: student.internship.endDateRaw,
          grade: student.internship.grade,
          status: student.internship.status,
        }
      : null,
    mapping: student.mapping,
    evaluation: parseEvaluation(student.internship?.sourceRowRawJson),
    excelRowSnippet: flattenExcelRow(student.internship?.sourceRowRawJson),
    nlp,
    profile,
    documentLabels,
    hasReportPdf,
    reviewMarks: student.reviewMarks.map((m) => ({
      reviewNumber: m.reviewNumber,
      rowJson: m.rowJson,
    })),
    sourceRowRawJson: student.internship?.sourceRowRawJson ?? null,
  };
}

export function extractUsnsFromText(text: string): string[] {
  const matches = text.match(USN_PATTERN) ?? [];
  return [...new Set(matches.map((u) => u.toUpperCase()))];
}

/** Load students: USNs in the question win; dashboard hint is fallback only. */
export async function findStudentsFromQuestion(question: string, hintUsn?: string) {
  const questionUsns = extractUsnsFromText(question);

  if (questionUsns.length > 0) {
    const loaded = await Promise.all(questionUsns.map((usn) => loadStudentRecord(usn)));
    return loaded.filter((s): s is NonNullable<typeof s> => s != null);
  }

  if (hintUsn?.trim()) {
    const hinted = await loadStudentRecord(hintUsn.trim());
    return hinted ? [hinted] : [];
  }

  const quotedName = question.match(/"([^"]+)"/)?.[1]?.trim();
  const tokens = (quotedName ?? question)
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t.toLowerCase()));

  if (tokens.length === 0) return [];

  const candidates = await prisma.student.findMany({
    include: { internship: true, mapping: true, batch: true, semesterRecord: true, documents: true },
    take: 300,
  });

  let best: { score: number; student: (typeof candidates)[number] } | null = null;
  for (const student of candidates) {
    const haystack = `${student.fullName} ${student.usn}`.toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (haystack.includes(token.toLowerCase()) ? 1 : 0), 0);
    if (!best || score > best.score) best = { score, student };
  }

  return best && best.score > 0 ? [best.student] : [];
}
