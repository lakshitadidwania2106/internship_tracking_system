export type InternshipPromptResult = {
  mode: "database-only";
  answer: string;
};

export async function askInternshipAssistant(question: string): Promise<InternshipPromptResult> {
  return {
    mode: "database-only",
    answer:
      `LLM layer is not enabled yet. Question received: "${question}". ` +
      "Use batch/semester filters and USN search for reliable local retrieval.",
  };
}
