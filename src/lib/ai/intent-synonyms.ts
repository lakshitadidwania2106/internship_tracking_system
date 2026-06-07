import type { ChatIntent } from "@/lib/ai/naive-bayes-intent";

/** Phrase groups — any substring match counts as a hit. */
export const INTENT_SYNONYMS: Partial<Record<ChatIntent, string[]>> = {
  outcomes_mapping: [
    "mapping",
    "mapped outcomes",
    "outcome mapping",
    "outcome analysis",
    "student mapping",
    "co po pso",
    "co-po-pso",
    "co/po/pso",
    "student outcomes",
    "mapped outcomes",
    "outcomes mapped",
    "what outcomes",
    "which outcomes",
    "outcome for",
    "outcomes for",
    "give mapping",
    "show mapping",
    "get mapping",
  ],
  outcomes_all: [
    "full mapping",
    "complete mapping",
    "all outcomes",
    "all co",
    "full co po pso",
    "detailed mapping",
    "complete breakdown",
  ],
  student_marks: [
    "marks",
    "give marks",
    "show marks",
    "mark sheet",
    "scores",
    "review marks",
    "review scores",
    "final marks",
    "evaluation marks",
    "evaluation",
    "total marks",
    "what marks",
    "student marks",
    "internship score",
    "internship marks",
    "grades",
    "how much did",
    "scored",
  ],
  performance_analysis: [
    "how did",
    "perform",
    "performance",
    "performance summary",
    "how well",
    "evaluation summary",
    "did well",
    "performance analysis",
  ],
  student_summary: [
    "tell me about",
    "about this student",
    "about the student",
    "who is",
    "student profile",
    "overview of",
    "give me info",
    "information about",
    "details about",
    "describe this student",
  ],
  internship_summary: [
    "summarize internship",
    "internship summary",
    "summary of internship",
    "internship overview",
    "describe internship",
    "internship details",
    "tell me about internship",
  ],
  top_outcomes: [
    "strongest outcomes",
    "top outcomes",
    "best outcomes",
    "strongest co",
    "strongest po",
    "main outcomes",
    "primary outcomes",
    "best mapped",
  ],
  outcomes_justification: [
    "why mapping",
    "why mapped",
    "why this mapping",
    "why did this student get",
    "reason for mapping",
    "mapping justification",
    "why outcomes",
    "explain the outcomes",
    "explain outcomes",
    "explain the mapping",
  ],
  internship_company: [
    "company",
    "employer",
    "organization",
    "where did",
    "working at",
    "work at",
    "which company",
    "what company",
  ],
  internship_role: [
    "role",
    "position",
    "job title",
    "job role",
    "what role",
    "internship role",
    "domain",
  ],
  report_summary: [
    "summarize report",
    "report summary",
    "internship report",
  ],
};

export function matchIntentSynonyms(question: string, intent: ChatIntent): boolean {
  const phrases = INTENT_SYNONYMS[intent];
  if (!phrases?.length) return false;
  const lower = question.toLowerCase();
  return phrases.some((phrase) => lower.includes(phrase));
}

export function scoreIntentSynonyms(question: string): Array<{ intent: ChatIntent; score: number }> {
  const lower = question.toLowerCase();
  const scores: Array<{ intent: ChatIntent; score: number }> = [];

  for (const [intent, phrases] of Object.entries(INTENT_SYNONYMS) as Array<
    [ChatIntent, string[]]
  >) {
    let score = 0;
    for (const phrase of phrases ?? []) {
      if (lower.includes(phrase)) {
        score += phrase.split(/\s+/).length;
      }
    }
    if (score > 0) scores.push({ intent, score });
  }

  return scores.sort((a, b) => b.score - a.score);
}

export function wantsDetailedResponse(question: string): boolean {
  const lower = question.toLowerCase();
  return (
    /\b(in detail|detailed|full mapping|complete mapping|full report|all details|complete breakdown|show all|matrix|breakdown)\b/i.test(
      lower,
    ) ||
    /\b(explain in detail|detailed report|full co)\b/i.test(lower)
  );
}

export function wantsConversationalTone(question: string): boolean {
  return !wantsDetailedResponse(question);
}
