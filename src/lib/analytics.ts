import {
  buildMarksDistributionData,
  buildStudentMarksRecord,
  extractFinalTotal,
  extractReducedMarks,
  formatColumnLabel,
  type StudentWithMarks,
} from "@/lib/marks-distribution";

export type ChartBucket = {
  label: string;
  count: number;
  percent: number;
};

export type SkillAverage = {
  skill: string;
  column: string;
  average: number;
  maxScore: number;
  count: number;
};

export type DashboardAnalytics = {
  overview: {
    totalStudents: number;
    totalInternships: number;
    averageMarks: number | null;
    highestMarks: number | null;
    lowestMarks: number | null;
    passPercentage: number | null;
    reviewCompletionPercentage: number | null;
    withFinalMarks: number;
    withReview1: number;
    withReview2: number;
    withReview3: number;
  };
  marksHistogram: ChartBucket[];
  gradeCategories: ChartBucket[];
  reviewAverages: {
    review1: number | null;
    review2: number | null;
    review3: number | null;
    final: number | null;
  };
  reviewProgress: Array<{ stage: string; average: number | null; count: number }>;
  skillAverages: SkillAverage[];
  internship: {
    withInternship: number;
    withoutInternship: number;
    completionPercent: number;
  };
};

const HISTOGRAM_BUCKETS = [
  { label: "0–40", min: 0, max: 40 },
  { label: "41–60", min: 41, max: 60 },
  { label: "61–80", min: 61, max: 80 },
  { label: "81–100", min: 81, max: 100 },
];

const GRADE_CATEGORIES = [
  { label: "Excellent (90–100)", min: 90, max: 100 },
  { label: "Good (75–89)", min: 75, max: 89 },
  { label: "Average (60–74)", min: 60, max: 74 },
  { label: "Needs Improvement (<60)", min: 0, max: 59 },
];

const SKILL_MATCHERS: Array<{ skill: string; test: (col: string) => boolean; maxScore: number }> = [
  { skill: "Problem Solving", test: (c) => /problem/i.test(c), maxScore: 10 },
  { skill: "Research", test: (c) => /^research|\bresearch\b/i.test(c), maxScore: 10 },
  { skill: "Technical Skills", test: (c) => /technical/i.test(c), maxScore: 10 },
  { skill: "Communication Skills", test: (c) => /communication/i.test(c), maxScore: 10 },
  { skill: "Decision Making", test: (c) => /decision/i.test(c), maxScore: 10 },
  { skill: "Teamwork", test: (c) => /team\s*work|teamwork/i.test(c), maxScore: 10 },
  { skill: "Presentation", test: (c) => /presentation/i.test(c), maxScore: 10 },
  { skill: "Report", test: (c) => /^report|\breport\b/i.test(c), maxScore: 10 },
];

function parseNumeric(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const cleaned = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function bucketize(values: number[], buckets: Array<{ label: string; min: number; max: number }>): ChartBucket[] {
  if (values.length === 0) {
    return buckets.map((b) => ({ label: b.label, count: 0, percent: 0 }));
  }
  return buckets.map((bucket) => {
    const count = values.filter((v) => v >= bucket.min && v <= bucket.max).length;
    return {
      label: bucket.label,
      count,
      percent: Math.round((count / values.length) * 100),
    };
  });
}

function averageReviewTotal(
  students: StudentWithMarks[],
  reviewNumber: 1 | 2 | 3,
  semester?: number,
): number | null {
  const totals: number[] = [];
  for (const student of students) {
    const record = buildStudentMarksRecord(student, semester);
    const row = record.reviews[reviewNumber];
    if (!row) continue;
    const total = extractFinalTotal(row, semester);
    if (total !== null) totals.push(total);
  }
  if (totals.length === 0) return null;
  return totals.reduce((s, v) => s + v, 0) / totals.length;
}

function buildSkillAverages(students: StudentWithMarks[], semester?: number): SkillAverage[] {
  const records = students.map((s) => buildStudentMarksRecord(s, semester));
  const allColumns = new Set<string>();
  for (const r of records) {
    for (const col of Object.keys(r.finalRow)) allColumns.add(col);
  }

  const results: SkillAverage[] = [];

  for (const matcher of SKILL_MATCHERS) {
    const column = [...allColumns].find((col) => matcher.test(formatColumnLabel(col).toLowerCase()));
    if (!column) continue;

    const values: number[] = [];
    for (const r of records) {
      const raw = r.finalRow[column];
      const num = parseNumeric(raw);
      if (num !== null) values.push(num);
    }
    if (values.length === 0) continue;

    results.push({
      skill: matcher.skill,
      column: formatColumnLabel(column),
      average: values.reduce((s, v) => s + v, 0) / values.length,
      maxScore: matcher.maxScore,
      count: values.length,
    });
  }

  return results.sort((a, b) => b.average - a.average);
}

export type BatchCohortSummary = {
  batchYear: number;
  semester: number;
  totalStudents: number;
  totalInternships: number;
  averageMarks: number | null;
  passPercentage: number | null;
  completionPercent: number;
};

export function buildDashboardAnalytics(
  students: StudentWithMarks[],
  internshipCount: number,
  semester?: number,
): DashboardAnalytics {
  const distribution = buildMarksDistributionData(students, semester);
  const records = distribution.students;

  const finalTotals = records
    .map((r) => extractFinalTotal(r.finalRow))
    .filter((v): v is number => v !== null);

  const passCount = finalTotals.filter((v) => v >= 40).length;
  const allThreeReviews = records.filter(
    (r) => r.hasReviewData[1] && r.hasReviewData[2] && r.hasReviewData[3],
  ).length;

  const review1Avg = averageReviewTotal(students, 1, semester);
  const review2Avg = averageReviewTotal(students, 2, semester);
  const review3Avg = averageReviewTotal(students, 3, semester);
  const finalAvg = distribution.summary.averageFinal;

  const withInternship = internshipCount;
  const withoutInternship = Math.max(students.length - internshipCount, 0);

  return {
    overview: {
      totalStudents: students.length,
      totalInternships: internshipCount,
      averageMarks: finalAvg,
      highestMarks: distribution.summary.maxFinal,
      lowestMarks: distribution.summary.minFinal,
      passPercentage:
        finalTotals.length > 0 ? Math.round((passCount / finalTotals.length) * 100) : null,
      reviewCompletionPercentage:
        students.length > 0 ? Math.round((allThreeReviews / students.length) * 100) : null,
      withFinalMarks: distribution.summary.withFinalMarks,
      withReview1: distribution.summary.withReview1,
      withReview2: distribution.summary.withReview2,
      withReview3: distribution.summary.withReview3,
    },
    marksHistogram: bucketize(finalTotals, HISTOGRAM_BUCKETS),
    gradeCategories: bucketize(finalTotals, GRADE_CATEGORIES),
    reviewAverages: {
      review1: review1Avg,
      review2: review2Avg,
      review3: review3Avg,
      final: finalAvg,
    },
    reviewProgress: [
      { stage: "Review 1", average: review1Avg, count: distribution.summary.withReview1 },
      { stage: "Review 2", average: review2Avg, count: distribution.summary.withReview2 },
      { stage: "Review 3", average: review3Avg, count: distribution.summary.withReview3 },
      { stage: "Final", average: finalAvg, count: distribution.summary.withFinalMarks },
    ],
    skillAverages: buildSkillAverages(students, semester),
    internship: {
      withInternship,
      withoutInternship,
      completionPercent:
        students.length > 0 ? Math.round((withInternship / students.length) * 100) : 0,
    },
  };
}

export type StudentProfileAnalytics = {
  usn: string;
  fullName: string;
  batchYear: number;
  semester: number;
  company: string;
  role: string;
  finalTotal: number | null;
  reducedMarks: string | null;
  timeline: Array<{
    stage: string;
    marks: number | null;
    available: boolean;
    skills: Array<{ label: string; value: string }>;
  }>;
  skillScores: Array<{ skill: string; value: number; max: number }>;
};

export function buildStudentProfileAnalytics(
  student: StudentWithMarks & {
    internship?: {
      companyName?: string | null;
      roleTitle?: string | null;
      sourceRowRawJson?: string | null;
    } | null;
  },
  batchYear: number,
  semester: number,
): StudentProfileAnalytics {
  const record = buildStudentMarksRecord(student, semester);

  const pickSkillCells = (row: Record<string, string>) => {
    const cells: Array<{ label: string; value: string }> = [];
    for (const matcher of SKILL_MATCHERS) {
      const col = Object.keys(row).find((c) => matcher.test(formatColumnLabel(c).toLowerCase()));
      if (col && row[col]?.trim()) {
        cells.push({ label: matcher.skill, value: row[col] });
      }
    }
    return cells.slice(0, 6);
  };

  const timeline = ([1, 2, 3] as const).map((n) => ({
    stage: `Review ${n}`,
    marks: record.reviews[n] ? extractFinalTotal(record.reviews[n]!, semester) : null,
    available: Boolean(record.hasReviewData[n]),
    skills: record.reviews[n] ? pickSkillCells(record.reviews[n]!) : [],
  }));

  timeline.push({
    stage: "Final Marks",
    marks: extractFinalTotal(record.finalRow, semester),
    available: record.hasFinalData,
    skills: pickSkillCells(record.finalRow),
  });

  const skillScores = SKILL_MATCHERS.map((matcher) => {
    const col = Object.keys(record.finalRow).find((c) =>
      matcher.test(formatColumnLabel(c).toLowerCase()),
    );
    const num = col ? parseNumeric(record.finalRow[col]) : null;
    return num !== null
      ? { skill: matcher.skill, value: num, max: matcher.maxScore }
      : null;
  }).filter((s): s is { skill: string; value: number; max: number } => s !== null);

  return {
    usn: student.usn,
    fullName: student.fullName,
    batchYear,
    semester,
    company: student.internship?.companyName ?? "—",
    role: student.internship?.roleTitle ?? "—",
    finalTotal: extractFinalTotal(record.finalRow, semester),
    reducedMarks: extractReducedMarks(record.finalRow),
    timeline,
    skillScores,
  };
}

