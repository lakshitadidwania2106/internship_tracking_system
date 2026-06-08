export type MarksRow = Record<string, string>;

export type ReviewNumber = 1 | 2 | 3;

export type StudentMarksRecord = {
  usn: string;
  fullName: string;
  finalRow: MarksRow;
  reviews: Partial<Record<ReviewNumber, MarksRow>>;
  hasFinalData: boolean;
  hasReviewData: Partial<Record<ReviewNumber, boolean>>;
};

export type DistributionBucket = {
  label: string;
  min: number;
  max: number;
  count: number;
  percent: number;
};

export type ColumnStats = {
  column: string;
  count: number;
  numericCount: number;
  min?: number;
  max?: number;
  average?: number;
  distribution?: DistributionBucket[];
};

export type MarksDistributionData = {
  students: StudentMarksRecord[];
  finalColumns: string[];
  reviewColumns: Record<ReviewNumber, string[]>;
  summary: {
    totalStudents: number;
    withFinalMarks: number;
    withReview1: number;
    withReview2: number;
    withReview3: number;
    averageFinal: number | null;
    minFinal: number | null;
    maxFinal: number | null;
  };
  finalTotalDistribution: DistributionBucket[];
  finalColumnStats: ColumnStats[];
  reviewColumnStats: Record<ReviewNumber, ColumnStats[]>;
};

const IDENTITY_COLUMNS = ["usn", "name", "student name", "s.no", "sl.no", "serial", "roll no"];

const META_COLUMNS = [
  "company",
  "stipend",
  "duration",
  "from date",
  "to date",
  "start date",
  "end date",
  "email",
  "phone",
  "relevant po",
  "relevant pso",
  "internship title",
  "internship role",
  "internship company",
  "domain( title)",
  "job role",
  "evaluator name",
  "evaluator names",
  "remarks",
  "status",
  "grade",
  "batch",
  "section",
  "department",
];

const GRADE_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "0–39", min: 0, max: 39 },
  { label: "40–49", min: 40, max: 49 },
  { label: "50–59", min: 50, max: 59 },
  { label: "60–69", min: 60, max: 69 },
  { label: "70–79", min: 70, max: 79 },
  { label: "80–89", min: 80, max: 89 },
  { label: "90–100", min: 90, max: 100 },
];

function formatCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  return `${value}`.trim();
}

export function formatColumnLabel(column: string): string {
  return column.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

function columnKey(column: string): string {
  return formatColumnLabel(column).toLowerCase();
}

export function isIdentityColumn(column: string): boolean {
  const norm = columnKey(column);
  return IDENTITY_COLUMNS.some((id) => norm === id || norm.startsWith(`${id} `));
}

function isMetaColumn(column: string): boolean {
  const norm = columnKey(column);
  if (norm.startsWith("evaluation.")) return false;
  return META_COLUMNS.some((kw) => norm === kw || norm.includes(kw));
}

/** All Excel columns to show (exact header text preserved). */
export function getExcelColumnsFromRow(row: MarksRow): string[] {
  return sortColumns(Object.keys(row).filter((col) => !isIdentityColumn(col)));
}

function sheetRecordToMarksRow(record: Record<string, unknown>): MarksRow {
  const row: MarksRow = {};
  for (const [key, value] of Object.entries(record)) {
    const k = `${key}`;
    if (!k.trim() || isIdentityColumn(k) || isMetaColumn(k)) continue;
    row[k] = formatCell(value);
  }
  return row;
}

function applyEvaluationFallback(row: MarksRow, evaluation: unknown): void {
  if (!evaluation || typeof evaluation !== "object") return;
  const e = evaluation as Record<string, unknown>;
  const pairs: Array<[string, string]> = [
    ["evaluation.totalMarks", formatCell(e.totalMarks)],
    ["evaluation.reducedMarks", formatCell(e.reducedMarks)],
    ["evaluation.reportMarks", formatCell(e.reportMarks)],
    ["evaluation.presentationMarks", formatCell(e.presentationMarks)],
  ];
  for (const [key, value] of pairs) {
    if (!value) continue;
    const hasTotal = Object.keys(row).some((k) => /total/i.test(k) && /100|max/i.test(k));
    const hasReduced = Object.keys(row).some((k) => /reduced/i.test(k));
    if (key.includes("total") && hasTotal) continue;
    if (key.includes("reduced") && hasReduced) continue;
    if (!row[key]) row[key] = value;
  }
}

/** Final marks: prefer `finalMarksSheet` from Excel import; merge evaluation fallbacks. */
export function extractFinalMarksRow(sourceRowRawJson?: string | null): MarksRow {
  if (!sourceRowRawJson) return {};
  try {
    const parsed = JSON.parse(sourceRowRawJson) as Record<string, unknown>;
    let row: MarksRow = {};

    if (parsed.finalMarksSheet && typeof parsed.finalMarksSheet === "object") {
      row = sheetRecordToMarksRow(parsed.finalMarksSheet as Record<string, unknown>);
    }

    if (Object.keys(row).length === 0 && parsed.internshipSheet && typeof parsed.internshipSheet === "object") {
      row = sheetRecordToMarksRow(parsed.internshipSheet as Record<string, unknown>);
    }

    if (Object.keys(row).length === 0) {
      for (const [key, value] of Object.entries(parsed)) {
        if (key === "evaluation" || key === "internshipSheet" || key === "finalMarksSheet") continue;
        if (isIdentityColumn(key) || isMetaColumn(key)) continue;
        row[key] = formatCell(value);
      }
    }

    applyEvaluationFallback(row, parsed.evaluation);
    return row;
  } catch {
    return {};
  }
}

function extractReviewRow(rowJson: string): MarksRow {
  try {
    const parsed = JSON.parse(rowJson) as Record<string, unknown>;
    const row: MarksRow = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isIdentityColumn(key)) continue;
      row[`${key}`] = formatCell(value);
    }
    return row;
  } catch {
    return {};
  }
}

function rowHasValues(row: MarksRow): boolean {
  return Object.values(row).some((v) => v.trim().length > 0);
}

function parseNumeric(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const cleaned = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function readMarkByPattern(row: MarksRow, matcher: (norm: string) => boolean): string | null {
  for (const [key, value] of Object.entries(row)) {
    if (matcher(columnKey(key)) && value.trim()) return value.trim();
  }
  return null;
}

export function extractFinalTotal(row: MarksRow, semester?: number): number | null {
  const sem6First =
    semester === 6
      ? readMarkByPattern(row, (n) => /marks\s*\(\s*100\s*\)/i.test(n)) ??
        readMarkByPattern(
          row,
          (n) => n === "total" && !n.includes("reduced") && !n.includes("("),
        )
      : null;

  const totalStr =
    sem6First ??
    readMarkByPattern(
      row,
      (n) =>
        (n.includes("total") || n.includes("grand") || n.includes("max")) &&
        (n.includes("100") || n.includes("marks") || n.includes("max-100") || n.includes("max 100")) &&
        !n.includes("reduced"),
    ) ??
    readMarkByPattern(
      row,
      (n) => (n === "total" || n.includes("grand total") || n === "max-100") && !n.includes("reduced"),
    ) ??
    readMarkByPattern(row, (n) => /marks\s*\(\s*100\s*\)/i.test(n)) ??
    row["evaluation.totalMarks"];
  const num = parseNumeric(totalStr ?? undefined);
  if (num !== null && num >= 0 && num <= 100) return num;
  return null;
}

export function extractReducedMarks(row: MarksRow): string | null {
  return (
    readMarkByPattern(row, (n) => n.includes("reduced")) ??
    row["evaluation.reducedMarks"]?.trim() ??
    null
  );
}

export function findColumnByPattern(row: MarksRow, pattern: RegExp): string | undefined {
  return Object.keys(row).find((key) => pattern.test(columnKey(key)));
}

export function hasAnyMarksData(record: StudentMarksRecord): boolean {
  return record.hasFinalData || ([1, 2, 3] as ReviewNumber[]).some((n) => record.hasReviewData[n]);
}

function sortColumns(columns: Iterable<string>): string[] {
  const list = [...new Set([...columns].map((c) => `${c}`.trim()).filter(Boolean))];
  return list.sort((a, b) => {
    const aNorm = columnKey(a);
    const bNorm = columnKey(b);
    const aReduced = aNorm.includes("reduced");
    const bReduced = bNorm.includes("reduced");
    if (aReduced && !bReduced) return 1;
    if (!aReduced && bReduced) return -1;
    const aTotal = aNorm.includes("total") || aNorm.includes("grand");
    const bTotal = bNorm.includes("total") || bNorm.includes("grand");
    if (aTotal && !bTotal) return 1;
    if (!aTotal && bTotal) return -1;
    return formatColumnLabel(a).localeCompare(formatColumnLabel(b), undefined, { sensitivity: "base" });
  });
}

function collectColumnsFromRows(rows: MarksRow[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!isIdentityColumn(key)) keys.add(key);
    }
  }
  return sortColumns(keys);
}

function buildDistribution(values: number[]): DistributionBucket[] {
  if (values.length === 0) {
    return GRADE_BUCKETS.map((bucket) => ({ ...bucket, count: 0, percent: 0 }));
  }
  return GRADE_BUCKETS.map((bucket) => {
    const count = values.filter((value) => value >= bucket.min && value <= bucket.max).length;
    return {
      ...bucket,
      count,
      percent: Math.round((count / values.length) * 100),
    };
  });
}

function buildColumnStats(column: string, rows: MarksRow[]): ColumnStats {
  const values = rows
    .map((row) => getCellValue(row, column))
    .filter((v) => v !== "—" && v.trim().length > 0);
  const numericValues = values
    .map((value) => parseNumeric(value))
    .filter((value): value is number => value !== null);

  const stats: ColumnStats = {
    column,
    count: values.length,
    numericCount: numericValues.length,
  };

  if (numericValues.length > 0) {
    stats.min = Math.min(...numericValues);
    stats.max = Math.max(...numericValues);
    stats.average = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
    stats.distribution = buildDistribution(numericValues);
  }

  return stats;
}

export type StudentWithMarks = {
  usn: string;
  fullName: string;
  batch?: { year: number };
  semesterRecord?: { semester: number };
  internship?: { sourceRowRawJson: string | null; grade?: string | null } | null;
  reviewMarks?: Array<{ reviewNumber: number; rowJson: string }>;
};

function applyGradeFallback(row: MarksRow, grade?: string | null, semester?: number): void {
  if (extractFinalTotal(row, semester) !== null) return;
  const match = grade?.match(/total\s*:\s*([\d.]+)/i);
  if (match?.[1]) {
    row["evaluation.totalMarks"] = match[1];
  }
}

/** When final marks sheet is empty, merge the latest review row (e.g. batch 2020). */
function applyReviewMarksFallback(
  finalRow: MarksRow,
  reviews: Partial<Record<ReviewNumber, MarksRow>>,
  semester?: number,
): void {
  if (rowHasValues(finalRow) && extractFinalTotal(finalRow, semester) !== null) {
    return;
  }

  for (const reviewNumber of [3, 2, 1] as ReviewNumber[]) {
    const reviewRow = reviews[reviewNumber];
    if (!reviewRow || !rowHasValues(reviewRow)) continue;

    for (const [key, value] of Object.entries(reviewRow)) {
      if (!finalRow[key]?.trim()) {
        finalRow[key] = value;
      }
    }

    if (extractFinalTotal(finalRow, semester) !== null) {
      return;
    }
  }
}

export function buildStudentMarksRecord(
  student: StudentWithMarks,
  semester?: number,
): StudentMarksRecord {
  const reviews: Partial<Record<ReviewNumber, MarksRow>> = {};
  const hasReviewData: Partial<Record<ReviewNumber, boolean>> = {};

  for (const mark of student.reviewMarks ?? []) {
    if (mark.reviewNumber >= 1 && mark.reviewNumber <= 3) {
      const row = extractReviewRow(mark.rowJson);
      reviews[mark.reviewNumber as ReviewNumber] = row;
      hasReviewData[mark.reviewNumber as ReviewNumber] = rowHasValues(row);
    }
  }

  const viewSemester = semester ?? student.semesterRecord?.semester;
  const finalRow = extractFinalMarksRow(student.internship?.sourceRowRawJson);
  applyReviewMarksFallback(finalRow, reviews, viewSemester);
  applyGradeFallback(finalRow, student.internship?.grade, viewSemester);
  const hasFinalData =
    rowHasValues(finalRow) || extractFinalTotal(finalRow, viewSemester) !== null;

  return {
    usn: student.usn,
    fullName: student.fullName,
    finalRow,
    reviews,
    hasFinalData,
    hasReviewData,
  };
}

export function buildMarksDistributionData(
  students: StudentWithMarks[],
  semester?: number,
): MarksDistributionData {
  const studentRecords: StudentMarksRecord[] = students.map((s) =>
    buildStudentMarksRecord(s, semester),
  );

  const finalColumns = collectColumnsFromRows(studentRecords.map((s) => s.finalRow));
  const reviewColumns: Record<ReviewNumber, string[]> = {
    1: collectColumnsFromRows(studentRecords.map((s) => s.reviews[1] ?? {})),
    2: collectColumnsFromRows(studentRecords.map((s) => s.reviews[2] ?? {})),
    3: collectColumnsFromRows(studentRecords.map((s) => s.reviews[3] ?? {})),
  };

  const finalTotals = studentRecords
    .map((s) => extractFinalTotal(s.finalRow, semester))
    .filter((value): value is number => value !== null);

  const withReview = (reviewNumber: ReviewNumber) =>
    studentRecords.filter((s) => s.hasReviewData[reviewNumber]).length;

  return {
    students: studentRecords,
    finalColumns,
    reviewColumns,
    summary: {
      totalStudents: studentRecords.length,
      withFinalMarks: studentRecords.filter((s) => s.hasFinalData).length,
      withReview1: withReview(1),
      withReview2: withReview(2),
      withReview3: withReview(3),
      averageFinal:
        finalTotals.length > 0
          ? finalTotals.reduce((sum, value) => sum + value, 0) / finalTotals.length
          : null,
      minFinal: finalTotals.length > 0 ? Math.min(...finalTotals) : null,
      maxFinal: finalTotals.length > 0 ? Math.max(...finalTotals) : null,
    },
    finalTotalDistribution: buildDistribution(finalTotals),
    finalColumnStats: finalColumns.map((column) =>
      buildColumnStats(column, studentRecords.map((s) => s.finalRow)),
    ),
    reviewColumnStats: {
      1: reviewColumns[1].map((column) =>
        buildColumnStats(column, studentRecords.map((s) => s.reviews[1] ?? {})),
      ),
      2: reviewColumns[2].map((column) =>
        buildColumnStats(column, studentRecords.map((s) => s.reviews[2] ?? {})),
      ),
      3: reviewColumns[3].map((column) =>
        buildColumnStats(column, studentRecords.map((s) => s.reviews[3] ?? {})),
      ),
    },
  };
}

export function getCellValue(row: MarksRow | undefined, column: string): string {
  if (!row) return "—";
  if (row[column]?.trim()) return row[column];
  const target = columnKey(column);
  for (const [key, value] of Object.entries(row)) {
    if (columnKey(key) === target && value?.trim()) return value;
  }
  return "—";
}

/** @deprecated use getExcelColumnsFromRow */
export function getMarksColumnsFromRow(row: MarksRow): string[] {
  return getExcelColumnsFromRow(row);
}
