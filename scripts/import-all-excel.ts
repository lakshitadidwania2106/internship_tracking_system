import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { COURSE_DETAILS } from "../src/lib/constants";
import { importExcelFile, type ImportMode } from "../src/lib/importer";
import { prisma } from "../src/lib/prisma";

type ImportConfig = {
  batchYear: number;
  semester: number;
  /** Path under data/imports/excel/ */
  file: string;
  sheet?: string;
  headerRowIndex?: number;
  mode?: ImportMode;
  reviewNumber?: 1 | 2 | 3;
};

const excelRoot = path.join(process.cwd(), "data", "imports", "excel");

const importConfigs: ImportConfig[] = [
  // —— 2020 batch (sem 8) ——
  {
    batchYear: 2020,
    semester: 8,
    file: "2020/20AI8ICINT- 2020 batch internship details sem 8.xlsx",
    sheet: "sem 8  2020 batch",
    mode: "internship",
  },
  {
    batchYear: 2020,
    semester: 8,
    file: "2020/20AI8ICINT- 2020 final marks.xlsx",
    sheet: "Final Marks",
    mode: "marks",
  },
  {
    batchYear: 2020,
    semester: 8,
    file: "2020/20AI8ICINT- 2020 batch review 1 markings.xlsx",
    sheet: "Review 1",
    reviewNumber: 1,
  },
  {
    batchYear: 2020,
    semester: 8,
    file: "2020/CES for 20AI8ICNT 2020 batch.xlsx",
    sheet: "CES",
    mode: "marks",
  },
  // —— 2021 batch (sem 8 first; sem 6 last so shared USNs stay on sem 6) ——
  {
    batchYear: 2021,
    semester: 8,
    file: "2021/21INT82- internship details 2021 batch sem 8.xlsx",
    sheet: "INTERNSHIP DETAILS",
    mode: "internship",
  },
  {
    batchYear: 2021,
    semester: 8,
    file: "2021/21INT82- 2021 sem 8 final markings.xlsx",
    sheet: "CSV SHEET",
    mode: "marks",
  },
  {
    batchYear: 2021,
    semester: 8,
    file: "2021/21INT82- 2021 sem8 markings review 1.xlsx",
    sheet: "INTERN EVAL SHEET R1",
    reviewNumber: 1,
  },
  {
    batchYear: 2021,
    semester: 8,
    file: "2021/21INT82- 2021 sem 8 markings- review 2.xlsx",
    sheet: "INTERN EVAL SHEET R2 ",
    reviewNumber: 2,
  },
  {
    batchYear: 2021,
    semester: 8,
    file: "2021/21INT82- 2021 sem 8 CES.xlsx",
    sheet: "CES",
    mode: "marks",
  },
  {
    batchYear: 2021,
    semester: 6,
    file: "2021/21INT68-intership sem6 final marks 2021.xlsx",
    mode: "marks",
  },
];

async function importFile(config: ImportConfig) {
  const filePath = path.join(excelRoot, config.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping missing file: ${filePath}`);
    return null;
  }

  const course = COURSE_DETAILS[`${config.batchYear}-${config.semester}`];
  const result = await importExcelFile({
    filePath,
    batchYear: config.batchYear,
    semester: config.semester,
    sheetName: config.sheet,
    headerRowIndex: config.headerRowIndex,
    mode: config.mode,
    reviewNumber: config.reviewNumber,
    courseCode: course?.code,
    courseName: course?.name,
    credits: course?.credits,
  });

  console.log(
    `[${config.batchYear} sem ${config.semester}] ${path.basename(config.file)} → ${result.imported}/${result.rowsRead} (${result.sheetName})`,
  );
  return result;
}

async function main() {
  console.log("Excel root:", excelRoot);
  console.log("Database:", process.env.DATABASE_URL ?? "file:./dev.db");
  for (const config of importConfigs) {
    await importFile(config);
  }
  console.log("Done.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
