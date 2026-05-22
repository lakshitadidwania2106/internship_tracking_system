export function formatGradeDisplay(grade?: string | null): string {
  if (grade == null) return "Absent";
  const trimmed = grade.trim();
  if (!trimmed) return "Absent";
  const lower = trimmed.toLowerCase();
  if (
    lower === "0" ||
    lower === "na" ||
    lower === "n/a" ||
    lower === "n.a." ||
    lower === "-" ||
    lower === "not assigned" ||
    lower === "not available" ||
    lower === "none"
  ) {
    return "Absent";
  }
  return trimmed;
}
