export const BATCH_SEMESTER_MAP: Record<number, number[]> = {
  2020: [8],
  2021: [4, 6],
};

export const COURSE_DETAILS: Record<string, { code: string; name: string; credits: number }> = {
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
};

export const DASHBOARD_LINKS = [
  "Overview",
  "Students",
  "Internships",
  "Analytics",
  "Settings",
];
