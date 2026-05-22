import fs from "node:fs";
import path from "node:path";
import * as xlsx from "xlsx";
import type { ImportMode } from "@/lib/importer";

export type ExcelSheetPlan = {
  filePath: string;
  fileName: string;
  sheetName: string;
  batchYear: number;
  semester: number;
  headerRowIndex: number;
  mode: ImportMode;
  reviewNumber?: 1 | 2 | 3;
  usnColumnIndex: number;
  nameColumnIndex: number;
};

const EXCEL_EXT = /\.(xlsx|xls|csv)$/i;

/** VTU-style USN e.g. 1DS21AI001 */
export const USN_REGEX = /(1[A-Z]{2}\d{2}[A-Z]{2}\d{3})/i;

export function normalizeUsn(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const match = text.replace(/\s+/g, " ").match(USN_REGEX);
  if (match) return match[1].toUpperCase();
  const compact = text.replace(/\s+/g, "").toUpperCase();
  const match2 = compact.match(USN_REGEX);
  return match2 ? match2[1].toUpperCase() : null;
}

export function discoverExcelFiles(rootDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(rootDir)) return results;

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (EXCEL_EXT.test(entry.name)) {
        results.push(full);
      }
    }
  }

  walk(rootDir);
  return results.sort();
}

function inferBatchYear(filePath: string, fileName: string): number {
  const text = `${filePath} ${fileName}`.toLowerCase();
  if (/\b2020\b/.test(text) || /\/2020\//.test(filePath.replace(/\\/g, "/"))) return 2020;
  if (/\b2021\b/.test(text) || /\/2021\//.test(filePath.replace(/\\/g, "/"))) return 2021;
  return 2021;
}

function inferSemester(fileName: string): number {
  const lower = fileName.toLowerCase();
  if (/\bsem\s*6\b/.test(lower) || /\bint68\b/.test(lower) || /\bsem6\b/.test(lower)) return 6;
  if (/\bsem\s*8\b/.test(lower) || /\bint82\b/.test(lower) || /\bsem8\b/.test(lower)) return 8;
  if (/\bsem\s*4\b/.test(lower) || /\bsem4\b/.test(lower)) return 4;
  return 8;
}

function inferMode(fileName: string): { mode: ImportMode; reviewNumber?: 1 | 2 | 3 } {
  const lower = fileName.toLowerCase();
  if (/review\s*1|\br1\b|r1\b|markings?\s*review\s*1/.test(lower)) {
    return { mode: "marks", reviewNumber: 1 };
  }
  if (/review\s*2|\br2\b|markings?\s*review\s*2/.test(lower)) {
    return { mode: "marks", reviewNumber: 2 };
  }
  if (/review\s*3|\br3\b/.test(lower)) {
    return { mode: "marks", reviewNumber: 3 };
  }
  if (/final\s*mark|marks\s*evaluation|markings?/.test(lower) && !/internship\s*details/.test(lower)) {
    return { mode: "marks" };
  }
  if (/ces\b/.test(lower)) {
    return { mode: "marks" };
  }
  return { mode: "internship" };
}

function detectHeaderRow(rawRows: (string | number)[][]): number {
  for (let index = 0; index < Math.min(rawRows.length, 50); index += 1) {
    const row = (rawRows[index] ?? []).map((cell) => String(cell).trim().toUpperCase());
    const joined = row.join(" | ");
    if (joined.includes("USN") && (joined.includes("NAME") || joined.includes("STUDENT"))) {
      return index;
    }
  }
  return 0;
}

function findColumnIndex(header: (string | number)[], matchers: string[]): number {
  for (let i = 0; i < header.length; i += 1) {
    const key = String(header[i] ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
    if (matchers.some((m) => key.includes(m))) return i;
  }
  return -1;
}

function countUsnRows(rawRows: (string | number)[][], headerRowIndex: number, usnCol: number): number {
  let count = 0;
  for (let r = headerRowIndex + 1; r < rawRows.length; r += 1) {
    const usn = normalizeUsn(String((rawRows[r] ?? [])[usnCol] ?? ""));
    if (usn) count += 1;
  }
  return count;
}

export function discoverSheetPlans(filePath: string): ExcelSheetPlan[] {
  const buffer = fs.readFileSync(filePath);
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const fileName = path.basename(filePath);
  const batchYear = inferBatchYear(filePath, fileName);
  const semester = inferSemester(fileName);
  const { mode, reviewNumber } = inferMode(fileName);
  const plans: ExcelSheetPlan[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = xlsx.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      defval: "",
    });
    const headerRowIndex = detectHeaderRow(rawRows);
    const header = rawRows[headerRowIndex] ?? [];
    const usnColumnIndex = findColumnIndex(header, ["USN"]);
    const nameColumnIndex = findColumnIndex(header, ["NAME", "STUDENT NAME", "STUDENT"]);

    if (usnColumnIndex < 0) continue;

    const usnRows = countUsnRows(rawRows, headerRowIndex, usnColumnIndex);
    if (usnRows < 3) continue;

    plans.push({
      filePath,
      fileName,
      sheetName,
      batchYear,
      semester,
      headerRowIndex,
      mode,
      reviewNumber,
      usnColumnIndex,
      nameColumnIndex,
    });
  }

  return plans;
}

export function discoverAllSheetPlans(excelRoot: string): ExcelSheetPlan[] {
  const files = discoverExcelFiles(excelRoot);
  const all: ExcelSheetPlan[] = [];
  for (const file of files) {
    try {
      all.push(...discoverSheetPlans(file));
    } catch (error) {
      console.warn(`Skipping unreadable file ${file}:`, error);
    }
  }
  return all;
}
