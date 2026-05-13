import fs from "node:fs";
import path from "node:path";
import * as xlsx from "xlsx";
import { prisma } from "@/lib/prisma";

export type ImportMode = "internship" | "marks";

export type ImportExcelOptions = {
  filePath: string;
  batchYear: number;
  semester: number;
  sheetName?: string;
  headerRowIndex?: number;
  mode?: ImportMode;
  courseCode?: string;
  courseName?: string;
  credits?: number;
};

function readCell(record: Record<string, unknown>, candidates: string[]): string | undefined {
  for (const key of candidates) {
    const value = record[key];
    if (value !== undefined && value !== null && `${value}`.trim().length > 0) {
      return `${value}`.trim();
    }
  }
  return undefined;
}

function detectHeaderRow(rawRows: (string | number)[][]): number {
  for (let index = 0; index < Math.min(rawRows.length, 40); index += 1) {
    const row = (rawRows[index] ?? []).map((cell) => String(cell).trim().toUpperCase());
    const joined = row.join(" | ");
    if (joined.includes("USN") && (joined.includes("NAME") || joined.includes("STUDENT NAME"))) {
      return index;
    }
  }
  return 0;
}

export async function ensureBatchSemester(options: {
  batchYear: number;
  semester: number;
  courseCode?: string;
  courseName?: string;
  credits?: number;
}) {
  const batch = await prisma.batch.upsert({
    where: { year: options.batchYear },
    update: {},
    create: { year: options.batchYear },
  });

  const course = {
    code: options.courseCode ?? `AIML${options.semester}`,
    name: options.courseName ?? "Internship",
    credits: options.credits ?? 3,
  };

  const semesterRecord = await prisma.semesterRecord.upsert({
    where: {
      batchId_semester: {
        batchId: batch.id,
        semester: options.semester,
      },
    },
    update: {
      courseCode: course.code,
      courseName: course.name,
      credits: course.credits,
    },
    create: {
      batchId: batch.id,
      semester: options.semester,
      courseCode: course.code,
      courseName: course.name,
      credits: course.credits,
    },
  });

  return { batch, semesterRecord };
}

export async function importExcelFile(options: ImportExcelOptions) {
  if (!fs.existsSync(options.filePath)) {
    throw new Error(`File not found: ${options.filePath}`);
  }

  const { batch, semesterRecord } = await ensureBatchSemester({
    batchYear: options.batchYear,
    semester: options.semester,
    courseCode: options.courseCode,
    courseName: options.courseName,
    credits: options.credits,
  });

  const workbook = xlsx.readFile(options.filePath);
  const selectedSheetName = options.sheetName ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[selectedSheetName];
  if (!sheet) {
    throw new Error(`Sheet not found: ${selectedSheetName}`);
  }

  const rawRows = xlsx.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  });
  const headerRowIndex = options.headerRowIndex ?? detectHeaderRow(rawRows);
  const header = rawRows[headerRowIndex] ?? [];
  const rows = rawRows.slice(headerRowIndex + 1).map((raw) => {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < header.length; i += 1) {
      const key = `${header[i] ?? ""}`.trim();
      if (key) {
        record[key] = raw[i];
      }
    }
    return record;
  });

  let imported = 0;
  for (const row of rows) {
    const usn = readCell(row, ["USN", "Usn"]);
    if (!usn) continue;

    const fullName = readCell(row, ["NAME", "Student Name", "Name"]) ?? "Unknown Student";
    const companyName =
      readCell(row, ["Company Name", "COMPANY NAME", "INTERNSHIP COMPANY NAME"]) ?? "Not Provided";
    const roleTitle =
      readCell(row, ["Domain( Title)", "Job Role", "Domain", "Role", "INTERNSHIP ROLE"]) ?? "Intern";
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

    const existingInternship = await prisma.internship.findUnique({ where: { studentId: student.id } });
    const existingRowRaw =
      existingInternship?.sourceRowRawJson ? JSON.parse(existingInternship.sourceRowRawJson) : {};
    const mode = options.mode ?? "internship";

    await prisma.internship.upsert({
      where: { studentId: student.id },
      update: {
        companyName: mode === "marks" ? existingInternship?.companyName ?? companyName : companyName,
        roleTitle: mode === "marks" ? existingInternship?.roleTitle ?? roleTitle : roleTitle,
        stipend: mode === "marks" ? existingInternship?.stipend ?? stipend : stipend,
        durationText: mode === "marks" ? existingInternship?.durationText ?? duration : duration,
        startDateRaw: mode === "marks" ? existingInternship?.startDateRaw ?? fromDate : fromDate,
        endDateRaw: mode === "marks" ? existingInternship?.endDateRaw ?? toDate : toDate,
        grade: totalMarks ? `Total: ${totalMarks}` : existingInternship?.grade,
        sourceRowRawJson: JSON.stringify({
          ...existingRowRaw,
          ...row,
          evaluation: { totalMarks, reportMarks, presentationMarks, evaluatorName, internshipTitle },
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
          evaluation: { totalMarks, reportMarks, presentationMarks, evaluatorName, internshipTitle },
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
      sourceFileName: path.basename(options.filePath),
      batchYear: options.batchYear,
      semester: options.semester,
      status: "completed",
      rowsRead: rows.length,
      rowsImported: imported,
    },
  });

  return { imported, rowsRead: rows.length, sheetName: selectedSheetName };
}
