import { answerFromRetrieval } from "@/lib/ai/response-engine";
import type { ChatTurn } from "@/lib/ai/conversation-memory";

export type InternshipPromptResult = {
  mode: "ml-model" | "database-rule" | "ollama-fallback";
  answer: string;
  intent?: string;
  confidence?: number;
  studentUsn?: string;
  debug?: Record<string, unknown>;
};

export type { ChatTurn };

export async function askInternshipAssistant(
  question: string,
  options?: { usn?: string; history?: string[]; turns?: ChatTurn[] },
): Promise<InternshipPromptResult> {
  const normalized = question.trim();
  if (!normalized) {
    return {
      mode: "database-rule",
      answer: "Please enter a question about a student's internship outcomes.",
    };
  }

  const result = await answerFromRetrieval(normalized, {
    usn: options?.usn,
    history: options?.history,
    turns: options?.turns,
  });

  return {
    ...result,
    debug: result.debug as Record<string, unknown> | undefined,
  };
}
