import { CO_PO_PSO_MATRIX, CO_PO_PSO_COLUMNS } from "@/lib/co-po-pso";
import type { NlpAnalysisResult } from "@/lib/ai/text-utils";
import type { CoAlignment } from "@/lib/ai/student-outcomes";

const PO_LABELS: Record<string, string> = {
  PO1: "engineering knowledge",
  PO2: "problem analysis",
  PO3: "design and development of solutions",
  PO4: "investigation of complex problems",
  PO5: "modern tool usage",
  PO6: "engineer and society",
  PO7: "environment and sustainability",
  PO8: "ethics",
  PO9: "individual and team work",
  PO10: "communication",
  PO11: "project management",
  PO12: "life-long learning",
  PSO1: "programming and problem solving",
  PSO2: "AI and ML application",
  PSO3: "cloud and resource management",
};

function matrixStrengthFor(coId: string, outcomeCode: string): string | null {
  const row = CO_PO_PSO_MATRIX[coId];
  if (!row) return null;
  const idx = CO_PO_PSO_COLUMNS.indexOf(outcomeCode as (typeof CO_PO_PSO_COLUMNS)[number]);
  if (idx < 0) return null;
  const v = row[idx];
  return v === "-" ? null : v;
}

function strengthWord(level: string | null): string {
  if (level === "3") return "strong";
  if (level === "2") return "moderate";
  if (level === "1") return "low";
  return "relevant";
}

export function collectEvidencePhrases(nlp: NlpAnalysisResult): string[] {
  const phrases: string[] = [];
  for (const list of Object.values(nlp.detectedKeywords)) {
    phrases.push(...list.slice(0, 2));
  }
  return [...new Set(phrases)].slice(0, 6);
}

export function generateDynamicJustification(params: {
  studentName: string;
  coId: string;
  roleTitle: string;
  companyName: string;
  alignment: CoAlignment;
  nlp: NlpAnalysisResult;
  poCode?: string;
}): string {
  const { studentName, coId, roleTitle, companyName, alignment, nlp, poCode } = params;
  const evidence = collectEvidencePhrases(nlp);
  const techPart =
    evidence.length > 0
      ? ` through activities involving ${evidence.slice(0, 4).join(", ")}`
      : "";

  const topPo = poCode
    ? poCode.toUpperCase()
    : alignment.alignedPOs[0]?.match(/PO\d+/)?.[0] ??
      alignment.alignedPSOs[0]?.match(/PSO\d+/)?.[0] ??
      "PO5";

  const matrixLevel = matrixStrengthFor(coId, topPo);
  const poLabel = PO_LABELS[topPo] ?? topPo;
  const strength = strengthWord(matrixLevel);

  const rolePart = roleTitle ? ` as ${roleTitle}` : "";
  const companyPart = companyName ? ` at ${companyName}` : "";

  return (
    `${studentName} demonstrates ${strength} alignment with ${coId} and ${topPo} (${poLabel})` +
    `${rolePart}${companyPart}${techPart}. ` +
    `NLP confidence for this profile: ${Math.round(nlp.scores.confidence * 100)}%. ` +
    `Recorded PO/PSO overlap for ${coId}: ${alignment.alignedPOs.length ? alignment.alignedPOs.join("; ") : "—"}; ` +
    `${alignment.alignedPSOs.length ? alignment.alignedPSOs.join("; ") : "—"}.`
  );
}

export function generatePoWhyAnswer(params: {
  studentName: string;
  usn: string;
  poCode: string;
  coId: string | null;
  roleTitle: string;
  companyName: string;
  nlp: NlpAnalysisResult;
  inStudentRecord: boolean;
}): string {
  const { poCode, coId, nlp, inStudentRecord } = params;
  const matrixLevel = coId ? matrixStrengthFor(coId, poCode) : null;
  const strength = strengthWord(matrixLevel);
  const poLabel = PO_LABELS[poCode] ?? poCode;
  const evidence = collectEvidencePhrases(nlp);

  const domainHint =
    poCode === "PO5"
      ? `Tool and framework usage (AI/ML score ${nlp.scores.aiml}/10, cloud ${nlp.scores.cloud}/10)`
      : poCode === "PO9"
        ? `Teamwork signals (score ${nlp.scores.teamwork}/10)`
        : poCode === "PO10"
          ? `Communication and reporting (score ${nlp.scores.communication}/10)`
          : poCode === "PO7" || poCode === "PO6"
            ? `Sustainability and societal impact (SDG score ${nlp.scores.sustainability}/10)`
            : `Role and internship narrative analysis`;

  return [
    `${params.studentName} (${params.usn}) — Why ${poCode} is mapped`,
    inStudentRecord
      ? `${poCode} appears in this student's recorded relevant PO list.`
      : `${poCode} is inferred from internship role and project signals (not explicitly listed in Excel mapping).`,
    coId
      ? `Course matrix links ${coId} → ${poCode} at ${strength} strength (${matrixLevel ?? "n/a"}).`
      : `Search the CO–PO matrix for rows where ${poCode} has strength 2 or 3.`,
    domainHint,
    evidence.length ? `Evidence keywords: ${evidence.join(", ")}.` : "",
    generateDynamicJustification({
      studentName: params.studentName,
      coId: coId ?? "CO1",
      roleTitle: params.roleTitle,
      companyName: params.companyName,
      alignment: {
        coId: coId ?? "CO1",
        title: "",
        score: 0,
        alignedPOs: [`${poCode} (student record)`],
        alignedPSOs: [],
      },
      nlp: params.nlp,
      poCode,
    }),
  ]
    .filter(Boolean)
    .join("\n\n");
}
