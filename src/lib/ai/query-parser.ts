import {
  classifyIntent,
  extractCoId,
  extractPoId,
  type ChatIntent,
} from "@/lib/ai/naive-bayes-intent";
import {
  buildConversationMemory,
  isBareFollowUp,
  isContextualFollowUp,
  referencesPriorStudent,
  resolveFollowUpIntent,
  type ChatTurn,
} from "@/lib/ai/conversation-memory";
import { matchIntentSynonyms, scoreIntentSynonyms, wantsDetailedResponse } from "@/lib/ai/intent-synonyms";
import { extractUsnsFromText } from "@/lib/ai/student-retrieval";

export type ParsedQuery = {
  intent: ChatIntent;
  confidence: number;
  questionUsns: string[];
  hintUsn: string | null;
  conversationUsn: string | null;
  coId: string | null;
  poId: string | null;
  intentSource: "rule" | "ml" | "history" | "synonym" | "conversation" | "fallback";
  isRecognizable: boolean;
  wantsDetail: boolean;
  expandPrevious: boolean;
};

const DOMAIN_SIGNAL =
  /\b(co\d|co\s*[1-4]|po\d|po\s*\d|pso|mapping|mapped|outcome|internship|compare|versus|\bvs\b|report|summar|analytic|metric|company|employer|stipend|salary|role|position|why|explain|justify|justification|sdg|sustainab|technolog|tensor|pytorch|mapped|student|intern|usn|marks|score|perform|evaluation|grade|him|her)\b/i;

const THIS_STUDENT =
  /\b(this|selected|current)\s+(student|intern|internship)\b/i;

const GREETING_ONLY = /^(hi|hello|hey|help|thanks|thank you)[\s!.?]*$/i;

function isGibberishText(question: string): boolean {
  const t = question.trim();
  if (t.length < 2) return true;
  if (/^[^a-zA-Z0-9\s]*$/.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 1 && words[0].length <= 3 && !/\dDS/i.test(words[0])) {
    if (isBareFollowUp(t)) return false;
    return true;
  }
  return false;
}

function isMappingQuery(lower: string): boolean {
  if (matchIntentSynonyms(lower, "outcomes_all") && wantsDetailedResponse(lower)) return false;
  if (matchIntentSynonyms(lower, "outcomes_mapping")) return true;
  if (/\b(mapping|mapped)\b/.test(lower) && /\b(outcome|co|po|pso)\b/.test(lower)) return true;
  if (/\boutcomes?\b/.test(lower) && /\b(map|mapped|mapping)\b/.test(lower)) return true;
  if (/\bco\b/.test(lower) && /\b(po|pso)\b/.test(lower) && !/\bmark|score|stipend\b/.test(lower)) {
    return true;
  }
  return false;
}

function isMarksQuery(lower: string): boolean {
  if (/\b(mapping|outcome)\b/.test(lower) && !/\b(mark|score|grade|evaluation)\b/.test(lower)) {
    if (!/\bco\b|\bpo\b|\bpso\b/.test(lower)) {
      // ok
    } else if (!/\bmark|score|grade|evaluation\b/.test(lower)) {
      return false;
    }
  }
  return matchIntentSynonyms(lower, "student_marks") || /\b(marks|scores|grades)\b/.test(lower);
}

function detectIntentByRules(question: string, questionUsns: string[]): ChatIntent | null {
  const lower = question.toLowerCase().trim();

  if (questionUsns.length >= 2) return "compare_students";
  if (/\bcompare\b|\bversus\b|\bvs\b/.test(lower)) return "compare_students";

  if (GREETING_ONLY.test(lower)) return "greeting";

  if (
    /\bwhy\b/i.test(lower) &&
    (/\bpo\s*\d{1,2}\b/i.test(lower) ||
      /\bpo\d{1,2}\b/i.test(lower) ||
      (/\bmap|mapped|mapping\b/i.test(lower) && /\bpo\b/i.test(lower)))
  ) {
    return "outcomes_po_why";
  }

  if (isMarksQuery(lower) && !isBareFollowUp(question)) return "student_marks";

  if (matchIntentSynonyms(lower, "performance_analysis") || /\bhow did\b.*\bperform\b/.test(lower)) {
    return "performance_analysis";
  }

  if (matchIntentSynonyms(lower, "top_outcomes")) return "top_outcomes";

  if (matchIntentSynonyms(lower, "internship_summary")) return "internship_summary";

  if (matchIntentSynonyms(lower, "student_summary") && !isMappingQuery(lower) && !isMarksQuery(lower)) {
    return "student_summary";
  }

  if (/\b(explain|describe|detail)\b/i.test(lower) && /\bco\s*[1-4]\b/i.test(lower)) {
    return "outcomes_co";
  }

  if (matchIntentSynonyms(lower, "outcomes_justification")) return "outcomes_justification";

  if (wantsDetailedResponse(lower) && isMappingQuery(lower)) return "outcomes_all";

  if (isMappingQuery(lower)) return "outcomes_mapping";

  if (/\b(summar|summary)\b/i.test(lower) && /\b(report|internship)\b/i.test(lower)) {
    return "report_summary";
  }
  if (/\b(technolog|tech stack|tools?|tensorflow|pytorch|keras)\b/i.test(lower) && /\bco\s*[1-4]\b/i.test(lower)) {
    return "technologies_co";
  }
  if (/\bsdg\b|\bsustainab/i.test(lower)) return "sdg_alignment";
  if (/\b(analytic|statistics|metrics)\b/i.test(lower) && !isMarksQuery(lower)) {
    return "internship_analytics";
  }
  if (/\bjustif|\brationale\b/i.test(lower)) return "outcomes_justification";
  if (/\bpso\b/i.test(lower) && !/\bpo\s*\d/i.test(lower)) return "outcomes_pso";
  if (/\bpo\s*\d{1,2}\b/i.test(lower) && !/\bwhy\b/i.test(lower)) return "outcomes_po";
  if (matchIntentSynonyms(lower, "internship_company") || /\bcompany\b|\bemployer\b/i.test(lower)) {
    return "internship_company";
  }
  if (/\bstipend\b|\bsalary\b/i.test(lower)) return "internship_stipend";
  if (matchIntentSynonyms(lower, "internship_role") || /\b(role|position|job)\b/i.test(lower)) {
    return "internship_role";
  }

  if (questionUsns.length === 1 && lower.length < 80 && !isGibberishText(question)) {
    if (/\babout\b/i.test(lower) || /\btell me\b/i.test(lower)) return "student_summary";
  }

  return null;
}

export function intentRequiresStudent(intent: ChatIntent): boolean {
  return intent !== "greeting" && intent !== "invalid_query";
}

export function assessRecognizability(
  question: string,
  parsed: Omit<ParsedQuery, "isRecognizable">,
): boolean {
  const q = question.trim();
  if (parsed.intent === "greeting" || parsed.intent === "invalid_query") {
    return parsed.intent === "greeting";
  }
  if (isGibberishText(q) && !isBareFollowUp(q)) return false;
  if (parsed.questionUsns.length > 0) return true;
  if (parsed.conversationUsn) return true;
  if (parsed.intentSource === "conversation") return true;
  if (parsed.intentSource === "rule" || parsed.intentSource === "synonym") return true;
  if (DOMAIN_SIGNAL.test(q)) return true;
  if (parsed.hintUsn && THIS_STUDENT.test(q)) return true;
  if (parsed.intentSource === "history") return true;
  if (parsed.intentSource === "ml" && parsed.confidence >= 0.4 && DOMAIN_SIGNAL.test(q)) {
    return true;
  }
  if (
    parsed.hintUsn &&
    (THIS_STUDENT.test(q) ||
      referencesPriorStudent(q) ||
      [
        "outcomes_mapping",
        "outcomes_all",
        "report_summary",
        "outcomes_po_why",
        "outcomes_co",
        "outcomes_justification",
        "student_marks",
        "performance_analysis",
        "student_summary",
        "internship_summary",
        "top_outcomes",
        "internship_company",
        "internship_role",
      ].includes(parsed.intent))
  ) {
    return true;
  }
  return false;
}

export function parseUserQuery(
  question: string,
  options?: { hintUsn?: string; history?: string[]; turns?: ChatTurn[] },
): ParsedQuery {
  const trimmed = question.trim();
  const questionUsns = extractUsnsFromText(trimmed);
  const memory = buildConversationMemory(options?.turns, options?.hintUsn);
  const followUp = resolveFollowUpIntent(trimmed, memory);
  const ruleIntent = detectIntentByRules(trimmed, questionUsns);
  const ml = classifyIntent(trimmed);
  const synonymScores = scoreIntentSynonyms(trimmed);
  let wantsDetail = wantsDetailedResponse(trimmed);
  let expandPrevious = false;

  const conversationUsn =
    questionUsns.length > 0
      ? questionUsns[0]
      : memory.lastUsn &&
          (isContextualFollowUp(trimmed) ||
            referencesPriorStudent(trimmed) ||
            isBareFollowUp(trimmed))
        ? memory.lastUsn
        : null;

  let intent: ChatIntent;
  let intentSource: ParsedQuery["intentSource"];
  let confidence = ml.confidence;

  if (isGibberishText(trimmed) && !followUp) {
    intent = "invalid_query";
    intentSource = "fallback";
    confidence = 0;
  } else if (followUp) {
    intent = followUp.intent;
    intentSource = "conversation";
    confidence = 0.92;
    wantsDetail = wantsDetail || followUp.wantsDetail;
    expandPrevious = followUp.expandPrevious;
  } else if (ruleIntent) {
    intent = ruleIntent;
    intentSource = "rule";
    confidence = Math.max(confidence, 0.88);
  } else if (synonymScores.length > 0 && synonymScores[0].score >= 2) {
    intent = synonymScores[0].intent;
    intentSource = "synonym";
    confidence = Math.min(0.92, 0.55 + synonymScores[0].score * 0.08);
  } else if (ml.confidence >= 0.42 && DOMAIN_SIGNAL.test(trimmed)) {
    intent = ml.intent;
    intentSource = "ml";
  } else if (options?.hintUsn && THIS_STUDENT.test(trimmed)) {
    if (isMarksQuery(trimmed.toLowerCase())) {
      intent = "student_marks";
    } else if (isMappingQuery(trimmed.toLowerCase())) {
      intent = "outcomes_mapping";
    } else {
      intent = "student_summary";
    }
    intentSource = "rule";
    confidence = 0.78;
  } else if (referencesPriorStudent(trimmed) && memory.lastUsn) {
    intent = isMarksQuery(trimmed.toLowerCase()) ? "student_marks" : "student_summary";
    intentSource = "conversation";
    confidence = 0.85;
  } else if (questionUsns.length === 1 && trimmed.split(/\s+/).length <= 12) {
    intent = "student_summary";
    intentSource = "rule";
    confidence = 0.55;
  } else {
    intent = "invalid_query";
    intentSource = "fallback";
    confidence = ml.confidence;
  }

  const draft: Omit<ParsedQuery, "isRecognizable"> = {
    intent,
    confidence,
    questionUsns,
    hintUsn: options?.hintUsn?.trim().toUpperCase() ?? null,
    conversationUsn,
    coId: extractCoId(trimmed) ?? memory.lastCoId,
    poId: extractPoId(trimmed),
    intentSource,
    wantsDetail,
    expandPrevious,
  };

  const isRecognizable = assessRecognizability(trimmed, draft);
  if (!isRecognizable && intent !== "greeting") {
    return { ...draft, intent: "invalid_query", intentSource: "fallback", isRecognizable: false };
  }

  return { ...draft, isRecognizable: true };
}

export function resolvePrimaryUsn(parsed: ParsedQuery): string | null {
  if (parsed.questionUsns.length > 0) {
    return parsed.questionUsns[0];
  }
  if (parsed.conversationUsn) {
    return parsed.conversationUsn;
  }
  if (parsed.hintUsn && parsed.isRecognizable && intentRequiresStudent(parsed.intent)) {
    return parsed.hintUsn;
  }
  return null;
}

export function resolveCompareUsns(parsed: ParsedQuery): string[] {
  if (parsed.questionUsns.length >= 2) {
    return parsed.questionUsns.slice(0, 2);
  }
  if (
    parsed.questionUsns.length === 1 &&
    parsed.hintUsn &&
    parsed.questionUsns[0] !== parsed.hintUsn
  ) {
    return [parsed.questionUsns[0], parsed.hintUsn];
  }
  if (parsed.intent === "compare_students" && parsed.hintUsn && parsed.questionUsns.length === 0) {
    return [];
  }
  return parsed.questionUsns;
}

export type { ChatTurn };
