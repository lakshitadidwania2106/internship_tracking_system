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
  type ChatTurn,
} from "@/lib/ai/query-parser";
import type { StudentRetrievalContext } from "@/lib/ai/student-retrieval";
import {
  buildStudentRetrievalContext,
  loadStudentRecord,
} from "@/lib/ai/student-retrieval";
import {
  formatStudentMarksAnswer,
  formatPerformanceSummary,
  marksSummaryLine,
} from "@/lib/ai/student-marks-formatter";
import {
  formatCompactMapping,
  formatFullOutcomeAnswer,
  formatNaturalMapping,
  formatPoAnswer,
  formatPsoAnswer,
  formatTopOutcomes,
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
  "I couldn't understand that. Try:\n• mapping for 1DS21AI004\n• marks for 1DS21AI004\n• tell me about 1DS21AI004\n• why is PO5 mapped for 1DS21AI004\n• compare 1DS21AI001 and 1DS21AI002";

const GREETING_MSG =
  "Hello! I'm InternBot. Ask naturally about a student's mapping, marks, company, or performance — include a USN or select a student on the dashboard.";

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
  return [
    `${ctx.fullName} (${ctx.usn}) — internship analytics`,
    i ? `${i.roleTitle} at ${i.companyName}. Stipend ${i.stipend ?? "—"}, grade ${i.grade ?? "—"}.` : "",
    ctx.evaluation.totalMarks ? `Marks: ${ctx.evaluation.totalMarks} total.` : "",
    `Lead CO: ${ctx.profile.coAlignments[0]?.coId ?? "—"}.`,
    marksSummaryLine(ctx),
  ]
    .filter(Boolean)
    .join("\n");
}

function formatSdgAlignment(ctx: StudentRetrievalContext): string {
  const co4 = ctx.profile.coAlignments.find((c) => c.coId === "CO4");
  const terms = ctx.nlp.detectedKeywords.sustainability;
  return [
    `${ctx.fullName} (${ctx.usn}) — sustainability / SDG alignment`,
    terms.length
      ? `Themes in stored data: ${terms.join(", ")}.`
      : "No explicit sustainability keywords in imported records.",
    co4 ? `${co4.coId} is the strongest sustainability-related course outcome for this profile.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatReportSummary(ctx: StudentRetrievalContext, detailed: boolean): string {
  const tech = getTopTechnologies(ctx.nlp);
  const lines = [
    `${ctx.fullName} (${ctx.usn}) — internship report summary`,
    ctx.internship
      ? `${ctx.internship.roleTitle} at ${ctx.internship.companyName} (${ctx.internship.status ?? "—"}).`
      : "",
    ctx.mapping?.coMappingSummary ?? "",
    tech.length ? `Technologies / themes: ${tech.join(", ")}.` : "",
    `Primary COs: ${ctx.profile.coAlignments.slice(0, 2).map((c) => c.coId).join(", ") || "—"}.`,
  ].filter(Boolean);

  if (detailed && ctx.excelRowSnippet) {
    lines.push("", `Record excerpt: ${ctx.excelRowSnippet.slice(0, 400)}…`);
  }
  return lines.join("\n");
}

function formatInternshipSummary(ctx: StudentRetrievalContext): string {
  const i = ctx.internship;
  if (!i) {
    return `${ctx.fullName} (${ctx.usn}) has no internship record imported yet.`;
  }
  const duration =
    i.durationText ?? `${i.startDateRaw ?? "—"} to ${i.endDateRaw ?? "—"}`;
  return [
    `${ctx.fullName} interned as ${i.roleTitle} at ${i.companyName}.`,
    `Duration: ${duration}. Status: ${i.status ?? "—"}.`,
    i.stipend ? `Stipend: ${i.stipend}.` : "",
    marksSummaryLine(ctx) !== "Marks not imported yet" ? `Performance: ${marksSummaryLine(ctx)}.` : "",
    ctx.mapping?.coMappingSummary ? ctx.mapping.coMappingSummary : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function formatTechnologiesForCo(ctx: StudentRetrievalContext, coId: string): string {
  const tech = getTopTechnologies(ctx.nlp);
  const coMeta = INTERNSHIP_COS.find((c) => c.id === coId);
  return [
    `${ctx.fullName} (${ctx.usn}) — ${coId} technology link`,
    coMeta?.title ?? "",
    tech.length ? `Tools and methods detected: ${tech.join(", ")}.` : "Inferred from role and stored fields.",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatCompare(ctxList: StudentRetrievalContext[]): string {
  const [a, b] = ctxList;
  return [
    `Comparing ${a.fullName} (${a.usn}) vs ${b.fullName} (${b.usn})`,
    "",
    `${a.fullName}: ${a.internship?.roleTitle ?? "—"} @ ${a.internship?.companyName ?? "—"}`,
    `  POs: ${[...a.profile.studentPOs].join(", ") || "—"} | Lead CO: ${a.profile.coAlignments[0]?.coId ?? "—"}`,
    `  ${marksSummaryLine(a)}`,
    "",
    `${b.fullName}: ${b.internship?.roleTitle ?? "—"} @ ${b.internship?.companyName ?? "—"}`,
    `  POs: ${[...b.profile.studentPOs].join(", ") || "—"} | Lead CO: ${b.profile.coAlignments[0]?.coId ?? "—"}`,
    `  ${marksSummaryLine(b)}`,
  ].join("\n");
}

function formatCoExplain(ctx: StudentRetrievalContext, coId: string, detailed: boolean): string {
  const alignment = ctx.profile.coAlignments.find((c) => c.coId === coId);
  const coMeta = INTERNSHIP_COS.find((c) => c.id === coId);
  if (!alignment) {
    return `No ${coId} alignment data for ${ctx.fullName} (${ctx.usn}).`;
  }

  const lead = generateDynamicJustification({
    studentName: ctx.fullName,
    coId,
    roleTitle: ctx.internship?.roleTitle ?? "",
    companyName: ctx.internship?.companyName ?? "",
    alignment,
    nlp: ctx.nlp,
    detailed,
  });

  if (!detailed) return `${coMeta?.title ?? coId}\n\n${lead}`;

  const evidence = collectEvidencePhrases(ctx.nlp);
  return [
    `${ctx.fullName} (${ctx.usn}) — ${coId}`,
    coMeta?.title ?? "",
    lead,
    evidence.length ? `Evidence: ${evidence.join(", ")}.` : "",
    `Matrix: ${alignment.alignedPOs.join("; ") || "—"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatJustification(ctx: StudentRetrievalContext, detailed: boolean): string {
  const top = ctx.profile.coAlignments.filter((c) => c.score > 0).slice(0, detailed ? 3 : 2);
  if (!top.length) {
    return `${ctx.fullName} (${ctx.usn}): I need imported PO/PSO mapping or a clearer internship record to explain why these outcomes apply.`;
  }

  const tech = getTopTechnologies(ctx.nlp);
  const intro = [
    `Why ${ctx.fullName}'s mapping makes sense:`,
    ctx.internship
      ? `As ${ctx.internship.roleTitle} at ${ctx.internship.companyName}, the internship activities support the recorded CO–PO links.`
      : "",
    tech.length ? `Key themes: ${tech.slice(0, 4).join(", ")}.` : "",
    "",
  ].filter(Boolean);

  const body = top
    .map((co) =>
      generateDynamicJustification({
        studentName: ctx.fullName,
        coId: co.coId,
        roleTitle: ctx.internship?.roleTitle ?? "",
        companyName: ctx.internship?.companyName ?? "",
        alignment: co,
        nlp: ctx.nlp,
        detailed,
      }),
    )
    .join("\n\n");

  return [...intro, body].join("\n");
}

function formatStudentSummary(ctx: StudentRetrievalContext): string {
  const i = ctx.internship;
  const topCo = ctx.profile.coAlignments[0];
  const topPo = [...ctx.profile.studentPOs].slice(0, 3).join(", ") || "—";
  const topPso = [...ctx.profile.studentPSOs].slice(0, 2).join(", ") || "—";

  const lines = [
    `Student: ${ctx.fullName}`,
    `USN: ${ctx.usn}`,
    i ? `Company: ${i.companyName}` : "Company: not on file",
    i ? `Role: ${i.roleTitle}` : "Role: not on file",
    "",
    "Performance:",
    `• ${marksSummaryLine(ctx)}`,
    "",
    "Strongest outcomes:",
    topCo ? `• ${topCo.coId} — ${topCo.title.split(".")[0] ?? topCo.title}` : "• —",
    `• PO: ${topPo}`,
    `• PSO: ${topPso}`,
    "",
    "Overall:",
    formatNaturalMapping(toOutcomeInput(ctx), ctx.profile),
  ];

  return lines.join("\n");
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
  wantsDetail: boolean,
): { answer: string; path: string } {
  const input = toOutcomeInput(ctx);
  const tech = getTopTechnologies(ctx.nlp);

  switch (intent) {
    case "outcomes_mapping":
      return wantsDetail
        ? { path: "compact_mapping", answer: formatCompactMapping(input, ctx.profile) }
        : { path: "natural_mapping", answer: formatNaturalMapping(input, ctx.profile) };
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
          detailed: wantsDetail,
        }),
      };
    }
    case "outcomes_co":
      return { path: "explain_co", answer: formatCoExplain(ctx, coId, wantsDetail) };
    case "outcomes_po":
      return wantsDetail
        ? { path: "list_po", answer: formatPoAnswer(input, ctx.profile) }
        : {
            path: "list_po_brief",
            answer: `${ctx.fullName}'s relevant POs: ${[...ctx.profile.studentPOs].join(", ") || "not recorded"}.`,
          };
    case "outcomes_pso":
      return wantsDetail
        ? { path: "list_pso", answer: formatPsoAnswer(input, ctx.profile) }
        : {
            path: "list_pso_brief",
            answer: `${ctx.fullName}'s relevant PSOs: ${[...ctx.profile.studentPSOs].join(", ") || "not recorded"}.`,
          };
    case "outcomes_justification":
      return { path: "justification", answer: formatJustification(ctx, wantsDetail) };
    case "sdg_alignment":
      return { path: "sdg", answer: formatSdgAlignment(ctx) };
    case "internship_analytics":
      return { path: "analytics", answer: formatAnalytics(ctx) };
    case "report_summary":
      return { path: "report_summary", answer: formatReportSummary(ctx, wantsDetail) };
    case "technologies_co":
      return { path: "technologies", answer: formatTechnologiesForCo(ctx, coId) };
    case "internship_company":
      return {
        path: "company",
        answer: ctx.internship
          ? `${ctx.fullName} (${ctx.usn}) is interning at ${ctx.internship.companyName}.`
          : `${ctx.fullName} (${ctx.usn}): company not found in imported records.`,
      };
    case "internship_stipend":
      return {
        path: "stipend",
        answer: `${ctx.fullName} (${ctx.usn}): stipend ${ctx.internship?.stipend ?? "not recorded"}.`,
      };
    case "internship_role":
      return {
        path: "role",
        answer: ctx.internship
          ? `${ctx.fullName} (${ctx.usn}) worked as ${ctx.internship.roleTitle} at ${ctx.internship.companyName}.`
          : `${ctx.fullName} (${ctx.usn}): role not found in records.`,
      };
    case "student_marks":
      return { path: "student_marks", answer: formatStudentMarksAnswer(ctx) };
    case "performance_analysis":
      return { path: "performance", answer: formatPerformanceSummary(ctx) };
    case "internship_summary":
      return { path: "internship_summary", answer: formatInternshipSummary(ctx) };
    case "top_outcomes":
      return { path: "top_outcomes", answer: formatTopOutcomes(input, ctx.profile) };
    case "student_summary":
      return { path: "student_summary", answer: formatStudentSummary(ctx) };
    case "outcomes_all":
      return {
        path: "full_co_dump",
        answer: formatFullOutcomeAnswer(input, ctx.profile, {
          nlpConfidence: ctx.nlp.scores.confidence,
          technologies: tech,
        }),
      };
    default:
      return { path: "unexpected_intent", answer: INVALID_MSG };
  }
}

export async function answerFromRetrieval(
  question: string,
  options?: { usn?: string; history?: string[]; turns?: ChatTurn[] },
): Promise<EngineResponse> {
  const parsed = parseUserQuery(question, {
    hintUsn: options?.usn,
    history: options?.history,
    turns: options?.turns,
  });

  const coId = parsed.coId ?? "CO1";
  const primaryUsn = resolvePrimaryUsn(parsed);
  const effectiveDetail = parsed.wantsDetail || parsed.expandPrevious;

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

    const answer = formatCompare(contexts);
    const debug = buildDebug(
      question,
      parsed,
      null,
      "compare",
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

  const { answer, path } = routeToFormatter(
    parsed.intent,
    ctx,
    question,
    coId,
    parsed.poId,
    effectiveDetail,
  );
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
