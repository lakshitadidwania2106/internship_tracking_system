import { answerFromRetrieval, type EngineResponse } from "@/lib/ai/response-engine";
import type { ChatIntent } from "@/lib/ai/naive-bayes-intent";

export type MlChatbotResult = EngineResponse;

const OUTCOME_INTENTS: ChatIntent[] = [
  "invalid_query",
  "greeting",
  "outcomes_mapping",
  "outcomes_all",
  "outcomes_co",
  "outcomes_po",
  "outcomes_pso",
  "outcomes_po_why",
  "outcomes_justification",
  "compare_students",
  "sdg_alignment",
  "internship_analytics",
  "report_summary",
  "technologies_co",
];

export function isOutcomeQuestion(intent: ChatIntent): boolean {
  return OUTCOME_INTENTS.includes(intent);
}

/** @deprecated Use answerFromRetrieval — kept for module compatibility */
export async function answerWithMlModel(
  question: string,
  _student?: unknown,
  options?: { usn?: string; history?: string[] },
): Promise<MlChatbotResult> {
  return answerFromRetrieval(question, options);
}
