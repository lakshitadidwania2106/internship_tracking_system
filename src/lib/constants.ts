export const BATCH_SEMESTER_MAP: Record<number, number[]> = {
  2020: [8],
  2021: [4, 6, 8],
  2022: [8],
};

export const COURSE_DETAILS: Record<
  string,
  { code: string; name: string; credits: number }
> = {
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

export const STORED_FILE_KIND = {
  REVIEW_1_XLSX: "review_1_xlsx",
  REVIEW_2_XLSX: "review_2_xlsx",
  REVIEW_3_XLSX: "review_3_xlsx",
  FINAL_MARKS_XLSX: "final_marks_xlsx",
  INTERNSHIP_DETAILS_XLSX: "internship_details_xlsx",
  REPORTS_ZIP: "reports_zip",
} as const;