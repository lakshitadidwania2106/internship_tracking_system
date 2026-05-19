import { answerWithMlModel, isOutcomeQuestion } from "@/lib/ai/co-po-pso-chatbot";
import { classifyIntent, refineIntent } from "@/lib/ai/naive-bayes-intent";
import { prisma } from "@/lib/prisma";

type AssistantStudent = {
  usn: string;
  fullName: string;
  internship: {
    companyName: string;
    roleTitle: string;
    stipend: string | null;
    durationText: string | null;
    startDateRaw: string | null;
    endDateRaw: string | null;
  } | null;
  mapping: {
    relevantPOs: string | null;
    relevantPSOs: string | null;
    coMappingSummary: string | null;
  } | null;
};

export type InternshipPromptResult = {
  mode: "ml-model" | "database-rule" | "ollama-fallback";
  answer: string;
  intent?: string;
  confidence?: number;
  studentUsn?: string;
};

const USN_PATTERN = /\b\dDS\d{2}AI\d{3}\b/i;

function formatStudentSummary(student: AssistantStudent) {
  return [
    `${student.fullName} (${student.usn})`,
    `Company: ${student.internship?.companyName ?? "Not available"}`,
    `Role: ${student.internship?.roleTitle ?? "Not available"}`,
    `Stipend: ${student.internship?.stipend ?? "-"}`,
    `Duration: ${student.internship?.durationText ?? `${student.internship?.startDateRaw ?? "-"} to ${student.internship?.endDateRaw ?? "-"}`}`,
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
    include: { internship: true, batch: true, semesterRecord: true, mapping: true },
    take: 300,
  });

  let best: { score: number; student: (typeof candidates)[number] } | null = null;
  for (const student of candidates) {
    const haystack = `${student.fullName} ${student.usn}`.toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (haystack.includes(token.toLowerCase()) ? 1 : 0), 0);
    if (!best || score > best.score) {
      best = { score, student };
    }
  }

  return best && best.score > 0 ? best.student : null;
}

async function askOllama(question: string, context?: string) {
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
    }),
  });

  if (!response.ok) {
    throw new Error("Ollama request failed");
  }

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

    const context = formatStudentSummary(student);
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

  try {
    const ollamaReply = await askOllama(normalized);
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
