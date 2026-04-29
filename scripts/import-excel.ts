import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";
import { PrismaClient } from "../src/generated/prisma/client";
import { COURSE_DETAILS } from "../src/lib/constants";
import { createSqliteAdapter } from "../src/lib/prisma-adapter";

type ImportConfig = {
  batchYear: number;
  semester: number;
  file: string;
  sheet?: string;
  headerRowIndex?: number;
  mode?: "internship" | "marks";
};

const prisma = new PrismaClient({
  adapter: createSqliteAdapter(),
});
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

function readCell(record: Record<string, unknown>, candidates: string[]): string | undefined {
  for (const key of candidates) {
    const value = record[key];
    if (value !== undefined && value !== null && `${value}`.trim().length > 0) {
      return `${value}`.trim();
    }
  }
  return undefined;
}

async function ensureBatchSemester(batchYear: number, semester: number) {
  const batch = await prisma.batch.upsert({
    where: { year: batchYear },
    update: {},
    create: { year: batchYear },
  });

  const course = COURSE_DETAILS[`${batchYear}-${semester}`] ?? {
    code: `AIML${semester}`,
    name: "Internship",
    credits: 3,
  };

  const semesterRecord = await prisma.semesterRecord.upsert({
    where: {
      batchId_semester: {
        batchId: batch.id,
        semester,
      },
    },
    update: {
      courseCode: course.code,
      courseName: course.name,
      credits: course.credits,
    },
    create: {
      batchId: batch.id,
      semester,
      courseCode: course.code,
      courseName: course.name,
      credits: course.credits,
    },
  });

  return { batch, semesterRecord };
}

async function importFile(config: ImportConfig) {
  const filePath = path.join(excelRoot, config.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping missing file: ${filePath}`);
    return;
  }

  const { batch, semesterRecord } = await ensureBatchSemester(config.batchYear, config.semester);
  const workbook = xlsx.readFile(filePath);
  const sheetName = config.sheet ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  let rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    range: config.headerRowIndex ?? 0,
  });
  const firstRowKeys = Object.keys(rows[0] ?? {});

  // Some sheets contain merged heading blocks; fallback to array parsing.
  if (firstRowKeys.some((key) => key.startsWith("__EMPTY")) && config.headerRowIndex !== undefined) {
    const rawRows = xlsx.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      defval: "",
    });
    const header = rawRows[config.headerRowIndex] ?? [];
    rows = rawRows.slice(config.headerRowIndex + 1).map((raw) => {
      const record: Record<string, unknown> = {};
      for (let i = 0; i < header.length; i += 1) {
        const key = `${header[i] ?? ""}`.trim();
        if (key) {
          record[key] = raw[i];
        }
      }
      return record;
    });
  }

  let imported = 0;
  for (const row of rows) {
    const usn = readCell(row, ["USN", "Usn"]);
    if (!usn) {
      continue;
    }

    const fullName = readCell(row, ["NAME", "Student Name", "Name"]) ?? "Unknown Student";
    const companyName = readCell(row, [
      "Company Name",
      "COMPANY NAME",
      "INTERNSHIP COMPANY NAME",
    ]) ?? "Not Provided";
    const roleTitle =
      readCell(row, ["Domain( Title)", "Job Role", "Domain", "Role", "INTERNSHIP ROLE"]) ??
      "Intern";
    const stipend = readCell(row, ["Stipend", "STIPEND YES /NO"]);
    const duration = readCell(row, ["DURATION"]);
    const fromDate = readCell(row, ["From date", "From Date", "Start Date"]);
    const toDate = readCell(row, ["To Date", "To date", "End Date"]);
    const relevantPOs = readCell(row, ["Relevant POs"]);
    const relevantPSOs = readCell(row, ["Relevant PSOs"]);
    const totalMarks = readCell(row, ["TOTAL\n(100)", "TOTAL (100)", "Max-100", "TOTAL"]);
    const reportMarks = readCell(row, ["Report\n(10)", "Report (10)", "Report"]);
    const presentationMarks = readCell(row, ["Presentation\n(10)", "Presentation (10)"]);
    const evaluatorName = readCell(row, ["Evaluator Names"]);
    const internshipTitle = readCell(row, ["INTERNSHIP TITLE"]);

    const student = await prisma.student.upsert({
      where: { usn: usn.toUpperCase() },
      update: {
        fullName,
        batchId: batch.id,
        semesterRecordId: semesterRecord.id,
      },
      create: {
        usn: usn.toUpperCase(),
        fullName,
        batchId: batch.id,
        semesterRecordId: semesterRecord.id,
      },
    });

    const existingInternship = await prisma.internship.findUnique({
      where: { studentId: student.id },
    });
    const existingRowRaw = existingInternship?.sourceRowRawJson
      ? JSON.parse(existingInternship.sourceRowRawJson)
      : {};

    await prisma.internship.upsert({
      where: { studentId: student.id },
      update: {
        companyName: config.mode === "marks" ? existingInternship?.companyName ?? companyName : companyName,
        roleTitle:
          config.mode === "marks"
            ? existingInternship?.roleTitle ?? roleTitle
            : roleTitle,
        stipend: config.mode === "marks" ? existingInternship?.stipend ?? stipend : stipend,
        durationText:
          config.mode === "marks"
            ? existingInternship?.durationText ?? duration
            : duration,
        startDateRaw:
          config.mode === "marks"
            ? existingInternship?.startDateRaw ?? fromDate
            : fromDate,
        endDateRaw:
          config.mode === "marks"
            ? existingInternship?.endDateRaw ?? toDate
            : toDate,
        grade: totalMarks ? `Total: ${totalMarks}` : existingInternship?.grade,
        sourceRowRawJson: JSON.stringify({
          ...existingRowRaw,
          ...row,
          evaluation: {
            totalMarks,
            reportMarks,
            presentationMarks,
            evaluatorName,
            internshipTitle,
          },
        }),
      },
      create: {
        studentId: student.id,
        companyName,
        roleTitle,
        stipend,
        durationText: duration,
        startDateRaw: fromDate,
        endDateRaw: toDate,
        grade: totalMarks ? `Total: ${totalMarks}` : null,
        sourceRowRawJson: JSON.stringify({
          ...row,
          evaluation: {
            totalMarks,
            reportMarks,
            presentationMarks,
            evaluatorName,
            internshipTitle,
          },
        }),
      },
    });

    await prisma.outcomeMapping.upsert({
      where: { studentId: student.id },
      update: {
        relevantPOs,
        relevantPSOs,
        sourceRowRawJson: JSON.stringify(row),
      },
      create: {
        studentId: student.id,
        relevantPOs,
        relevantPSOs,
        sourceRowRawJson: JSON.stringify(row),
      },
    });

    imported += 1;
  }

  await prisma.importJob.create({
    data: {
      sourceFileName: config.file,
      batchYear: config.batchYear,
      semester: config.semester,
      status: "completed",
      rowsRead: rows.length,
      rowsImported: imported,
    },
  });

  console.log(`Imported ${imported}/${rows.length} rows from ${config.file} (${sheetName})`);
}

async function main() {
  for (const config of importConfigs) {
    await importFile(config);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
