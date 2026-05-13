import fs from "node:fs";
import path from "node:path";
import { COURSE_DETAILS } from "../src/lib/constants";
import { importExcelFile } from "../src/lib/importer";

type ImportConfig = {
  batchYear: number;
  semester: number;
  file: string;
  sheet?: string;
  headerRowIndex?: number;
  mode?: "internship" | "marks";
};

const excelRoot = path.join(process.cwd(), "data", "imports", "excel");

const importConfigs: ImportConfig[] = [
  {
    batchYear: 2020,
    semester: 8,
    file: "INTERNSHIP EVALUATION SHEET.xlsx",
    sheet: "sem 8  2020 batch",
    headerRowIndex: 0,
    mode: "internship",
  },
  {
    batchYear: 2020,
    semester: 8,
    file: "INTERNSHIP EVALUATION SHEET.xlsx",
    sheet: "Marks Evaluation",
    headerRowIndex: 7,
    mode: "marks",
  },
  {
    batchYear: 2021,
    semester: 4,
    file: "21INT68-intership marks 2021.xlsx",
    sheet: "SEM 4",
    headerRowIndex: 4,
    mode: "internship",
  },
  {
    batchYear: 2021,
    semester: 6,
    file: "21INT68-intership marks 2021.xlsx",
    sheet: "SEM 6",
    headerRowIndex: 4,
    mode: "internship",
  },
  {
    batchYear: 2021,
    semester: 6,
    file: "21INT68-intership marks 2021.xlsx",
    sheet: "MarkSheet",
    headerRowIndex: 4,
    mode: "marks",
  },
];

async function importFile(config: ImportConfig) {
  const filePath = path.join(excelRoot, config.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping missing file: ${filePath}`);
    return;
  }

  const course = COURSE_DETAILS[`${config.batchYear}-${config.semester}`];
  const result = await importExcelFile({
    filePath,
    batchYear: config.batchYear,
    semester: config.semester,
    sheetName: config.sheet,
    headerRowIndex: config.headerRowIndex,
    mode: config.mode,
    courseCode: course?.code,
    courseName: course?.name,
    credits: course?.credits,
  });
  console.log(
    `Imported ${result.imported}/${result.rowsRead} rows from ${config.file} (${result.sheetName})`,
  );
}

async function main() {
  for (const config of importConfigs) {
    await importFile(config);
  }
}

main()
  .then(async () => {})
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
