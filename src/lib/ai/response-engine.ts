import { INTERNSHIP_COS } from "@/lib/co-po-pso";
import { logChatDebug, shouldReturnDebugToClient, type ChatDebugTrace } from "@/lib/ai/chat-debug";
import type { ChatIntent } from "@/lib/ai/naive-bayes-intent";
import { extractCoId } from "@/lib/ai/naive-bayes-intent";
import {
  collectEvidencePhrases,
  generateDynamicJustification,
  generatePoWhyAnswer,
} from "@/lib/ai/justification-generator";
import {
  intentRequiresStudent,
  parseUserQuery,
  resolveCompareUsns,
  resolvePrimaryUsn,
} from "@/lib/ai/query-parser";
import type { StudentRetrievalContext } from "@/lib/ai/student-retrieval";
import {
  buildStudentRetrievalContext,
  loadStudentRecord,
} from "@/lib/ai/student-retrieval";
import {
  formatCompactMapping,
  formatFullOutcomeAnswer,
  formatPoAnswer,
  formatPsoAnswer,
  getTopTechnologies,
  type StudentOutcomeInput,
} from "@/lib/ai/student-outcomes";

export type EngineResponse = {
  mode: "ml-model";
  intent: ChatIntent;
  confidence: number;
  answer: string;
  studentUsn?: string;
  debug?: ChatDebugTrace;
};

const INVALID_MSG =
  "I couldn't understand your query. Try:\n• show mapping for 1DS21AI001\n• explain CO2 for 1DS21AI001\n• why is PO5 mapped for 1DS21AI001\n• compare 1DS21AI001 and 1DS21AI002\n• summarize internship report for 1DS21AI001";

const GREETING_MSG =
  "Hello! I'm InternBot. Ask about a student's CO, PO, or PSO using their USN, or select a student on the dashboard and ask about their mapping, report, or outcomes.";

function toOutcomeInput(ctx: StudentRetrievalContext): StudentOutcomeInput {
  return {
    usn: ctx.usn,
    fullName: ctx.fullName,
    internship: ctx.internship
      ? { companyName: ctx.internship.companyName, roleTitle: ctx.internship.roleTitle }
      : null,
    mapping: ctx.mapping,
    nlp: ctx.nlp,
    evaluation: ctx.evaluation,
    excelRowSnippet: ctx.excelRowSnippet,
  };
}

function inferPoCodeForWhy(ctx: StudentRetrievalContext, poId: string | null, question: string): string {
  if (poId) return poId;
  const fromQ = question.match(/\bpo\s*(\d{1,2})\b/i) ?? question.match(/\bpo(\d{1,2})\b/i);
  if (fromQ) return `PO${fromQ[1]}`;
  const strong = ctx.profile.coAlignments
    .flatMap((c) => c.alignedPOs)
    .find((p) => /strength [23]/.test(p) && /PO5/.test(p));
  if (strong) return "PO5";
  const first = [...ctx.profile.studentPOs][0];
  return first ?? "PO5";
}

function inferCoForPo(ctx: StudentRetrievalContext, poCode: string): string {
  for (const co of ctx.profile.coAlignments) {
    if (co.alignedPOs.some((p) => p.startsWith(poCode))) return co.coId;
  }
  return ctx.profile.coAlignments[0]?.coId ?? "CO1";
}

function formatAnalytics(ctx: StudentRetrievalContext): string {
  const i = ctx.internship;
  const e = ctx.evaluation;
  return [
    `[Analytics] ${ctx.fullName} (${ctx.usn})`,
    `Batch ${ctx.batchYear}, Semester ${ctx.semester}.`,
    i ? `Placement: ${i.roleTitle} at ${i.companyName}.` : "No internship on file.",
    i ? `Stipend ${i.stipend ?? "—"}, grade ${i.grade ?? "—"}, status ${i.status ?? "—"}.` : "",
    e.totalMarks ? `Marks: total ${e.totalMarks}, report ${e.reportMarks ?? "—"}, presentation ${e.presentationMarks ?? "—"}.` : "",
    `Lead CO: ${ctx.profile.coAlignments[0]?.coId} (score ${ctx.profile.coAlignments[0]?.score ?? 0}).`,
    `Signals — AI/ML ${ctx.nlp.scores.aiml}, research ${ctx.nlp.scores.research}, teamwork ${ctx.nlp.scores.teamwork}, SDG ${ctx.nlp.scores.sustainability}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatSdgAlignment(ctx: StudentRetrievalContext): string {
  const co4 = ctx.profile.coAlignments.find((c) => c.coId === "CO4");
  return [
    `[SDG / Sustainability] ${ctx.fullName} (${ctx.usn})`,
    `Sustainability score ${ctx.nlp.scores.sustainability}/10; ethics ${ctx.nlp.scores.ethics}/10.`,
    ctx.nlp.detectedKeywords.sustainability.length
      ? `Terms: ${ctx.nlp.detectedKeywords.sustainability.join(", ")}.`
      : "No explicit SDG terms in stored data.",
    co4 ? `CO4 alignment score ${co4.score}: ${co4.alignedPOs.join("; ") || "—"}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatReportSummary(ctx: StudentRetrievalContext): string {
  const tech = getTopTechnologies(ctx.nlp);
  return [
    `[Report summary] ${ctx.fullName} (${ctx.usn})`,
    ctx.internship
      ? `${ctx.internship.roleTitle} at ${ctx.internship.companyName} (${ctx.internship.status ?? "—"}).`
      : "",
    ctx.mapping?.coMappingSummary ? ctx.mapping.coMappingSummary : "",
    ctx.excelRowSnippet ? `Record excerpt: ${ctx.excelRowSnippet.slice(0, 400)}…` : "",
    tech.length ? `Detected themes: ${tech.join(", ")}.` : "",
    `Primary COs: ${ctx.profile.coAlignments.slice(0, 2).map((c) => c.coId).join(", ")}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatTechnologiesForCo(ctx: StudentRetrievalContext, coId: string): string {
  const tech = getTopTechnologies(ctx.nlp);
  const alignment = ctx.profile.coAlignments.find((c) => c.coId === coId);
  return [
    `[Technologies → ${coId}] ${ctx.fullName} (${ctx.usn})`,
    INTERNSHIP_COS.find((c) => c.id === coId)?.title ?? "",
    tech.length ? `Tools/methods: ${tech.join(", ")}.` : "Inferred from role and stored fields only.",
    alignment ? `Links: ${alignment.alignedPOs.join("; ") || "—"}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatCompare(ctxList: StudentRetrievalContext[]): string {
  const [a, b] = ctxList;
  return [
    `[Compare] ${a.usn} vs ${b.usn}`,
    "",
    `${a.fullName}: ${a.internship?.roleTitle ?? "—"} @ ${a.internship?.companyName ?? "—"}`,
    `  POs ${[...a.profile.studentPOs].join(", ") || "—"} | top CO ${a.profile.coAlignments[0]?.coId} (${a.profile.coAlignments[0]?.score})`,
    "",
    `${b.fullName}: ${b.internship?.roleTitle ?? "—"} @ ${b.internship?.companyName ?? "—"}`,
    `  POs ${[...b.profile.studentPOs].join(", ") || "—"} | top CO ${b.profile.coAlignments[0]?.coId} (${b.profile.coAlignments[0]?.score})`,
    "",
    `AI/ML signal: ${a.nlp.scores.aiml} vs ${b.nlp.scores.aiml}. SDG signal: ${a.nlp.scores.sustainability} vs ${b.nlp.scores.sustainability}.`,
  ].join("\n");
}

function formatCoExplain(ctx: StudentRetrievalContext, coId: string): string {
  const alignment = ctx.profile.coAlignments.find((c) => c.coId === coId);
  const coMeta = INTERNSHIP_COS.find((c) => c.id === coId);
  return [
    `[Explain ${coId}] ${ctx.fullName} (${ctx.usn})`,
    coMeta?.title ?? "",
    `POs: ${[...ctx.profile.studentPOs].join(", ") || "—"} | PSOs: ${[...ctx.profile.studentPSOs].join(", ") || "—"}`,
    alignment
      ? `Matrix overlap: ${alignment.alignedPOs.join("; ") || "—"} | ${alignment.alignedPSOs.join("; ") || "—"}`
      : "No matrix overlap for this CO.",
    "",
    alignment
      ? generateDynamicJustification({
          studentName: ctx.fullName,
          coId,
          roleTitle: ctx.internship?.roleTitle ?? "",
          companyName: ctx.internship?.companyName ?? "",
          alignment,
          nlp: ctx.nlp,
        })
      : "",
    collectEvidencePhrases(ctx.nlp).length
      ? `Evidence: ${collectEvidencePhrases(ctx.nlp).join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatJustification(ctx: StudentRetrievalContext): string {
  const top = ctx.profile.coAlignments.filter((c) => c.score > 0).slice(0, 2);
  return [
    `[Justification] ${ctx.fullName} (${ctx.usn})`,
    ...top.map((co) =>
      generateDynamicJustification({
        studentName: ctx.fullName,
        coId: co.coId,
        roleTitle: ctx.internship?.roleTitle ?? "",
        companyName: ctx.internship?.companyName ?? "",
        alignment: co,
        nlp: ctx.nlp,
      }),
    ),
  ].join("\n\n");
}

function buildDebug(
  question: string,
  parsed: ReturnType<typeof parseUserQuery>,
  primaryUsn: string | null,
  path: string,
  fallback: boolean,
  studentsResolved: string[],
): ChatDebugTrace {
  return {
    question,
    intent: parsed.intent,
    intentSource: parsed.intentSource,
    confidence: parsed.confidence,
    isRecognizable: parsed.isRecognizable,
    questionUsns: parsed.questionUsns,
    hintUsn: parsed.hintUsn,
    primaryUsn,
    studentsResolved,
    responsePath: path,
    fallbackTriggered: fallback,
    coId: parsed.coId,
    poId: parsed.poId,
  };
}

function respondInvalid(
  parsed: ReturnType<typeof parseUserQuery>,
  question: string,
  path: string,
): EngineResponse {
  const debug = buildDebug(question, parsed, null, path, true, []);
  logChatDebug(debug);
  return {
    mode: "ml-model",
    intent: "invalid_query",
    confidence: parsed.confidence,
    answer: INVALID_MSG,
    debug: shouldReturnDebugToClient() ? debug : undefined,
  };
}

function respondGreeting(parsed: ReturnType<typeof parseUserQuery>, question: string): EngineResponse {
  const debug = buildDebug(question, parsed, null, "greeting", false, []);
  logChatDebug(debug);
  return {
    mode: "ml-model",
    intent: "greeting",
    confidence: 1,
    answer: GREETING_MSG,
    debug: shouldReturnDebugToClient() ? debug : undefined,
  };
}

async function loadContextForUsn(usn: string): Promise<StudentRetrievalContext | null> {
  const record = await loadStudentRecord(usn);
  if (!record) return null;
  return buildStudentRetrievalContext(record);
}

function routeToFormatter(
  intent: ChatIntent,
  ctx: StudentRetrievalContext,
  question: string,
  coId: string,
  poId: string | null,
): { answer: string; path: string } {
  const input = toOutcomeInput(ctx);
  const tech = getTopTechnologies(ctx.nlp);

  switch (intent) {
    case "outcomes_mapping":
      return { path: "compact_mapping", answer: formatCompactMapping(input, ctx.profile) };
    case "outcomes_po_why": {
      const poCode = inferPoCodeForWhy(ctx, poId, question);
      const coForPo = extractCoId(question) ?? inferCoForPo(ctx, poCode);
      return {
        path: "po_why",
        answer: generatePoWhyAnswer({
          studentName: ctx.fullName,
          usn: ctx.usn,
          poCode,
          coId: coForPo,
          roleTitle: ctx.internship?.roleTitle ?? "",
          companyName: ctx.internship?.companyName ?? "",
          nlp: ctx.nlp,
          inStudentRecord: ctx.profile.studentPOs.has(poCode),
        }),
      };
    }
    case "outcomes_co":
      return { path: "explain_co", answer: formatCoExplain(ctx, coId) };
    case "outcomes_po":
      return { path: "list_po", answer: formatPoAnswer(input, ctx.profile) };
    case "outcomes_pso":
      return { path: "list_pso", answer: formatPsoAnswer(input, ctx.profile) };
    case "outcomes_justification":
      return { path: "justification", answer: formatJustification(ctx) };
    case "sdg_alignment":
      return { path: "sdg", answer: formatSdgAlignment(ctx) };
    case "internship_analytics":
      return { path: "analytics", answer: formatAnalytics(ctx) };
    case "report_summary":
      return { path: "report_summary", answer: formatReportSummary(ctx) };
    case "technologies_co":
      return { path: "technologies", answer: formatTechnologiesForCo(ctx, coId) };
    case "internship_company":
      return {
        path: "company",
        answer: `[Company] ${ctx.fullName} (${ctx.usn}) interned at ${ctx.internship?.companyName ?? "not in records"}.`,
      };
    case "internship_stipend":
      return {
        path: "stipend",
        answer: `[Stipend] ${ctx.fullName} (${ctx.usn}): ${ctx.internship?.stipend ?? "not recorded"}.`,
      };
    case "internship_role":
      return {
        path: "role",
        answer: `[Role] ${ctx.fullName} (${ctx.usn}): ${ctx.internship?.roleTitle ?? "—"} at ${ctx.internship?.companyName ?? "—"}.`,
      };
    case "outcomes_all":
      return {
        path: "full_co_dump",
        answer: formatFullOutcomeAnswer(input, ctx.profile, {
          nlpConfidence: ctx.nlp.scores.confidence,
          technologies: tech,
        }),
      };
    case "student_summary":
      return {
        path: "brief_summary",
        answer: [
          `[Overview] ${ctx.fullName} (${ctx.usn})`,
          ctx.internship
            ? `${ctx.internship.roleTitle} @ ${ctx.internship.companyName}.`
            : "No internship.",
          `POs: ${[...ctx.profile.studentPOs].join(", ") || "—"}. Lead CO: ${ctx.profile.coAlignments[0]?.coId ?? "—"}.`,
        ].join("\n"),
      };
    default:
      return { path: "unexpected_intent", answer: INVALID_MSG };
  }
}

export async function answerFromRetrieval(
  question: string,
  options?: { usn?: string; history?: string[] },
): Promise<EngineResponse> {
  const parsed = parseUserQuery(question, {
    hintUsn: options?.usn,
    history: options?.history,
  });

  const coId = parsed.coId ?? "CO1";
  const primaryUsn = resolvePrimaryUsn(parsed);

  if (parsed.intent === "invalid_query" || !parsed.isRecognizable) {
    return respondInvalid(parsed, question, "fallback_invalid");
  }

  if (parsed.intent === "greeting") {
    return respondGreeting(parsed, question);
  }

  if (parsed.intent === "compare_students") {
    const pair = resolveCompareUsns(parsed);
    if (pair.length < 2) {
      const debug = buildDebug(question, parsed, null, "compare_missing_usn", true, []);
      logChatDebug(debug);
      return {
        mode: "ml-model",
        intent: "compare_students",
        confidence: parsed.confidence,
        answer:
          "To compare students, include two USNs (e.g. compare 1DS21AI001 and 1DS21AI002), or one USN in the message plus another student selected on the dashboard.",
        debug: shouldReturnDebugToClient() ? debug : undefined,
      };
    }
    const contexts = (
      await Promise.all(pair.map((u) => loadContextForUsn(u)))
    ).filter((c): c is StudentRetrievalContext => c != null);

    if (contexts.length < 2) {
      const debug = buildDebug(question, parsed, null, "compare_not_found", true, contexts.map((c) => c.usn));
      logChatDebug(debug);
      return {
        mode: "ml-model",
        intent: "compare_students",
        confidence: parsed.confidence,
        answer: `Could not find both students in the database. Requested: ${pair.join(", ")}.`,
        debug: shouldReturnDebugToClient() ? debug : undefined,
      };
    }

    const { answer, path } = { answer: formatCompare(contexts), path: "compare" };
    const debug = buildDebug(
      question,
      parsed,
      null,
      path,
      false,
      contexts.map((c) => c.usn),
    );
    logChatDebug(debug);
    return {
      mode: "ml-model",
      intent: "compare_students",
      confidence: parsed.confidence,
      answer,
      debug: shouldReturnDebugToClient() ? debug : undefined,
    };
  }

  if (!intentRequiresStudent(parsed.intent)) {
    return respondInvalid(parsed, question, "fallback_no_student_intent");
  }

  if (!primaryUsn) {
    return respondInvalid(parsed, question, "fallback_no_usn");
  }

  const ctx = await loadContextForUsn(primaryUsn);
  if (!ctx) {
    const debug = buildDebug(question, parsed, primaryUsn, "student_not_found", true, []);
    logChatDebug(debug);
    return {
      mode: "ml-model",
      intent: parsed.intent,
      confidence: parsed.confidence,
      answer: `No student found for USN ${primaryUsn}. Check the USN or import data.`,
      debug: shouldReturnDebugToClient() ? debug : undefined,
    };
  }

  const { answer, path } = routeToFormatter(parsed.intent, ctx, question, coId, parsed.poId);
  const debug = buildDebug(question, parsed, primaryUsn, path, false, [ctx.usn]);
  logChatDebug(debug);

  return {
    mode: "ml-model",
    intent: parsed.intent,
    confidence: parsed.confidence,
    answer,
    studentUsn: ctx.usn,
    debug: shouldReturnDebugToClient() ? debug : undefined,
  };
}
