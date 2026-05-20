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
  mode: "database-rule" | "ollama" | "aggregate";
  answer: string;
  matchedUsn?: string;
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

type QuestionIntent =
  | "company"
  | "role"
  | "stipend"
  | "duration"
  | "marks"
  | "summary"
  | "count"
  | "list"
  | "report"
  | "general";

function classifyIntent(question: string): QuestionIntent {
  const q = question.toLowerCase();
  if (/\b(how many|count|number of|total)\b/.test(q)) return "count";
  if (/\b(list|which students|who interned)\b/.test(q)) return "list";
  if (/\b(report|pdf|document)\b/.test(q)) return "report";
  if (/\b(mark|grade|score|evaluation|presentation)\b/.test(q)) return "marks";
  if (/\b(stipend|paid|salary)\b/.test(q)) return "stipend";
  if (/\b(duration|period|when|start|end|months)\b/.test(q)) return "duration";
  if (/\b(role|domain|title|position)\b/.test(q)) return "role";
  if (/\b(company|organization|firm|where)\b/.test(q)) return "company";
  if (/\b(summarize|summary|overview|describe|explain)\b/.test(q)) return "summary";
  return "general";
}

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
    `Grade/Marks: ${student.internship?.grade ?? totalMarks ?? "N/A"}`,
    `Status: ${student.internship?.status ?? "N/A"}`,
    `POs: ${student.mapping?.relevantPOs ?? "-"}`,
    `PSOs: ${student.mapping?.relevantPSOs ?? "-"}`,
    `Reviews on file: ${student.reviewMarks.map((r) => r.reviewNumber).join(", ") || "none"}`,
    `Report PDF: ${student.documents.some((d) => d.storageKey) ? "yes" : "no"}`,
  ].join("\n");
}

async function findStudentFromQuestion(question: string) {
  const usnMatch = question.match(USN_PATTERN)?.[0]?.toUpperCase();
  if (usnMatch) {
    return prisma.student.findUnique({
      where: { usn: usnMatch },
      include: {
        internship: true,
        batch: true,
        semesterRecord: true,
        mapping: true,
        reviewMarks: true,
        documents: true,
      },
    });
  }

  const tokens = tokenizeForNameSearch(question);
  if (tokens.length === 0) return null;

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

function answerFromIntent(student: AssistantStudent, intent: QuestionIntent): string | null {
  switch (intent) {
    case "company":
      return `${student.fullName} (${student.usn}) interned at ${student.internship?.companyName ?? "a company not listed in records"}.`;
    case "role":
      return `${student.fullName} worked as ${student.internship?.roleTitle ?? "role not listed"}.`;
    case "stipend":
      return `Stipend for ${student.fullName}: ${student.internship?.stipend ?? "not recorded"}.`;
    case "duration":
      return `${student.fullName}'s internship duration: ${
        student.internship?.durationText ??
        `${student.internship?.startDateRaw ?? "?"} to ${student.internship?.endDateRaw ?? "?"}`
      }.`;
    case "marks":
      return `${student.fullName}'s grade/marks: ${student.internship?.grade ?? "not assigned yet"}.`;
    case "report":
      return student.documents.some((d) => d.storageKey)
        ? `Yes — a report PDF is on file for ${student.usn}. Use Download on the Overview tab or /api/documents/by-usn/${student.usn}.`
        : `No stored PDF report found for ${student.usn} yet. Upload via Data Management.`;
    case "summary":
      return formatStudentContext(student);
    default:
      return null;
  }
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
    "You are InternBot for the DSCE AIML Internship Portal (faculty audience).",
    "Answer in 2-5 clear sentences. Use ONLY facts from Context and conversation.",
    "If the answer is not in context, say what is missing and suggest searching by USN.",
    "Never invent companies, marks, or dates.",
    historyBlock,
    `Context:\n${context}`,
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

export async function askInternshipAssistant(
  question: string,
  history?: ChatTurn[],
): Promise<InternshipPromptResult> {
  const normalized = question.trim();
  if (!normalized) {
    return {
      mode: "database-rule",
      answer: "Ask a question with a student USN or name — e.g. “What company did 1DS21AI001 intern at?”",
    };
  }

  const aggregate = await answerAggregateQuestion(normalized);
  if (aggregate) {
    return { mode: "aggregate", answer: aggregate };
  }

  const intent = classifyIntent(normalized);
  const student = (await findStudentFromQuestion(normalized)) as AssistantStudent | null;

  if (student) {
    const direct = answerFromIntent(student, intent);
    if (direct && intent !== "general" && intent !== "summary") {
      return { mode: "database-rule", answer: direct, matchedUsn: student.usn };
    }

    const context = formatStudentContext(student);
    try {
      const ollamaReply = await askOllama(normalized, context, history);
      if (ollamaReply) {
        return { mode: "ollama", answer: ollamaReply, matchedUsn: student.usn };
      }
    } catch {
      if (direct) return { mode: "database-rule", answer: direct, matchedUsn: student.usn };
      return { mode: "database-rule", answer: context, matchedUsn: student.usn };
    }

    return {
      mode: "database-rule",
      answer: direct ?? context,
      matchedUsn: student.usn,
    };
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
      history,
    );
    if (ollamaReply) {
      return { mode: "ollama", answer: ollamaReply };
    }
  } catch {
    // fall through
  }

  return {
    mode: "database-rule",
    answer:
      "I could not match a student. Include a USN (e.g. 1DS21AI001) or put the full name in quotes. You can also ask “How many students are in the database?”",
  };
}
