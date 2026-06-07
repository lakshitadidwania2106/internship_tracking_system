export const BATCH_SEMESTER_MAP: Record<number, number[]> = {
  2020: [8],
  2021: [4, 6, 8],
  2022: [8],
};

/** Semester options shown in the dashboard filter (always both). */
export const DASHBOARD_SEMESTER_OPTIONS = [6, 8] as const;

export const COURSE_DETAILS: Record<
  string,
  { code: string; name: string; credits: number }
> = {
  "2020-8": {
    code: "21AIL84",
    name: "Student Internship",
    credits: 3,
  },
  "2021-4": {
    code: "21AIL46",
    name: "Industry Internship Preparation",
    credits: 2,
  },
  "2021-6": {
    code: "21AIL64",
    name: "Internship",
    credits: 4,
  },
  "2021-8": {
    code: "21INT82",
    name: "Internship (Sem 8)",
    credits: 4,
  },
};

export const DASHBOARD_LINKS = [
  "Overview",
  "Students",
  "Internships",
  "Marks Distribution",
  "Status",
  "Data Management",
  "Settings",
];

export const MARK_UPLOAD_KINDS = [
  "review_1",
  "review_2",
  "review_3",
  "final",
  "internship_details",
] as const;

export type MarkUploadKind = (typeof MARK_UPLOAD_KINDS)[number];

/** Default sheet/header hints for faculty uploads (matches data/imports/excel layouts). */
export type MarksImportPreset = {
  sheetName?: string;
  headerRowIndex?: number;
  headerRowSpan?: number;
};

type MarksPresetKey = `${number}-${number}-${MarkUploadKind}`;

/** Default sheet + header row when uploading marks (matches import scripts). */
export const MARKS_IMPORT_PRESETS: Partial<Record<MarksPresetKey, MarksImportPreset>> = {
  "2020-8-final": { sheetName: "Marks Evaluation", headerRowIndex: 6, headerRowSpan: 2 },
  "2020-8-internship_details": { sheetName: "sem 8  2020 batch", headerRowIndex: 0 },
  "2020-8-review_1": { sheetName: "Review 1" },
  "2021-6-final": { sheetName: "MarkSheet", headerRowIndex: 4 },
  "2021-6-internship_details": { sheetName: "SEM 6", headerRowIndex: 4 },
  "2021-8-final": { sheetName: "Sheet1", headerRowIndex: 0 },
  "2021-8-internship_details": { sheetName: "DETAILS", headerRowIndex: 0 },
  "2021-8-review_1": { sheetName: "INTERN EVAL SHEET R1" },
  "2021-8-review_2": { sheetName: "INTERN EVAL SHEET R2 " },
};

export function getMarksImportPreset(
  batchYear: number,
  semester: number,
  markKind: MarkUploadKind,
): MarksImportPreset {
  const key = `${batchYear}-${semester}-${markKind}` as MarksPresetKey;
  return MARKS_IMPORT_PRESETS[key] ?? {};
}

export const STORED_FILE_KIND = {
  REVIEW_1_XLSX: "review_1_xlsx",
  REVIEW_2_XLSX: "review_2_xlsx",
  REVIEW_3_XLSX: "review_3_xlsx",
  FINAL_MARKS_XLSX: "final_marks_xlsx",
  INTERNSHIP_DETAILS_XLSX: "internship_details_xlsx",
  REPORTS_ZIP: "reports_zip",
} as const;
