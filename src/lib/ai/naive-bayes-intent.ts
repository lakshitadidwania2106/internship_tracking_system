import { tokenize } from "@/lib/ai/text-utils";

export type ChatIntent =
  | "invalid_query"
  | "greeting"
  | "outcomes_mapping"
  | "outcomes_all"
  | "outcomes_co"
  | "outcomes_po"
  | "outcomes_pso"
  | "outcomes_po_why"
  | "outcomes_justification"
  | "compare_students"
  | "sdg_alignment"
  | "internship_analytics"
  | "report_summary"
  | "technologies_co"
  | "internship_company"
  | "internship_stipend"
  | "internship_role"
  | "student_summary";

type TrainingExample = { text: string; intent: ChatIntent };

const TRAINING_DATA: TrainingExample[] = [
  { text: "show co po pso mapping for student", intent: "outcomes_all" },
  { text: "what are the course outcomes and program outcomes", intent: "outcomes_all" },
  { text: "list all co po pso for this intern", intent: "outcomes_all" },
  { text: "outcome mapping details", intent: "outcomes_all" },
  { text: "give me co po pso snapshot", intent: "outcomes_all" },
  { text: "which co po pso apply to the student", intent: "outcomes_all" },
  { text: "what is co1 for student", intent: "outcomes_co" },
  { text: "course outcome co2 mapping", intent: "outcomes_co" },
  { text: "explain co3 for intern", intent: "outcomes_co" },
  { text: "co4 po pso alignment", intent: "outcomes_co" },
  { text: "which course outcomes are relevant", intent: "outcomes_co" },
  { text: "relevant pos for student", intent: "outcomes_po" },
  { text: "what program outcomes po1 po2", intent: "outcomes_po" },
  { text: "list po mapping internship", intent: "outcomes_po" },
  { text: "student relevant program outcomes", intent: "outcomes_po" },
  { text: "which pos does this student meet", intent: "outcomes_po" },
  { text: "relevant psos for student", intent: "outcomes_pso" },
  { text: "what pso1 pso2 pso3 apply", intent: "outcomes_pso" },
  { text: "program specific outcomes pso", intent: "outcomes_pso" },
  { text: "pso mapping for intern", intent: "outcomes_pso" },
  { text: "justify co po mapping", intent: "outcomes_justification" },
  { text: "co po pso justification rationale", intent: "outcomes_justification" },
  { text: "why is co1 mapped to po5", intent: "outcomes_justification" },
  { text: "explain mapping justification", intent: "outcomes_justification" },
  { text: "which company did student intern", intent: "internship_company" },
  { text: "internship company name", intent: "internship_company" },
  { text: "where did student work", intent: "internship_company" },
  { text: "organization employer", intent: "internship_company" },
  { text: "stipend salary pay", intent: "internship_stipend" },
  { text: "how much stipend student get", intent: "internship_stipend" },
  { text: "internship compensation", intent: "internship_stipend" },
  { text: "role title domain intern", intent: "internship_role" },
  { text: "what position student held", intent: "internship_role" },
  { text: "job profile internship", intent: "internship_role" },
  { text: "student profile summary overview", intent: "student_summary" },
  { text: "tell me about this student intern", intent: "student_summary" },
  { text: "internship details for student", intent: "student_summary" },
  { text: "why is po5 strongly mapped", intent: "outcomes_po_why" },
  { text: "explain po5 mapping for student", intent: "outcomes_po_why" },
  { text: "compare two students internship", intent: "compare_students" },
  { text: "compare student outcomes", intent: "compare_students" },
  { text: "sdg sustainability alignment", intent: "sdg_alignment" },
  { text: "show sustainability sdg", intent: "sdg_alignment" },
  { text: "internship analytics statistics", intent: "internship_analytics" },
  { text: "show analytics for intern", intent: "internship_analytics" },
  { text: "summarize internship report", intent: "report_summary" },
  { text: "report summary for student", intent: "report_summary" },
  { text: "which technologies influenced co1", intent: "technologies_co" },
  { text: "tech stack tools used internship", intent: "technologies_co" },
];

const VOCAB = new Set<string>();
const INTENT_DOC_COUNT = new Map<ChatIntent, number>();
const TOKEN_COUNT_BY_INTENT = new Map<ChatIntent, Map<string, number>>();
const TOTAL_TOKENS_BY_INTENT = new Map<ChatIntent, number>();

for (const example of TRAINING_DATA) {
  const tokens = tokenize(example.text);
  INTENT_DOC_COUNT.set(example.intent, (INTENT_DOC_COUNT.get(example.intent) ?? 0) + 1);
  const bag = TOKEN_COUNT_BY_INTENT.get(example.intent) ?? new Map<string, number>();
  for (const token of tokens) {
    VOCAB.add(token);
    bag.set(token, (bag.get(token) ?? 0) + 1);
    TOTAL_TOKENS_BY_INTENT.set(example.intent, (TOTAL_TOKENS_BY_INTENT.get(example.intent) ?? 0) + 1);
  }
  TOKEN_COUNT_BY_INTENT.set(example.intent, bag);
}

const TOTAL_DOCS = TRAINING_DATA.length;
const VOCAB_SIZE = VOCAB.size || 1;
const INTENTS = [...INTENT_DOC_COUNT.keys()];

function logPrior(intent: ChatIntent): number {
  const docCount = INTENT_DOC_COUNT.get(intent) ?? 0;
  return Math.log((docCount + 1) / (TOTAL_DOCS + INTENTS.length));
}

function logLikelihood(intent: ChatIntent, token: string): number {
  const bag = TOKEN_COUNT_BY_INTENT.get(intent) ?? new Map<string, number>();
  const total = TOTAL_TOKENS_BY_INTENT.get(intent) ?? 0;
  const count = bag.get(token) ?? 0;
  return Math.log((count + 1) / (total + VOCAB_SIZE));
}

export function classifyIntent(question: string): { intent: ChatIntent; confidence: number } {
  const tokens = tokenize(question);
  if (tokens.length === 0) {
    return { intent: "student_summary", confidence: 0 };
  }

  let bestIntent: ChatIntent = "student_summary";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const intent of INTENTS) {
    let score = logPrior(intent);
    for (const token of tokens) {
      score += logLikelihood(intent, token);
    }
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  const scores = INTENTS.map((intent) => {
    let score = logPrior(intent);
    for (const token of tokens) {
      score += logLikelihood(intent, token);
    }
    return Math.exp(score);
  });
  const sum = scores.reduce((a, b) => a + b, 0);
  const confidence = sum > 0 ? Math.max(...scores) / sum : 0;

  return { intent: bestIntent, confidence };
}

/** Rule boosts when keywords are unambiguous. */
export function refineIntent(question: string, mlIntent: ChatIntent): ChatIntent {
  const lower = question.toLowerCase();

  if (/\bcompare\b|\bvs\b|\bversus\b/.test(lower)) {
    return "compare_students";
  }
  if (/\bwhy\b.*\bpo\s*\d{1,2}\b|\bpo\s*\d{1,2}\b.*\bwhy\b|\bwhy\b.*\bpo\d/.test(lower)) {
    return "outcomes_po_why";
  }
  if (/\bsdg\b|\bsustainab/.test(lower)) {
    return "sdg_alignment";
  }
  if (/\banalytic|\bstatistic|\bmetric/.test(lower)) {
    return "internship_analytics";
  }
  if (/\bsummar|\breport\b/.test(lower) && !/\bco\b/.test(lower)) {
    return "report_summary";
  }
  if (/\btechnolog|\btools?\b|\bstack\b|\btensorflow\b|\bpytorch\b/.test(lower) && /\bco\s*[1-4]\b/.test(lower)) {
    return "technologies_co";
  }
  if (/\bco\s*[1-4]\b|\bcourse\s+outcome/.test(lower)) {
    return "outcomes_co";
  }
  if (/\bjustif|rationale|why\s+.*\s+map/.test(lower)) {
    return "outcomes_justification";
  }
  if (/\bpso\b/.test(lower) && !/\bpo\b/.test(lower)) {
    return "outcomes_pso";
  }
  if (/\bpo\b/.test(lower) && !/\bpso\b/.test(lower)) {
    return "outcomes_po";
  }
  if (/\bco\b/.test(lower) && /\b(po|pso)\b/.test(lower)) {
    return "outcomes_all";
  }
  if (lower.includes("company") || lower.includes("employer")) {
    return "internship_company";
  }
  if (lower.includes("stipend") || lower.includes("salary")) {
    return "internship_stipend";
  }
  if (lower.includes("role") || lower.includes("domain") || lower.includes("position")) {
    return "internship_role";
  }

  return mlIntent;
}

export function extractCoId(question: string): string | null {
  const match = question.match(/\bco\s*([1-4])\b/i);
  return match ? `CO${match[1]}` : null;
}

export function extractPoId(question: string): string | null {
  const spaced = question.match(/\bpo\s*(\d{1,2})\b/i);
  if (spaced) return `PO${spaced[1]}`;
  const compact = question.match(/\bpo(\d{1,2})\b/i);
  if (compact) return `PO${compact[1]}`;
  if (/\bwhy\b/i.test(question) && /\bpo\b/i.test(question) && /\bmap/i.test(question)) {
    return "PO5";
  }
  return null;
}
