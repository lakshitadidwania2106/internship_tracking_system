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
  if (level === "3") return "strongly";
  if (level === "2") return "moderately";
  if (level === "1") return "partly";
  return "relevantly";
}

export function collectEvidencePhrases(nlp: NlpAnalysisResult): string[] {
  const phrases: string[] = [];
  for (const list of Object.values(nlp.detectedKeywords)) {
    phrases.push(...list.slice(0, 2));
  }
  return [...new Set(phrases)].slice(0, 6);
}

function roleActivityHint(nlp: NlpAnalysisResult, poCode: string): string {
  const evidence = collectEvidencePhrases(nlp);
  const tech =
    evidence.length > 0
      ? evidence.slice(0, 3).join(", ")
      : nlp.scores.aiml >= 5
        ? "AI/ML tools and frameworks"
        : "engineering software and workflows";

  switch (poCode) {
    case "PO5":
      return `worked with ${tech} and applied modern engineering tools in a practical setting`;
    case "PO9":
      return `collaborated in a team environment and contributed to shared deliverables`;
    case "PO10":
      return `documented work, presented findings, and communicated technical outcomes`;
    case "PO7":
    case "PO6":
      return `addressed real-world problems with awareness of societal and sustainability context`;
    case "PSO2":
      return `applied AI/ML concepts during the internship (NLP signal ${nlp.scores.aiml}/10)`;
    case "PSO3":
      return `used cloud or scalable tooling where relevant (cloud signal ${nlp.scores.cloud}/10)`;
    default:
      return `applied domain knowledge through hands-on internship activities`;
  }
}

export function generateDynamicJustification(params: {
  studentName: string;
  coId: string;
  roleTitle: string;
  companyName: string;
  alignment: CoAlignment;
  nlp: NlpAnalysisResult;
  poCode?: string;
  detailed?: boolean;
}): string {
  const { studentName, coId, roleTitle, companyName, alignment, nlp, poCode, detailed } = params;
  const evidence = collectEvidencePhrases(nlp);

  const topPo = poCode
    ? poCode.toUpperCase()
    : alignment.alignedPOs[0]?.match(/PO\d+/)?.[0] ??
      alignment.alignedPSOs[0]?.match(/PSO\d+/)?.[0] ??
      "PO5";

  const matrixLevel = matrixStrengthFor(coId, topPo);
  const poLabel = PO_LABELS[topPo] ?? topPo;
  const strength = strengthWord(matrixLevel);
  const activity = roleActivityHint(nlp, topPo);

  const rolePart = roleTitle ? ` as ${roleTitle}` : "";
  const companyPart = companyName ? ` at ${companyName}` : "";

  const lead = `${topPo} is mapped because ${studentName} ${activity}${rolePart}${companyPart}. This aligns ${strength} with ${coId} (${poLabel}).`;

  if (!detailed) return lead;

  const techPart = evidence.length ? ` Keywords from records: ${evidence.join(", ")}.` : "";
  const matrixPart = alignment.alignedPOs.length
    ? ` Matrix overlap: ${alignment.alignedPOs.slice(0, 3).join("; ")}.`
    : "";

  return `${lead}${techPart}${matrixPart}`;
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
  detailed?: boolean;
}): string {
  const { poCode, coId, nlp, inStudentRecord, detailed } = params;
  const poLabel = PO_LABELS[poCode] ?? poCode;
  const activity = roleActivityHint(nlp, poCode);
  const rolePart = params.roleTitle ? ` as ${params.roleTitle}` : "";
  const companyPart = params.companyName ? ` at ${params.companyName}` : "";

  const recordNote = inStudentRecord
    ? `${poCode} is listed in this student's imported outcome mapping.`
    : `${poCode} is inferred from the internship role, company context, and project signals in stored data.`;

  const coNote = coId
    ? `The strongest course link is ${coId}, which maps to ${poCode} in the CO–PO matrix.`
    : "";

  const lead = `${poCode} (${poLabel}) applies here because ${params.studentName} ${activity}${rolePart}${companyPart}. ${recordNote}`;

  if (!detailed) {
    return [lead, coNote].filter(Boolean).join(" ");
  }

  const evidence = collectEvidencePhrases(nlp);
  return [
    `${params.studentName} (${params.usn}) — Why ${poCode} is mapped`,
    lead,
    coNote,
    evidence.length ? `Supporting terms: ${evidence.join(", ")}.` : "",
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
      detailed: true,
    }),
  ]
    .filter(Boolean)
    .join("\n\n");
}
