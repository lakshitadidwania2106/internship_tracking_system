export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

/** Parse PO1 / PSO2 style codes from Excel-style strings e.g. "PO1,2,3" or "PSO1, PSO2". */
export function parseOutcomeCodes(raw: string | null | undefined, prefix: "PO" | "PSO"): Set<string> {
  const codes = new Set<string>();
  if (!raw?.trim()) {
    return codes;
  }

  const explicit = raw.matchAll(new RegExp(`${prefix}\\s*(\\d{1,2})`, "gi"));
  for (const match of explicit) {
    codes.add(`${prefix}${match[1]}`);
  }

  if (codes.size > 0) {
    return codes;
  }

  const compact = raw.match(new RegExp(`${prefix}\\s*([\\d,\\s]+)`, "i"));
  if (compact?.[1]) {
    for (const digit of compact[1].matchAll(/\d{1,2}/g)) {
      codes.add(`${prefix}${digit[0]}`);
    }
  }

  return codes;
}

export function formatOutcomeSet(codes: Set<string>, fallback = "Not recorded"): string {
  if (codes.size === 0) {
    return fallback;
  }
  return [...codes].sort(outcomeSortKey).join(", ");
}

function outcomeSortKey(code: string): number {
  const match = code.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}
