// ─── Tokenization ────────────────────────────────────────────────────────────

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

// ─── Outcome Code Parser ──────────────────────────────────────────────────────

/** Parse PO1 / PSO2 style codes from Excel-style strings e.g. "PO1,2,3" or "PSO1, PSO2". */
export function parseOutcomeCodes(raw: string | null | undefined, prefix: "PO" | "PSO"): Set<string> {
  const codes = new Set<string>();
  if (!raw?.trim()) {
    return codes;
  }

  const explicit = raw.matchAll(new RegExp(`${prefix}\\s*(\\d{1,2})`, "gi"));
  for (const match of explicit) {
    codes.add(`${prefix}${match[1]}`);
  }

  if (codes.size > 0) {
    return codes;
  }

  const compact = raw.match(new RegExp(`${prefix}\\s*([\\d,\\s]+)`, "i"));
  if (compact?.[1]) {
    for (const digit of compact[1].matchAll(/\d{1,2}/g)) {
      codes.add(`${prefix}${digit[0]}`);
    }
  }

  return codes;
}

export function formatOutcomeSet(codes: Set<string>, fallback = "Not recorded"): string {
  if (codes.size === 0) {
    return fallback;
  }
  return [...codes].sort(outcomeSortKey).join(", ");
}

function outcomeSortKey(code: string): number {
  const match = code.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

// ─── NLP Domain Keyword Banks ─────────────────────────────────────────────────

/** Keyword banks per domain. Scoring: +3 exact phrase, +2 partial, +1 single word. */
const DOMAIN_KEYWORDS: Record<string, { strong: string[]; moderate: string[]; weak: string[] }> = {
  aiml: {
    strong: [
      "machine learning", "deep learning", "neural network", "computer vision", "natural language processing",
      "nlp", "llm", "large language model", "generative ai", "reinforcement learning",
      "tensorflow", "pytorch", "keras", "scikit-learn", "sklearn", "xgboost",
      "yolo", "bert", "gpt", "transformer", "cnn", "rnn", "lstm",
      "object detection", "image classification", "sentiment analysis",
    ],
    moderate: [
      "ml", "ai", "model training", "prediction", "classification", "regression",
      "clustering", "feature engineering", "data pipeline", "data science",
      "model", "algorithm", "inference", "embedding", "vector", "chatbot",
    ],
    weak: [
      "python", "data", "analysis", "analytics", "artificial intelligence",
      "intelligence", "automation", "statistical", "mathematical",
    ],
  },
  research: {
    strong: [
      "literature review", "research paper", "systematic review", "state of the art",
      "research gap", "hypothesis", "methodology", "experiment design",
      "publication", "citation", "research findings",
    ],
    moderate: [
      "research", "analysis", "investigation", "study", "survey",
      "benchmark", "evaluation", "experiment", "dataset", "validation",
    ],
    weak: [
      "report", "document", "review", "literature", "academic",
      "findings", "insights", "exploration",
    ],
  },
  teamwork: {
    strong: [
      "agile methodology", "scrum framework", "cross-functional team", "team collaboration",
      "project management", "sprint planning", "stakeholder management",
    ],
    moderate: [
      "team", "collaboration", "agile", "scrum", "jira", "confluence",
      "leadership", "mentoring", "peer review", "code review",
      "stand-up", "sprint", "backlog",
    ],
    weak: [
      "group", "together", "coordinate", "communicate", "work with",
      "meeting", "discussion", "coordinate",
    ],
  },
  ethics: {
    strong: [
      "responsible ai", "data privacy", "gdpr compliance", "ethical guidelines",
      "bias detection", "fairness", "model interpretability", "explainable ai",
      "data governance", "information security",
    ],
    moderate: [
      "ethics", "privacy", "security", "compliance", "integrity",
      "responsible", "transparent", "accountability", "bias",
    ],
    weak: [
      "safe", "reliable", "trust", "honest", "fair", "license",
      "permission", "consent", "protection",
    ],
  },
  sustainability: {
    strong: [
      "sustainable development goal", "sdg", "carbon footprint", "green technology",
      "renewable energy", "environmental impact", "climate change",
      "circular economy", "net zero", "carbon neutral",
    ],
    moderate: [
      "sustainability", "sustainable", "green", "environment", "energy efficient",
      "resource optimization", "waste reduction", "societal impact",
    ],
    weak: [
      "impact", "society", "social", "community", "welfare",
      "future", "long-term", "ecosystem",
    ],
  },
  cloud: {
    strong: [
      "amazon web services", "aws", "microsoft azure", "google cloud platform", "gcp",
      "kubernetes", "docker", "containerization", "microservices", "serverless",
      "ci/cd pipeline", "devops", "mlops", "infrastructure as code",
    ],
    moderate: [
      "cloud", "deployment", "deploy", "container", "pipeline", "api",
      "rest api", "flask", "fastapi", "django", "node.js",
      "docker", "github actions", "jenkins", "terraform",
    ],
    weak: [
      "server", "hosting", "web", "application", "service",
      "scalable", "distributed", "infrastructure",
    ],
  },
  communication: {
    strong: [
      "technical presentation", "client presentation", "written report",
      "documentation", "technical writing", "stakeholder communication",
    ],
    moderate: [
      "presentation", "report", "communication", "documentation",
      "explained", "presented", "demonstrated", "articulated",
    ],
    weak: [
      "discuss", "share", "inform", "update", "brief",
      "email", "meeting", "talk",
    ],
  },
};

// ─── NLP Feature Scores ───────────────────────────────────────────────────────

export type NlpDomainScores = {
  aiml: number;
  research: number;
  teamwork: number;
  ethics: number;
  sustainability: number;
  cloud: number;
  communication: number;
  /** Combined confidence 0–1 */
  confidence: number;
};

/**
 * Score a text against all NLP domains.
 * Returns a score object with values in range [0, 10].
 * Also returns detected keywords per domain.
 */
export type NlpAnalysisResult = {
  scores: NlpDomainScores;
  detectedKeywords: Record<string, string[]>;
};

export function analyzeText(text: string): NlpAnalysisResult {
  const lower = text.toLowerCase();
  const detectedKeywords: Record<string, string[]> = {};
  const rawScores: Record<string, number> = {};

  for (const [domain, banks] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    const found: string[] = [];

    for (const phrase of banks.strong) {
      if (lower.includes(phrase)) {
        score += 3;
        found.push(phrase);
      }
    }
    for (const phrase of banks.moderate) {
      if (lower.includes(phrase)) {
        score += 2;
        found.push(phrase);
      }
    }
    for (const phrase of banks.weak) {
      if (lower.includes(phrase)) {
        score += 1;
        found.push(phrase);
      }
    }

    // Cap at 10
    rawScores[domain] = Math.min(score, 10);
    detectedKeywords[domain] = [...new Set(found)];
  }

  // Compute overall confidence as mean of top-3 domain scores / 10
  const sorted = Object.values(rawScores).sort((a, b) => b - a);
  const top3Mean = (sorted.slice(0, 3).reduce((s, v) => s + v, 0)) / (3 * 10);
  const confidence = Math.min(top3Mean, 1);

  return {
    scores: {
      aiml: rawScores.aiml ?? 0,
      research: rawScores.research ?? 0,
      teamwork: rawScores.teamwork ?? 0,
      ethics: rawScores.ethics ?? 0,
      sustainability: rawScores.sustainability ?? 0,
      cloud: rawScores.cloud ?? 0,
      communication: rawScores.communication ?? 0,
      confidence,
    },
    detectedKeywords,
  };
}

/**
 * Analyze combined text from a student's role title, company name,
 * and any available summary/report text.
 */
export function analyzeStudentProfile(params: {
  roleTitle: string;
  companyName: string;
  coMappingSummary?: string | null;
  justification?: string | null;
  sourceRowRawJson?: string | null;
}): NlpAnalysisResult {
  const combinedText = [
    params.roleTitle,
    params.companyName,
    params.coMappingSummary ?? "",
    params.justification ?? "",
    extractInternshipTitleFromJson(params.sourceRowRawJson),
  ]
    .filter(Boolean)
    .join(" ");

  return analyzeText(combinedText);
}

function extractInternshipTitleFromJson(rawJson?: string | null): string {
  if (!rawJson) return "";
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    const title =
      parsed["INTERNSHIP TITLE"] ??
      parsed["Internship Title"] ??
      (parsed.evaluation as Record<string, unknown> | undefined)?.["internshipTitle"];
    return typeof title === "string" ? title : "";
  } catch {
    return "";
  }
}

/**
 * Derive a default set of POs based on NLP scores when no ExcelMapping exists.
 * Used as fallback when OutcomeMapping is null/empty.
 */
export function derivePOsFromNlp(scores: NlpDomainScores): Set<string> {
  const pos = new Set<string>();

  // PO1 (Engineering Knowledge) — always relevant for any technical intern
  pos.add("PO1");

  // PO2 (Problem Analysis) — technical + research work
  if (scores.aiml >= 2 || scores.research >= 2) pos.add("PO2");

  // PO3 (Design/Development) — any implementation work
  if (scores.aiml >= 2 || scores.cloud >= 2) pos.add("PO3");

  // PO4 (Investigation) — research-heavy
  if (scores.research >= 3) pos.add("PO4");

  // PO5 (Modern Tool Usage) — AI/ML tools or cloud tools
  if (scores.aiml >= 2 || scores.cloud >= 2) pos.add("PO5");

  // PO6 (Engineer and Society) — sustainability mentions
  if (scores.sustainability >= 2) pos.add("PO6");

  // PO7 (Environment) — strong sustainability
  if (scores.sustainability >= 4) pos.add("PO7");

  // PO8 (Ethics) — ethics-related work
  if (scores.ethics >= 2) pos.add("PO8");

  // PO9 (Team Work) — team mentions
  if (scores.teamwork >= 2) pos.add("PO9");

  // PO10 (Communication) — report/presentation work
  if (scores.communication >= 2 || scores.teamwork >= 3) pos.add("PO10");

  // PO11 (Project Management) — agile/scrum/project management
  if (scores.teamwork >= 4) pos.add("PO11");

  // PO12 (Life-long Learning) — research or advanced tools
  if (scores.research >= 2 || scores.aiml >= 3) pos.add("PO12");

  return pos;
}

/**
 * Derive PSOs based on NLP scores.
 */
export function derivePSOsFromNlp(scores: NlpDomainScores): Set<string> {
  const psos = new Set<string>();

  // PSO1 (Programming & Problem Solving) — any technical work
  if (scores.aiml >= 1 || scores.cloud >= 1) psos.add("PSO1");

  // PSO2 (AI & ML Application) — strong AI/ML
  if (scores.aiml >= 2) psos.add("PSO2");

  // PSO3 (Cloud & Resource Management) — cloud/deployment
  if (scores.cloud >= 3) psos.add("PSO3");

  return psos;
}
