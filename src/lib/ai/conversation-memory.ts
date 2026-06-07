import type { ChatIntent } from "@/lib/ai/naive-bayes-intent";
import { extractUsnsFromText } from "@/lib/ai/student-retrieval";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  intent?: string;
  studentUsn?: string;
};

export type ConversationMemory = {
  lastUsn: string | null;
  lastIntent: ChatIntent | null;
  lastCompany: string | null;
  lastRole: string | null;
  lastCoId: string | null;
  turnCount: number;
};

const VALID_INTENTS = new Set<string>([
  "outcomes_mapping",
  "outcomes_all",
  "outcomes_co",
  "outcomes_po",
  "outcomes_pso",
  "outcomes_po_why",
  "outcomes_justification",
  "student_marks",
  "performance_analysis",
  "student_summary",
  "internship_summary",
  "internship_company",
  "internship_role",
  "top_outcomes",
  "report_summary",
]);

/** Pronoun / deictic reference to the student from the prior turn */
const PRONOUN_REF =
  /\b(for him|for her|for them|about him|about her|this student|that student|same student|the student|for this intern|about this intern)\b/i;

const BARE_FOLLOWUP =
  /^(why|how|explain|tell me more|more|elaborate|go on|continue|and\??|what about that|same|ok why)\??$/i;

export function buildConversationMemory(
  turns: ChatTurn[] | undefined,
  hintUsn?: string,
): ConversationMemory {
  const memory: ConversationMemory = {
    lastUsn: hintUsn?.trim().toUpperCase() ?? null,
    lastIntent: null,
    lastCompany: null,
    lastRole: null,
    lastCoId: null,
    turnCount: turns?.length ?? 0,
  };

  if (!turns?.length) return memory;

  for (const turn of turns) {
    const usns = extractUsnsFromText(turn.content);
    if (usns.length > 0) {
      memory.lastUsn = usns[0];
    }
    if (turn.studentUsn) {
      memory.lastUsn = turn.studentUsn.toUpperCase();
    }
    if (turn.intent && VALID_INTENTS.has(turn.intent)) {
      memory.lastIntent = turn.intent as ChatIntent;
    }
  }

  const lastAssistant = [...turns].reverse().find((t) => t.role === "assistant");
  if (lastAssistant?.studentUsn) {
    memory.lastUsn = lastAssistant.studentUsn.toUpperCase();
  }
  if (lastAssistant?.intent && VALID_INTENTS.has(lastAssistant.intent)) {
    memory.lastIntent = lastAssistant.intent as ChatIntent;
  }

  return memory;
}

export function referencesPriorStudent(question: string): boolean {
  if (extractUsnsFromText(question).length > 0) return false;
  return PRONOUN_REF.test(question);
}

export function isBareFollowUp(question: string): boolean {
  const trimmed = question.trim();
  const normalized = trimmed.replace(/[!?.]+$/g, "").trim();
  if (BARE_FOLLOWUP.test(normalized)) return true;
  if (normalized.length <= 12 && /^(why|how|explain)$/i.test(normalized)) return true;
  if (/^why\s+(is|was|does|did|are|were)\b/i.test(trimmed) && trimmed.length < 40) return true;
  return false;
}

export function isContextualFollowUp(question: string): boolean {
  const lower = question.toLowerCase().trim();
  if (isBareFollowUp(question)) return true;
  if (referencesPriorStudent(question)) return true;

  if (extractUsnsFromText(question).length > 0) return false;

  if (/^(show|give|get)\s+(marks|scores|mapping|company|role|summary)\b/i.test(lower)) return true;
  if (/^(what|which)\s+(company|role|marks|score)\??$/i.test(lower)) return true;
  if (/^(marks|scores|performance|company|role)\??$/i.test(lower)) return true;
  if (/tell me more|more detail|expand|elaborate/i.test(lower)) return true;

  return false;
}

export type FollowUpResolution = {
  intent: ChatIntent;
  wantsDetail: boolean;
  expandPrevious: boolean;
};

export function resolveFollowUpIntent(
  question: string,
  memory: ConversationMemory,
): FollowUpResolution | null {
  if (!memory.lastUsn) return null;
  if (!isContextualFollowUp(question)) return null;

  const lower = question.toLowerCase().trim();

  if (/tell me more|more detail|expand|elaborate|go on|continue/i.test(lower)) {
    return {
      intent: memory.lastIntent ?? "student_summary",
      wantsDetail: true,
      expandPrevious: true,
    };
  }

  if (isBareFollowUp(question) || /^explain\b/i.test(lower)) {
    if (
      memory.lastIntent === "outcomes_mapping" ||
      memory.lastIntent === "outcomes_all" ||
      memory.lastIntent === "top_outcomes" ||
      memory.lastIntent === "student_summary"
    ) {
      return { intent: "outcomes_justification", wantsDetail: false, expandPrevious: false };
    }
    if (memory.lastIntent === "outcomes_po" || memory.lastIntent === "outcomes_po_why") {
      return { intent: "outcomes_po_why", wantsDetail: false, expandPrevious: false };
    }
    if (memory.lastIntent === "outcomes_co") {
      return { intent: "outcomes_co", wantsDetail: true, expandPrevious: false };
    }
    return { intent: "outcomes_justification", wantsDetail: false, expandPrevious: false };
  }

  if (
    /\b(marks|scores|grades|evaluation|review)\b/i.test(lower) ||
    /^show marks|^give marks/i.test(lower)
  ) {
    return { intent: "student_marks", wantsDetail: false, expandPrevious: false };
  }

  if (/\b(company|employer|organization|where.*work)\b/i.test(lower)) {
    return { intent: "internship_company", wantsDetail: false, expandPrevious: false };
  }

  if (/\b(role|position|job title|domain)\b/i.test(lower)) {
    return { intent: "internship_role", wantsDetail: false, expandPrevious: false };
  }

  if (/\b(performance|how did|how well)\b/i.test(lower)) {
    return { intent: "performance_analysis", wantsDetail: false, expandPrevious: false };
  }

  if (/\b(mapping|outcomes|co|po|pso)\b/i.test(lower)) {
    return { intent: "outcomes_mapping", wantsDetail: false, expandPrevious: false };
  }

  if (/\b(summarize|summary|internship)\b/i.test(lower)) {
    return { intent: "internship_summary", wantsDetail: false, expandPrevious: false };
  }

  return null;
}

/**
 * USN priority: explicit in question → conversation memory → dashboard hint
 */
export function resolveConversationUsn(
  question: string,
  memory: ConversationMemory,
  hintUsn?: string | null,
): string | null {
  const inQuestion = extractUsnsFromText(question);
  if (inQuestion.length > 0) return inQuestion[0];

  if (memory.lastUsn && (isContextualFollowUp(question) || referencesPriorStudent(question))) {
    return memory.lastUsn;
  }

  if (memory.lastUsn && isBareFollowUp(question)) {
    return memory.lastUsn;
  }

  if (hintUsn?.trim()) return hintUsn.trim().toUpperCase();

  if (memory.lastUsn && extractUsnsFromText(question).length === 0) {
    const lower = question.toLowerCase();
    if (
      lower.length < 50 &&
      /\b(marks|mapping|company|role|performance|summary|outcomes|why|explain)\b/i.test(lower)
    ) {
      return memory.lastUsn;
    }
  }

  return null;
}

export function userHistoryFromTurns(turns: ChatTurn[] | undefined): string[] {
  if (!turns?.length) return [];
  return turns.filter((t) => t.role === "user").map((t) => t.content).slice(-6);
}
