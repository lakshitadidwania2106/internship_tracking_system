import { getStudentByUsn } from "@/lib/data";

type StudentWithRelations = NonNullable<Awaited<ReturnType<typeof getStudentByUsn>>>;

function readEvaluation(rawJson?: string | null) {
  if (!rawJson) return {};
  try {
    const parsed = JSON.parse(rawJson) as {
      evaluation?: {
        totalMarks?: string;
        reportMarks?: string;
        presentationMarks?: string;
        evaluatorName?: string;
        internshipTitle?: string;
      };
      ["INTERNSHIP TITLE"]?: string;
    };
    return {
      totalMarks: parsed.evaluation?.totalMarks,
      reportMarks: parsed.evaluation?.reportMarks,
      presentationMarks: parsed.evaluation?.presentationMarks,
      evaluatorName: parsed.evaluation?.evaluatorName,
      internshipTitle: parsed.evaluation?.internshipTitle ?? parsed["INTERNSHIP TITLE"],
    };
  } catch {
    return {};
  }
}

function buildRuleBasedSummary(student: StudentWithRelations): string {
  const internship = student.internship;
  const evalData = readEvaluation(internship?.sourceRowRawJson);
  const duration =
    internship?.durationText?.trim() ||
    [internship?.startDateRaw, internship?.endDateRaw].filter(Boolean).join(" to ") ||
    "the scheduled period";

  const company = internship?.companyName?.trim() || "an organization (company not recorded)";
  const role = internship?.roleTitle?.trim() || "an intern role";
  const title = evalData.internshipTitle?.trim();

  const parts: string[] = [
    `${student.fullName} (${student.usn}) completed the ${student.semesterRecord.courseName} internship (${student.semesterRecord.courseCode}) for batch ${student.batch.year}, semester ${student.semesterRecord.semester}.`,
    title
      ? `Their project focus was "${title}".`
      : `They worked in the ${role} capacity.`,
    `The internship was at ${company}${role && !title ? ` as ${role}` : ""}, spanning ${duration}.`,
  ];

  const stipend = internship?.stipend?.trim();
  if (stipend && stipend !== "-" && stipend.toLowerCase() !== "no") {
    parts.push(`Stipend status: ${stipend}.`);
  }

  if (evalData.totalMarks) {
    parts.push(
      `Final evaluation recorded total marks of ${evalData.totalMarks}` +
        (evalData.reportMarks || evalData.presentationMarks
          ? ` (report ${evalData.reportMarks ?? "-"}, presentation ${evalData.presentationMarks ?? "-"})`
          : "") +
        (evalData.evaluatorName ? `, assessed by ${evalData.evaluatorName}` : "") +
        ".",
    );
  }

  if (student.mapping?.relevantPOs || student.mapping?.relevantPSOs) {
    parts.push(
      `Outcome mapping highlights POs: ${student.mapping.relevantPOs ?? "—"} and PSOs: ${student.mapping.relevantPSOs ?? "—"}.`,
    );
  }

  if (student.reviewMarks.length > 0) {
    parts.push(
      `Progress reviews on file: ${student.reviewMarks.map((m) => `Review ${m.reviewNumber}`).join(", ")}.`,
    );
  }

  if (student.documents.some((d) => d.storageKey)) {
    parts.push("An internship report PDF is available in the document repository.");
  }

  return parts.join(" ");
}

async function askOllamaForSummary(context: string) {
  const prompt = [
    "You write concise faculty-facing internship summaries (3-5 sentences).",
    "Use only facts from the context. Do not invent companies, dates, or marks.",
    "Write in third person past tense. Be specific and professional.",
    `Context:\n${context}`,
    "Write the internship summary:",
  ].join("\n\n");

  const response = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL ?? "llama3.2",
      prompt,
      stream: false,
      options: { temperature: 0.2 },
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { response?: string };
  return data.response?.trim() ?? null;
}

export async function generateStudentInternshipSummary(usn: string) {
  const student = await getStudentByUsn(usn);
  if (!student) {
    return { found: false as const, summary: "" };
  }

  const ruleSummary = buildRuleBasedSummary(student);

  try {
    const aiSummary = await askOllamaForSummary(ruleSummary);
    if (aiSummary && aiSummary.length > 40) {
      return { found: true as const, summary: aiSummary, mode: "ollama" as const };
    }
  } catch {
    // Use rule-based fallback.
  }

  return { found: true as const, summary: ruleSummary, mode: "rule-based" as const };
}
