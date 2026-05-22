import {
  classifyIntent,
  extractCoId,
  extractPoId,
  type ChatIntent,
} from "@/lib/ai/naive-bayes-intent";
import { extractUsnsFromText } from "@/lib/ai/student-retrieval";

export type ParsedQuery = {
  intent: ChatIntent;
  confidence: number;
  questionUsns: string[];
  hintUsn: string | null;
  coId: string | null;
  poId: string | null;
  intentSource: "rule" | "ml" | "history" | "fallback";
  isRecognizable: boolean;
};

const DOMAIN_SIGNAL =
  /\b(co\d|co\s*[1-4]|po\d|po\s*\d|pso|mapping|outcome|internship|compare|versus|\bvs\b|report|summar|analytic|metric|company|employer|stipend|salary|role|position|why|explain|justify|justification|sdg|sustainab|technolog|tensor|pytorch|mapped|student|intern|usn)\b/i;

const THIS_STUDENT =
  /\b(this|selected|current)\s+(student|intern|internship)\b/i;

const GREETING_ONLY = /^(hi|hello|hey|help|thanks|thank you)[\s!.?]*$/i;

function isGibberishText(question: string): boolean {
  const t = question.trim();
  if (t.length < 2) return true;
  if (/^[^a-zA-Z0-9\s]*$/.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 1 && words[0].length <= 3 && !/\dDS/i.test(words[0])) return true;
  return false;
}

/**
 * Rule-first intent (order = priority). First match wins.
 */
function detectIntentByRules(question: string, questionUsns: string[]): ChatIntent | null {
  const lower = question.toLowerCase().trim();

  if (questionUsns.length >= 2) {
    return "compare_students";
  }
  if (/\bcompare\b|\bversus\b|\bvs\b/.test(lower)) {
    return "compare_students";
  }

  if (
    /\bwhy\b/i.test(lower) &&
    (/\bpo\s*\d{1,2}\b/i.test(lower) ||
      /\bpo\d{1,2}\b/i.test(lower) ||
      (/\bmap|mapped|mapping\b/i.test(lower) && /\bpo\b/i.test(lower)))
  ) {
    return "outcomes_po_why";
  }

  if (/\b(explain|describe|detail)\b/i.test(lower) && /\bco\s*[1-4]\b/i.test(lower)) {
    return "outcomes_co";
  }
  if (/\bco\s*[1-4]\b/i.test(lower) && /\bexplain\b/i.test(lower)) {
    return "outcomes_co";
  }

  if (/\b(summar|summary)\b/i.test(lower) && /\b(report|internship)\b/i.test(lower)) {
    return "report_summary";
  }
  if (/\b(technolog|tech stack|tools?|tensorflow|pytorch|keras)\b/i.test(lower) && /\bco\s*[1-4]\b/i.test(lower)) {
    return "technologies_co";
  }
  if (/\bsdg\b|\bsustainab/i.test(lower)) {
    return "sdg_alignment";
  }
  if (/\b(analytic|statistics|metrics|evaluation)\b/i.test(lower)) {
    return "internship_analytics";
  }
  if (/\bjustif|\brationale\b/i.test(lower)) {
    return "outcomes_justification";
  }
  if (/\bwhy\b/i.test(lower) && /\b(map|mapped|mapping)\b/i.test(lower) && !/\bco\s*[1-4]\b/i.test(lower)) {
    return "outcomes_justification";
  }
  if (/\bpso\b/i.test(lower) && !/\bpo\s*\d/i.test(lower)) {
    return "outcomes_pso";
  }
  if (/\bpo\s*\d{1,2}\b/i.test(lower) && !/\bwhy\b/i.test(lower)) {
    return "outcomes_po";
  }
  if (/\b(show|list|get|give)\b/i.test(lower) && /\bmapping\b/i.test(lower)) {
    return "outcomes_mapping";
  }
  if (/\bco\b/i.test(lower) && /\b(po|pso)\b/i.test(lower)) {
    return "outcomes_all";
  }
  if (/\bcompany\b|\bemployer\b/i.test(lower)) {
    return "internship_company";
  }
  if (/\bstipend\b|\bsalary\b/i.test(lower)) {
    return "internship_stipend";
  }
  if (/\b(role|position|job)\b/i.test(lower)) {
    return "internship_role";
  }
  if (GREETING_ONLY.test(lower)) {
    return "greeting";
  }

  return null;
}

function enrichEntitiesFromHistory(
  question: string,
  history: string[] | undefined,
): { coId: string | null; poId: string | null; intent?: ChatIntent } {
  if (!history?.length) return { coId: null, poId: null };

  const qLower = question.toLowerCase().trim();
  const isShortFollowUp =
    qLower.length < 50 ||
    /^(why|how|explain|more|details?|and|ok|yes|what about)\b/i.test(qLower);

  if (!isShortFollowUp) return { coId: null, poId: null };

  const combined = [...history, question].join(" ");
  const combinedLower = combined.toLowerCase();

  let intent: ChatIntent | undefined;
  if (/\bcompare\b/i.test(combinedLower) || extractUsnsFromText(combined).length >= 2) {
    intent = "compare_students";
  } else if (
    /\bwhy\b/i.test(combinedLower) &&
    (/\bpo\s*\d/i.test(combinedLower) || /\bpo\d/i.test(combinedLower))
  ) {
    intent = "outcomes_po_why";
  } else if (extractCoId(combined)) {
    intent = "outcomes_co";
  } else if (/\bmapping\b/i.test(combinedLower)) {
    intent = "outcomes_mapping";
  }

  return {
    coId: extractCoId(question) ?? extractCoId(combined),
    poId: extractPoId(question) ?? extractPoId(combined),
    intent,
  };
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
  if (isGibberishText(q)) return false;
  if (parsed.questionUsns.length > 0) return true;
  if (parsed.intentSource === "rule") return true;
  if (DOMAIN_SIGNAL.test(q)) return true;
  if (parsed.hintUsn && THIS_STUDENT.test(q)) return true;
  if (parsed.intentSource === "history" && parsed.intent !== "student_summary") {
    return true;
  }
  if (
    parsed.intentSource === "ml" &&
    parsed.confidence >= 0.45 &&
    DOMAIN_SIGNAL.test(q) &&
    parsed.intent !== "student_summary"
  ) {
    return true;
  }
  if (
    parsed.hintUsn &&
    THIS_STUDENT.test(q) &&
    ["outcomes_mapping", "outcomes_all", "report_summary", "outcomes_po_why", "outcomes_co"].includes(
      parsed.intent,
    )
  ) {
    return true;
  }
  return false;
}

export function parseUserQuery(
  question: string,
  options?: { hintUsn?: string; history?: string[] },
): ParsedQuery {
  const trimmed = question.trim();
  const questionUsns = extractUsnsFromText(trimmed);
  const ruleIntent = detectIntentByRules(trimmed, questionUsns);
  const ml = classifyIntent(trimmed);
  const historyEnrich = enrichEntitiesFromHistory(trimmed, options?.history);

  let intent: ChatIntent;
  let intentSource: ParsedQuery["intentSource"];
  let confidence = ml.confidence;

  if (isGibberishText(trimmed)) {
    intent = "invalid_query";
    intentSource = "fallback";
    confidence = 0;
  } else if (ruleIntent) {
    intent = ruleIntent;
    intentSource = "rule";
    confidence = Math.max(confidence, 0.85);
  } else if (historyEnrich.intent && trimmed.length < 55) {
    intent = historyEnrich.intent;
    intentSource = "history";
    confidence = Math.max(confidence, 0.6);
  } else if (GREETING_ONLY.test(trimmed.toLowerCase())) {
    intent = "greeting";
    intentSource = "rule";
    confidence = 1;
  } else if (ml.confidence >= 0.5 && DOMAIN_SIGNAL.test(trimmed) && ml.intent !== "student_summary") {
    intent = ml.intent;
    intentSource = "ml";
  } else if (options?.hintUsn && THIS_STUDENT.test(trimmed) && DOMAIN_SIGNAL.test(trimmed)) {
    intent = "outcomes_mapping";
    intentSource = "rule";
    confidence = 0.75;
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
    coId: extractCoId(trimmed) ?? historyEnrich.coId,
    poId: extractPoId(trimmed) ?? historyEnrich.poId,
    intentSource,
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
