import {
  CO_JUSTIFICATIONS,
  CO_PO_PSO_COLUMNS,
  CO_PO_PSO_MATRIX,
  INTERNSHIP_COS,
} from "@/lib/co-po-pso";
import {
  derivePOsFromNlp,
  derivePSOsFromNlp,
  formatOutcomeSet,
  parseOutcomeCodes,
  type NlpAnalysisResult,
} from "@/lib/ai/text-utils";

export type StudentOutcomeInput = {
  fullName: string;
  usn: string;
  internship: { companyName: string; roleTitle: string } | null;
  mapping: {
    relevantPOs: string | null;
    relevantPSOs: string | null;
    coMappingSummary: string | null;
    justification?: string | null;
  } | null;
  nlp?: NlpAnalysisResult;
  evaluation?: Record<string, string | undefined>;
  excelRowSnippet?: string;
  sourceRowRawJson?: string | null;
};

export type CoAlignment = {
  coId: string;
  title: string;
  score: number;
  alignedPOs: string[];
  alignedPSOs: string[];
};

export type StudentOutcomeProfile = {
  studentPOs: Set<string>;
  studentPSOs: Set<string>;
  coAlignments: CoAlignment[];
  summary: string | null;
  poSource?: "excel" | "nlp-inferred" | "none";
};

const ROLE_CO_BOOST: Record<string, string[]> = {
  co1: ["ml", "ai", "machine", "deep", "nlp", "computer vision", "data science", "model"],
  co2: ["research", "literature", "analysis", "analyst", "experiment", "r&d"],
  co3: ["communication", "team", "manager", "lead", "scrum", "agile", "hr", "client"],
  co4: ["evaluate", "mlops", "deploy", "cloud", "sustainability", "performance", "devops"],
};

function roleBoost(coId: string, roleTitle: string): number {
  const lower = roleTitle.toLowerCase();
  const keywords = ROLE_CO_BOOST[coId.toLowerCase()] ?? [];
  return keywords.some((word) => lower.includes(word)) ? 2 : 0;
}

function nlpCoBoost(coId: string, nlp?: NlpAnalysisResult): number {
  if (!nlp) return 0;
  const s = nlp.scores;
  switch (coId) {
    case "CO1":
      return Math.min(4, Math.floor(s.aiml / 2) + Math.floor(s.cloud / 4));
    case "CO2":
      return Math.min(4, Math.floor(s.research / 2));
    case "CO3":
      return Math.min(4, Math.floor(s.teamwork / 2) + Math.floor(s.communication / 3));
    case "CO4":
      return Math.min(
        4,
        Math.floor(s.sustainability / 2) + Math.floor(s.ethics / 3) + Math.floor(s.cloud / 4),
      );
    default:
      return 0;
  }
}

function matrixStrength(value: string): number {
  if (value === "-") {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildStudentOutcomeProfile(student: StudentOutcomeInput): StudentOutcomeProfile {
  let studentPOs = parseOutcomeCodes(student.mapping?.relevantPOs, "PO");
  let studentPSOs = parseOutcomeCodes(student.mapping?.relevantPSOs, "PSO");

  if (student.nlp && studentPOs.size === 0) {
    studentPOs = derivePOsFromNlp(student.nlp.scores);
  }
  if (student.nlp && studentPSOs.size === 0) {
    studentPSOs = derivePSOsFromNlp(student.nlp.scores);
  }

  const roleTitle = student.internship?.roleTitle ?? "";
  const poSource =
    student.mapping?.relevantPOs?.trim() ?
      "excel"
    : student.nlp && studentPOs.size > 0 ?
      "nlp-inferred"
    : "none";

  const coAlignments: CoAlignment[] = INTERNSHIP_COS.map((co) => {
    const row = CO_PO_PSO_MATRIX[co.id];
    const alignedPOs: string[] = [];
    const alignedPSOs: string[] = [];
    let score = roleBoost(co.id, roleTitle) + nlpCoBoost(co.id, student.nlp);

    CO_PO_PSO_COLUMNS.forEach((column, index) => {
      const strength = row[index];
      const numeric = matrixStrength(strength);
      if (numeric === 0) {
        return;
      }

      const inStudentSet =
        (column.startsWith("PO") && studentPOs.has(column)) ||
        (column.startsWith("PSO") && studentPSOs.has(column));

      if (inStudentSet) {
        score += numeric;
        const label = `${column} (strength ${strength})`;
        if (column.startsWith("PO")) {
          alignedPOs.push(label);
        } else {
          alignedPSOs.push(label);
        }
      }
    });

    return {
      coId: co.id,
      title: co.title,
      score,
      alignedPOs,
      alignedPSOs,
    };
  });

  coAlignments.sort((a, b) => b.score - a.score);

  return {
    studentPOs,
    studentPSOs,
    coAlignments,
    summary: student.mapping?.coMappingSummary ?? null,
    poSource,
  };
}

export function getTopTechnologies(nlp: NlpAnalysisResult, limit = 8): string[] {
  const tech = [
    ...nlp.detectedKeywords.aiml,
    ...nlp.detectedKeywords.cloud,
    ...nlp.detectedKeywords.research,
  ];
  return [...new Set(tech)].slice(0, limit);
}

export function formatFullOutcomeAnswer(
  student: StudentOutcomeInput,
  profile: StudentOutcomeProfile,
  extras?: { nlpConfidence?: number; technologies?: string[] },
): string {
  const lines: string[] = [
    `${student.fullName} (${student.usn}) — Internship CO / PO / PSO`,
    `Role: ${student.internship?.roleTitle ?? "—"} @ ${student.internship?.companyName ?? "—"}`,
    profile.poSource === "nlp-inferred"
      ? "PO/PSO inferred from role + internship narrative (no Excel mapping on file)."
      : "",
    "",
    `POs used: ${formatOutcomeSet(profile.studentPOs)}`,
    `PSOs used: ${formatOutcomeSet(profile.studentPSOs)}`,
    profile.summary ? `Faculty summary: ${profile.summary}` : "",
    extras?.technologies?.length
      ? `Technologies / themes detected: ${extras.technologies.join(", ")}`
      : "",
    extras?.nlpConfidence != null
      ? `Analysis confidence: ${Math.round(extras.nlpConfidence * 100)}%`
      : "",
    "",
    "Per-student CO ranking (matrix × your PO/PSO + NLP/role signals):",
  ].filter(Boolean);

  for (const co of profile.coAlignments) {
    const poText = co.alignedPOs.length ? co.alignedPOs.join("; ") : "—";
    const psoText = co.alignedPSOs.length ? co.alignedPSOs.join("; ") : "—";
    lines.push(
      "",
      `${co.coId} (rank score ${co.score})`,
      co.title,
      `  Aligned POs: ${poText}`,
      `  Aligned PSOs: ${psoText}`,
    );
  }

  return lines.join("\n");
}

/** Short mapping view — distinct from full CO dump */
export function formatCompactMapping(
  student: StudentOutcomeInput,
  profile: StudentOutcomeProfile,
): string {
  const top = profile.coAlignments.filter((c) => c.score > 0).slice(0, 3);
  const pos = [...profile.studentPOs].slice(0, 5).join(", ") || "not recorded";
  const psos = [...profile.studentPSOs].slice(0, 3).join(", ") || "not recorded";
  const leadCo = top[0];

  const lines = [
    `${student.fullName} (${student.usn}) — outcome mapping`,
    student.internship
      ? `${student.internship.roleTitle} at ${student.internship.companyName}.`
      : "",
    "",
    `Relevant POs: ${pos}.`,
    `Relevant PSOs: ${psos}.`,
    leadCo
      ? `Strongest fit: ${leadCo.coId} — ${leadCo.title.split(".")[0] ?? leadCo.title}.`
      : "No CO alignment computed yet.",
    top.length > 1
      ? `Also aligned: ${top
          .slice(1)
          .map((c) => c.coId)
          .join(", ")}.`
      : "",
    "",
    'Say "explain in detail" or "full mapping" for the complete matrix breakdown.',
  ].filter(Boolean);

  return lines.join("\n");
}

/** Conversational natural mapping — default chatbot tone */
export function formatNaturalMapping(
  student: StudentOutcomeInput,
  profile: StudentOutcomeProfile,
): string {
  const top = profile.coAlignments.filter((c) => c.score > 0).slice(0, 2);
  const pos = [...profile.studentPOs].slice(0, 4);
  const psos = [...profile.studentPSOs].slice(0, 2);
  const role = student.internship?.roleTitle ?? "their internship role";
  const company = student.internship?.companyName ?? "the host company";

  const coSentence = top.length
    ? `The internship aligns best with ${top.map((c) => c.coId).join(" and ")} given ${role} at ${company}.`
    : `Outcome mapping is limited — import or verify Excel mapping data for ${student.fullName}.`;

  const poSentence = pos.length
    ? `Recorded program outcomes include ${pos.join(", ")}${psos.length ? `, with ${psos.join(", ")}` : ""}.`
    : profile.poSource === "nlp-inferred"
      ? "POs/PSOs were inferred from internship text because no Excel mapping was stored."
      : "No PO/PSO list found in imported data.";

  return [coSentence, poSentence].join(" ");
}

export function formatTopOutcomes(
  student: StudentOutcomeInput,
  profile: StudentOutcomeProfile,
): string {
  const top = profile.coAlignments.filter((c) => c.score > 0).slice(0, 3);
  if (!top.length) {
    return `No strong CO alignments found for ${student.fullName} (${student.usn}) yet.`;
  }

  const lines = [
    `Strongest outcomes for ${student.fullName} (${student.usn}):`,
    ...top.map((co, i) => {
      const po = co.alignedPOs[0]?.replace(/ \(strength.*\)/, "") ?? "—";
      return `${i + 1}. ${co.coId} — top PO link: ${po}`;
    }),
  ];
  return lines.join("\n");
}

export function formatCoAnswer(
  student: StudentOutcomeInput,
  profile: StudentOutcomeProfile,
  coId: string,
): string {
  const coMeta = INTERNSHIP_COS.find((co) => co.id === coId);
  const alignment = profile.coAlignments.find((co) => co.coId === coId);
  const justification = CO_JUSTIFICATIONS.find((item) => item.co === coId);

  if (!coMeta || !alignment) {
    return `No ${coId} data found for ${student.fullName}.`;
  }

  const filteredPoints =
    justification?.points.filter((point) => {
      const upper = point.toUpperCase();
      return (
        [...profile.studentPOs].some((po) => upper.includes(po)) ||
        [...profile.studentPSOs].some((pso) => upper.includes(pso)) ||
        profile.studentPOs.size === 0
      );
    }) ?? [];

  return [
    `${student.fullName} (${student.usn}) — ${coId}`,
    coMeta.title,
    "",
    `Your recorded POs: ${formatOutcomeSet(profile.studentPOs)}`,
    `Your recorded PSOs: ${formatOutcomeSet(profile.studentPSOs)}`,
    "",
    `Aligned POs for ${coId}: ${alignment.alignedPOs.join("; ") || "—"}`,
    `Aligned PSOs for ${coId}: ${alignment.alignedPSOs.join("; ") || "—"}`,
    "",
    "Justification (filtered to this student's PO/PSO):",
    ...filteredPoints.map((point) => `• ${point}`),
  ].join("\n");
}

export function formatPoAnswer(student: StudentOutcomeInput, profile: StudentOutcomeProfile): string {
  return [
    `${student.fullName} (${student.usn}) — Program Outcomes (PO)`,
    `Recorded in database: ${student.mapping?.relevantPOs ?? formatOutcomeSet(profile.studentPOs)}`,
    "",
    "CO rows where these POs strongly align (matrix strength ≥ 2):",
    ...profile.coAlignments.map((co) => {
      const strong = co.alignedPOs.filter((po) => /strength [23]/.test(po));
      return strong.length ? `  ${co.coId}: ${strong.join("; ")}` : null;
    }).filter(Boolean) as string[],
  ].join("\n");
}

export function formatPsoAnswer(student: StudentOutcomeInput, profile: StudentOutcomeProfile): string {
  return [
    `${student.fullName} (${student.usn}) — Program Specific Outcomes (PSO)`,
    `Recorded in database: ${student.mapping?.relevantPSOs ?? formatOutcomeSet(profile.studentPSOs)}`,
    "",
    "CO rows where these PSOs strongly align (matrix strength ≥ 2):",
    ...profile.coAlignments.map((co) => {
      const strong = co.alignedPSOs.filter((pso) => /strength [23]/.test(pso));
      return strong.length ? `  ${co.coId}: ${strong.join("; ")}` : null;
    }).filter(Boolean) as string[],
  ].join("\n");
}

export function formatJustificationAnswer(student: StudentOutcomeInput, profile: StudentOutcomeProfile): string {
  const blocks = profile.coAlignments
    .filter((co) => co.score > 0)
    .slice(0, 4)
    .map((co) => {
      const justification = CO_JUSTIFICATIONS.find((item) => item.co === co.coId);
      return [
        `${co.coId}: ${justification?.heading ?? co.title}`,
        ...(justification?.points.slice(0, 4).map((p) => `  • ${p}`) ?? []),
      ].join("\n");
    });

  return [
    `${student.fullName} (${student.usn}) — CO–PO–PSO justification`,
    profile.summary ? `Summary: ${profile.summary}` : "",
    "",
    ...blocks,
  ]
    .filter(Boolean)
    .join("\n\n");
}
