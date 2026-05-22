import {
  classifyIntent,
  extractCoId,
  refineIntent,
  type ChatIntent,
} from "@/lib/ai/naive-bayes-intent";
import {
  buildStudentOutcomeProfile,
  formatCoAnswer,
  formatFullOutcomeAnswer,
  formatJustificationAnswer,
  formatPoAnswer,
  formatPsoAnswer,
  type StudentOutcomeInput,
} from "@/lib/ai/student-outcomes";

export type MlChatbotResult = {
  mode: "ml-model";
  intent: ChatIntent;
  confidence: number;
  answer: string;
  studentUsn?: string;
};

const OUTCOME_INTENTS: ChatIntent[] = [
  "outcomes_all",
  "outcomes_co",
  "outcomes_po",
  "outcomes_pso",
  "outcomes_justification",
];

export function isOutcomeQuestion(intent: ChatIntent): boolean {
  return OUTCOME_INTENTS.includes(intent);
}

export function answerWithMlModel(
  question: string,
  student: StudentOutcomeInput,
): MlChatbotResult {
  const { intent: mlIntent, confidence: mlConfidence } = classifyIntent(question);
  const intent = refineIntent(question, mlIntent);
  const profile = buildStudentOutcomeProfile(student);
  const coId = extractCoId(question);

  let answer: string;
  switch (intent) {
    case "outcomes_co":
      answer = formatCoAnswer(student, profile, coId ?? profile.coAlignments[0]?.coId ?? "CO1");
      break;
    case "outcomes_po":
      answer = formatPoAnswer(student, profile);
      break;
    case "outcomes_pso":
      answer = formatPsoAnswer(student, profile);
      break;
    case "outcomes_justification":
      answer = formatJustificationAnswer(student, profile);
      break;
    case "outcomes_all":
      answer = formatFullOutcomeAnswer(student, profile);
      break;
    case "internship_company":
      answer = `${student.fullName} (${student.usn}) interned at ${student.internship?.companyName ?? "company not in records"}.`;
      break;
    case "internship_stipend":
      answer = `Open the student overview for stipend details for ${student.usn}.`;
      break;
    case "internship_role":
      answer = `${student.fullName} (${student.usn}) role: ${student.internship?.roleTitle ?? "not recorded"}.`;
      break;
    default:
      answer = formatFullOutcomeAnswer(student, profile);
      break;
  }

  return {
    mode: "ml-model",
    intent,
    confidence: mlConfidence,
    answer,
    studentUsn: student.usn,
  };
}
