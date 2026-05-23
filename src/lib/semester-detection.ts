import * as xlsx from "xlsx";

/** Canonical internship semesters supported by the portal. */
export type CanonicalSemester = 6 | 8;

export type SemesterDetectionInput = {
  fileName?: string;
  workbookTitle?: string;
  sheetName?: string;
  /** First rows of the active sheet (before column mapping). */
  sheetPreviewRows?: (string | number)[][];
};

function flattenPreviewRows(rows: (string | number)[][] | undefined, maxRows = 25): string {
  if (!rows?.length) return "";
  return rows
    .slice(0, maxRows)
    .map((row) => row.map((cell) => String(cell ?? "").trim()).filter(Boolean).join(" "))
    .join("\n");
}

/** Score how strongly text refers to semester 8 (VIII / 8 / sem 8). */
function scoreSemester8(text: string): number {
  const upper = text.toUpperCase();
  let score = 0;

  if (/SEMESTER\s*[-:]*\s*VIII|SEM\s*[-:]*\s*VIII|\bVIII\s*SEM|\bSEM\s*VIII\b/.test(upper)) score += 12;
  if (/SEMESTER\s*8\b|SEMESTER\s*VIII|INTERNSHIP\s*[-(]*\s*SEM\s*8/i.test(upper)) score += 10;
  if (/\b8\s*(ST|TH)?\s*SEMESTER\b|EIGHTH\s*SEMESTER/i.test(upper)) score += 10;
  if (/\bSEM\s*8\b|\bSEM\s*8\s|\bSEM8\b|SEM\s*8\s*20|20\d{2}\s*BATCH\s*SEM\s*8/i.test(upper)) score += 9;
  if (/SEM\s*8\s*20|SEM\s*8\s*202/i.test(upper)) score += 8;
  if (/20AI8|21AIL84|20AI8ICINT/i.test(upper)) score += 4;
  if (/FINAL\s*MARKS.*SEM\s*8|SEM\s*8.*FINAL|SEM\s*8.*MARK/i.test(upper)) score += 5;

  return score;
}

/** Score how strongly text refers to semester 6 (VI / 6 / sem 6). */
function scoreSemester6(text: string): number {
  const upper = text.toUpperCase();
  let score = 0;

  // Match "SEMESTER VI" but not the "VI" inside "VIII" (no word char before VI when part of VIII).
  if (/SEMESTER\s*[-:]*\s*VI\b|SEM\s*[-:]*\s*VI\b|\bVI\s*SEM|\bSEM\s*VI\b/.test(upper)) score += 12;
  if (/SEMESTER\s*6\b|\b6\s*(ST|TH)?\s*SEMESTER\b|SIXTH\s*SEMESTER/i.test(upper)) score += 10;
  if (/\bSEM\s*6\b|\bSEM6\b|SEM\s*6\s*20|SEM\s*6\s*FINAL/i.test(upper)) score += 9;
  if (/SEM6|SEM\s*6\s*FINAL|INTERNSHIP.*SEM\s*6/i.test(upper)) score += 5;

  return score;
}

/**
 * Detect semester 6 or 8 from sheet name, workbook title, filename, and sheet body text.
 * Returns null when no reliable signal is found.
 */
function detectSemesterFromRows(rows: (string | number)[][] | undefined): CanonicalSemester | null {
  if (!rows?.length) return null;

  for (const row of rows.slice(0, 40)) {
    const line = row.map((cell) => String(cell ?? "").trim()).filter(Boolean).join(" ");
    if (!line) continue;
    const upper = line.toUpperCase();

    if (/VIII/.test(upper) && /(SEM|SEMESTER|INTERNSHIP|MARK|INTERN)/i.test(upper)) {
      return 8;
    }
    if (/SEMESTER\s*VI\b|SEM\s*VI\b/.test(upper) && !/VIII/.test(upper)) {
      return 6;
    }
    if (/\bSEM\s*8\b|SEMESTER\s*8\b|\b8\s*(ST|TH)?\s*SEMESTER\b/.test(upper)) {
      return 8;
    }
    if (/\bSEM\s*6\b|SEMESTER\s*6\b|\b6\s*(ST|TH)?\s*SEMESTER\b/.test(upper)) {
      return 6;
    }
  }

  return null;
}

export function detectSemester(input: SemesterDetectionInput): CanonicalSemester | null {
  const fromRows = detectSemesterFromRows(input.sheetPreviewRows);
  if (fromRows) return fromRows;

  const metaCorpus = [input.fileName, input.workbookTitle, input.sheetName]
    .filter(Boolean)
    .join("\n");
  const bodyCorpus = flattenPreviewRows(input.sheetPreviewRows);

  if (!metaCorpus.trim() && !bodyCorpus.trim()) return null;

  // Sheet body text (e.g. "Semester VIII") outweighs misleading filenames like "21INT68-...".
  const score8 = scoreSemester8(metaCorpus) + scoreSemester8(bodyCorpus) * 3;
  const score6 = scoreSemester6(metaCorpus) + scoreSemester6(bodyCorpus) * 3;

  if (score8 > score6) return 8;
  if (score6 > score8) return 6;
  if (score8 > 0) return 8;
  if (score6 > 0) return 6;
  return null;
}

export function readWorkbookTitle(workbook: xlsx.WorkBook): string | undefined {
  const props = workbook.Props as { Title?: string; Subject?: string } | undefined;
  const title = props?.Title?.trim() || props?.Subject?.trim();
  return title || undefined;
}

export function readSheetPreviewRows(
  workbook: xlsx.WorkBook,
  sheetName: string,
  maxRows = 40,
): (string | number)[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rawRows = xlsx.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  });
  return rawRows.slice(0, maxRows);
}

export function detectSemesterForWorkbook(options: {
  fileName: string;
  workbook: xlsx.WorkBook;
  sheetName: string;
  semesterHint?: CanonicalSemester;
}): CanonicalSemester {
  const preview = readSheetPreviewRows(options.workbook, options.sheetName);
  let detected = detectSemester({
    fileName: options.fileName,
    workbookTitle: readWorkbookTitle(options.workbook),
    sheetName: options.sheetName,
    sheetPreviewRows: preview,
  });

  if (!detected) {
    const allSheetNames = options.workbook.SheetNames.join(" ");
    detected = detectSemester({
      fileName: options.fileName,
      workbookTitle: readWorkbookTitle(options.workbook),
      sheetName: allSheetNames,
    });
  }

  if (detected) {
    if (options.semesterHint && options.semesterHint !== detected) {
      console.warn(
        `  Semester hint ${options.semesterHint} overridden by detected semester ${detected} (${options.fileName} / "${options.sheetName}")`,
      );
    }
    return detected;
  }

  if (options.semesterHint) {
    return options.semesterHint;
  }

  throw new Error(
    `Could not detect semester (6 or 8) for "${options.fileName}" sheet "${options.sheetName}". ` +
      `Add semesterHint or ensure the sheet/filename mentions Semester VI/VIII or Sem 6/8.`,
  );
}
