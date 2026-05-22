import { answerWithMlModel, isOutcomeQuestion } from "@/lib/ai/co-po-pso-chatbot";
import { classifyIntent, refineIntent } from "@/lib/ai/naive-bayes-intent";
import { formatGradeDisplay } from "@/lib/format-grade";
import { prisma } from "@/lib/prisma";

type AssistantStudent = {
  usn: string;
  fullName: string;
  batch: { year: number };
  semesterRecord: { semester: number; courseName: string; courseCode: string };
  internship: {
    companyName: string;
    roleTitle: string;
    stipend: string | null;
    durationText: string | null;
    startDateRaw: string | null;
    endDateRaw: string | null;
    grade: string | null;
    status: string | null;
    sourceRowRawJson: string | null;
  } | null;
  mapping: {
    relevantPOs: string | null;
    relevantPSOs: string | null;
    coMappingSummary: string | null;
  } | null;
  reviewMarks: { reviewNumber: number }[];
  documents: { fileLabel: string; storageKey: string | null }[];
};

export type InternshipPromptResult = {
  mode: "ml-model" | "database-rule" | "ollama-fallback";
  answer: string;
  intent?: string;
  confidence?: number;
  studentUsn?: string;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

const USN_PATTERN = /\b\d[A-Z]{2}\d{2}[A-Z]{2}\d{3}\b/i;

const STOPWORDS = new Set([
  "what",
  "which",
  "where",
  "when",
  "who",
  "how",
  "did",
  "does",
  "do",
  "the",
  "and",
  "for",
  "with",
  "about",
  "internship",
  "intern",
  "student",
  "company",
  "role",
  "batch",
  "semester",
  "marks",
  "tell",
  "give",
  "show",
  "name",
  "from",
  "their",
  "this",
  "that",
]);

function tokenizeForNameSearch(question: string): string[] {
  const quoted = question.match(/"([^"]+)"/)?.[1]?.trim();
  const source = quoted ?? question;
  return source
    .replace(USN_PATTERN, " ")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t.toLowerCase()));
}

function scoreNameMatch(student: { fullName: string; usn: string }, tokens: string[]): number {
  const haystack = `${student.fullName} ${student.usn}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    const t = token.toLowerCase();
    if (haystack.includes(t)) score += t.length >= 4 ? 2 : 1;
  }
  if (tokens.length >= 2) {
    const joined = tokens.join(" ").toLowerCase();
    if (student.fullName.toLowerCase().includes(joined)) score += 5;
  }
  return score;
}

function formatStudentContext(student: AssistantStudent): string {
  const evalRaw = student.internship?.sourceRowRawJson;
  let totalMarks: string | undefined;
  if (evalRaw) {
    try {
      const p = JSON.parse(evalRaw) as { evaluation?: { totalMarks?: string } };
      totalMarks = p.evaluation?.totalMarks;
    } catch {
      // ignore
    }
  }

  return [
    `Name: ${student.fullName}`,
    `USN: ${student.usn}`,
    `Batch: ${student.batch.year}, Semester: ${student.semesterRecord.semester}`,
    `Course: ${student.semesterRecord.courseCode} - ${student.semesterRecord.courseName}`,
    `Company: ${student.internship?.companyName ?? "N/A"}`,
    `Role: ${student.internship?.roleTitle ?? "N/A"}`,
    `Stipend: ${student.internship?.stipend ?? "N/A"}`,
    `Duration: ${student.internship?.durationText ?? `${student.internship?.startDateRaw ?? "-"} to ${student.internship?.endDateRaw ?? "-"}`}`,
    `Grade/Marks: ${formatGradeDisplay(student.internship?.grade) || totalMarks || "Absent"}`,
    `Status: ${student.internship?.status ?? "N/A"}`,
    `POs: ${student.mapping?.relevantPOs ?? "-"}`,
    `PSOs: ${student.mapping?.relevantPSOs ?? "-"}`,
    `Reviews on file: ${student.reviewMarks.map((r) => r.reviewNumber).join(", ") || "none"}`,
    `Report PDF: ${student.documents.some((d) => d.storageKey) ? "yes" : "no"}`,
  ].join("\n");
}

function toOutcomeInput(student: AssistantStudent) {
  return {
    usn: student.usn,
    fullName: student.fullName,
    internship: student.internship
      ? {
          companyName: student.internship.companyName,
          roleTitle: student.internship.roleTitle,
        }
      : null,
    mapping: student.mapping,
  };
}

async function findStudentFromQuestion(question: string, hintUsn?: string) {
  const normalizedHint = hintUsn?.trim().toUpperCase();
  if (normalizedHint) {
    const hinted = await prisma.student.findUnique({
      where: { usn: normalizedHint },
      include: { internship: true, batch: true, semesterRecord: true, mapping: true },
    });
    if (hinted) {
      return hinted;
    }
  }

  const usnMatch = question.match(USN_PATTERN)?.[0]?.toUpperCase();
  if (usnMatch) {
    return prisma.student.findUnique({
      where: { usn: usnMatch },
      include: { internship: true, batch: true, semesterRecord: true, mapping: true },
    });
  }

  const quotedName = question.match(/"([^"]+)"/)?.[1]?.trim();
  const tokens = (quotedName ?? question)
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter(
      (token) =>
        ![
          "what",
          "which",
          "did",
          "internship",
          "company",
          "student",
          "name",
          "show",
          "list",
          "mapping",
          "outcome",
          "outcomes",
        ].includes(token.toLowerCase()),
    );

  if (tokens.length === 0) {
    return null;
  }

  const candidates = await prisma.student.findMany({
    include: {
      internship: true,
      batch: true,
      semesterRecord: true,
      mapping: true,
      reviewMarks: true,
      documents: true,
    },
    take: 400,
  });

  let best: { score: number; student: (typeof candidates)[number] } | null = null;
  for (const student of candidates) {
    const score = scoreNameMatch(student, tokens);
    if (!best || score > best.score) best = { score, student };
  }

  return best && best.score >= 2 ? best.student : null;
}

async function answerAggregateQuestion(question: string): Promise<string | null> {
  const q = question.toLowerCase();
  if (!/\b(how many|count|number of|total)\b/.test(q)) return null;

  const [students, internships, withReports] = await Promise.all([
    prisma.student.count(),
    prisma.internship.count(),
    prisma.studentDocument.count({ where: { storageKey: { not: null } } }),
  ]);

  if (q.includes("student")) {
    return `There are ${students} students in the database, with ${internships} internship records and ${withReports} stored report PDFs.`;
  }
  if (q.includes("internship")) {
    return `${internships} internship records are on file across all batches.`;
  }
  if (q.includes("report") || q.includes("pdf")) {
    return `${withReports} student report PDFs are stored in object storage.`;
  }

  return `Database snapshot: ${students} students, ${internships} internships, ${withReports} report PDFs.`;
}

async function askOllama(question: string, context: string, history?: ChatTurn[]) {
  const historyBlock =
    history && history.length > 0
      ? `Recent conversation:\n${history
          .slice(-6)
          .map((t) => `${t.role}: ${t.content}`)
          .join("\n")}`
      : "";

  const prompt = [
    "You are InternBot for DSCE AIML internship tracking portal.",
    "Answer briefly in 2-4 lines for faculty users.",
    "If context is provided, answer strictly from context.",
    context ? `Context:\n${context}` : "",
    `Question: ${question}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL ?? "llama3.2",
      prompt,
      stream: false,
      options: { temperature: 0.15, num_predict: 280 },
    }),
  });

  if (!response.ok) throw new Error("Ollama request failed");
  const data = (await response.json()) as { response?: string };
  return data.response?.trim();
}

function isOutcomeRelatedQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  if (/\b(co|po|pso)\b/.test(lower) || lower.includes("outcome") || lower.includes("mapping")) {
    return true;
  }
  const { intent } = classifyIntent(question);
  return isOutcomeQuestion(refineIntent(question, intent));
}

export async function askInternshipAssistant(
  question: string,
  options?: { usn?: string },
): Promise<InternshipPromptResult> {
  const normalized = question.trim();
  if (!normalized) {
    return {
      mode: "database-rule",
      answer:
        "Ask InternBot about a student’s CO, PO, or PSO. Example: Show CO PO PSO mapping for 1DS21AI001",
    };
  }

  const student = (await findStudentFromQuestion(normalized, options?.usn)) as AssistantStudent | null;

  if (student) {
    const lower = normalized.toLowerCase();

    if (isOutcomeRelatedQuestion(normalized)) {
      const ml = answerWithMlModel(normalized, toOutcomeInput(student));
      return ml;
    }

    if (lower.includes("company")) {
      return {
        mode: "database-rule",
        answer: `${student.fullName} (${student.usn}) interned at ${student.internship?.companyName ?? "company not available in records"}.`,
        studentUsn: student.usn,
      };
    }
    if (lower.includes("stipend")) {
      return {
        mode: "database-rule",
        answer: `${student.fullName} (${student.usn}) stipend: ${student.internship?.stipend ?? "not available"}.`,
        studentUsn: student.usn,
      };
    }
    if (lower.includes("role") || lower.includes("domain")) {
      return {
        mode: "database-rule",
        answer: `${student.fullName} (${student.usn}) role: ${student.internship?.roleTitle ?? "not available"}.`,
        studentUsn: student.usn,
      };
    }

    const context = formatStudentContext(student);
    try {
      const ollamaReply = await askOllama(normalized, context);
      if (ollamaReply) {
        return { mode: "ollama-fallback", answer: ollamaReply, studentUsn: student.usn };
      }
    } catch {
      return { mode: "database-rule", answer: context, studentUsn: student.usn };
    }
    return { mode: "database-rule", answer: context, studentUsn: student.usn };
  }

  // Batch-level context for Ollama when no student matched
  const batchStats = await prisma.batch.findMany({
    include: { _count: { select: { students: true } }, semesters: true },
    orderBy: { year: "desc" },
    take: 5,
  });
  const batchContext = batchStats
    .map((b) => `Batch ${b.year}: ${b._count.students} students, semesters ${b.semesters.map((s) => s.semester).join(", ")}`)
    .join("\n");

  try {
    const ollamaReply = await askOllama(
      normalized,
      `Available batches:\n${batchContext}\nNo specific student was matched from this question.`,
    );
    if (ollamaReply) {
      return { mode: "ollama-fallback", answer: ollamaReply };
    }
  } catch {
    return {
      mode: "database-rule",
      answer:
        "I could not match a student. Include a USN (e.g. 1DS21AI001) or full name, or open a student on the dashboard first.",
    };
  }

  return {
    mode: "database-rule",
    answer:
      "I could not match a student. Include a USN (e.g. 1DS21AI001) or full name, or open a student on the dashboard first.",
  };
}
