import { COURSE_DETAILS } from "@/lib/constants";
import {
  buildMarksDistributionData,
  buildStudentMarksRecord,
  extractFinalTotal,
  extractReducedMarks,
  findColumnByPattern,
  formatColumnLabel,
  getCellValue,
  getExcelColumnsFromRow,
  hasAnyMarksData,
  type ColumnStats,
  type DistributionBucket,
  type MarksRow,
  type ReviewNumber,
  type StudentMarksRecord,
  type StudentWithMarks,
} from "@/lib/marks-distribution";
import { BarChart3, ClipboardList, FileSpreadsheet, Search, TrendingUp, User } from "lucide-react";
import type { ReactNode } from "react";

type MarksDistributionPanelProps = {
  students: StudentWithMarks[];
  batchYear: number;
  semester: number;
  focusUsn?: string;
  focusStudent?: StudentWithMarks | null;
  totalStudents: number;
  internshipCount: number;
};

export function MarksDistributionPanel({
  students,
  batchYear,
  semester,
  focusUsn,
  focusStudent,
  totalStudents,
  internshipCount,
}: MarksDistributionPanelProps) {
  const data = buildMarksDistributionData(students);
  const course = COURSE_DETAILS[`${batchYear}-${semester}`];
  const maxBucketCount = Math.max(...data.finalTotalDistribution.map((b) => b.count), 1);
  const displayFinalColumns = data.finalColumns;
  const displayReviewColumns = data.reviewColumns;

  const focusRecord = focusStudent ? buildStudentMarksRecord(focusStudent) : null;

  const hasMarksData =
    data.summary.withFinalMarks > 0 ||
    data.summary.withReview1 > 0 ||
    data.summary.withReview2 > 0 ||
    data.summary.withReview3 > 0;

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-[#9ad9cf] bg-gradient-to-r from-[#e8f8f5] to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="inline-flex items-center gap-2 text-xl font-semibold text-[var(--dsce-navy)]">
              <BarChart3 className="h-5 w-5 text-primary" />
              Marks Distribution
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Batch {batchYear}, Semester {semester}
              {course ? ` · ${course.code} — ${course.name}` : ""}. Column names match your Excel
              sheets. Search by USN to view one student.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CoverageBadge label="Final marks" count={data.summary.withFinalMarks} total={totalStudents} />
            <CoverageBadge label="Review 1" count={data.summary.withReview1} total={totalStudents} />
            <CoverageBadge label="Review 2" count={data.summary.withReview2} total={totalStudents} />
            <CoverageBadge label="Review 3" count={data.summary.withReview3} total={totalStudents} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Students (batch/sem)" value={String(totalStudents)} />
        <SummaryCard label="Internships" value={String(internshipCount)} />
        <SummaryCard label="With marks in Excel" value={String(data.summary.withFinalMarks)} />
        <SummaryCard
          label="Avg total (out of 100)"
          value={data.summary.averageFinal !== null ? data.summary.averageFinal.toFixed(1) : "—"}
        />
      </div>

      {focusUsn ? (
        <StudentMarksFocus
          focusUsn={focusUsn}
          focusRecord={focusRecord}
          focusStudent={focusStudent}
          batchYear={batchYear}
          semester={semester}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-[#9ad9cf] bg-[#f8fcfb] px-4 py-3 text-sm text-muted">
          <Search className="mr-1 inline h-4 w-4" />
          Enter a USN and click <strong>Search Student</strong> to view marks from the Excel file.
        </p>
      )}

      {!hasMarksData ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-medium">No marks imported for batch {batchYear}, semester {semester}.</p>
          <p className="mt-1">
            Place Excel files in <code className="rounded bg-white/80 px-1">data/imports/excel/</code> and
            run <code className="rounded bg-white/80 px-1">npm run import:excel</code>, or upload via{" "}
            <strong>Data Management</strong> (final marks + Review 1–3).
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-white p-5">
        <h4 className="mb-4 inline-flex items-center gap-2 font-semibold text-[var(--dsce-navy)]">
          <TrendingUp className="h-4 w-4 text-primary" />
          Total marks (out of 100) — batch distribution
        </h4>
        {data.summary.withFinalMarks === 0 ? (
          <p className="text-sm text-muted">No total marks found for this batch/semester.</p>
        ) : (
          <DistributionChart buckets={data.finalTotalDistribution} maxCount={maxBucketCount} />
        )}
      </div>

      {data.finalColumns.length > 0 ? (
        <ColumnStatsSection
          title="Final marks"
          icon={<FileSpreadsheet className="h-4 w-4 text-primary" />}
          stats={data.finalColumnStats}
        />
      ) : null}

      {([1, 2, 3] as ReviewNumber[]).map((reviewNumber) => {
        const columns = data.reviewColumns[reviewNumber];
        if (columns.length === 0) return null;
        return (
          <ColumnStatsSection
            key={reviewNumber}
            title={`Review ${reviewNumber}`}
            icon={<ClipboardList className="h-4 w-4 text-primary" />}
            stats={data.reviewColumnStats[reviewNumber]}
          />
        );
      })}

      <div className="rounded-xl border border-border bg-white p-5">
        <h4 className="mb-2 font-semibold text-[var(--dsce-navy)]">Marks by student</h4>
        <p className="mb-4 text-sm text-muted">
          Each column header is taken from your Excel file. Students without marks show{" "}
          <span className="italic text-amber-700">Data unavailable</span>.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-max text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="sticky left-0 z-20 border border-border bg-slate-100 px-3 py-2 text-left font-semibold">
                  USN
                </th>
                <th className="sticky left-[7.5rem] z-20 border border-border bg-slate-100 px-3 py-2 text-left font-semibold">
                  Name
                </th>
                {displayFinalColumns.length > 0 ? (
                  <th
                    colSpan={displayFinalColumns.length}
                    className="border border-border bg-[#dbeafe] px-3 py-2 text-center font-semibold text-[var(--dsce-blue)]"
                  >
                    Final marks sheet
                  </th>
                ) : null}
                {([1, 2, 3] as ReviewNumber[]).map((reviewNumber) =>
                  displayReviewColumns[reviewNumber].length > 0 ? (
                    <th
                      key={reviewNumber}
                      colSpan={displayReviewColumns[reviewNumber].length}
                      className="border border-border bg-emerald-50 px-3 py-2 text-center font-semibold text-emerald-900"
                    >
                      Review {reviewNumber}
                    </th>
                  ) : null,
                )}
              </tr>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-10 border border-border bg-slate-50 px-3 py-1" />
                <th className="sticky left-[7.5rem] z-10 border border-border bg-slate-50 px-3 py-1" />
                {displayFinalColumns.map((col) => (
                  <th
                    key={`final-h-${col}`}
                    className="min-w-[7rem] border border-border bg-[#eff6ff] px-2 py-1 text-left font-medium text-slate-700"
                    title={formatColumnLabel(col)}
                  >
                    {formatColumnLabel(col)}
                  </th>
                ))}
                {([1, 2, 3] as ReviewNumber[]).flatMap((reviewNumber) =>
                  displayReviewColumns[reviewNumber].map((col) => (
                    <th
                      key={`r${reviewNumber}-h-${col}`}
                      className="min-w-[7rem] border border-border bg-emerald-50/80 px-2 py-1 text-left font-medium text-slate-700"
                      title={formatColumnLabel(col)}
                    >
                      {formatColumnLabel(col)}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {data.students.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-muted">
                    No students in this batch/semester.
                  </td>
                </tr>
              ) : (
                data.students.map((student, index) => {
                  const isFocus =
                    focusUsn && student.usn.toUpperCase() === focusUsn.toUpperCase();
                  const hasFinal = student.hasFinalData;
                  return (
                    <tr
                      key={student.usn}
                      className={
                        isFocus
                          ? "bg-[#e8f8f5] ring-1 ring-inset ring-[#9ad9cf]"
                          : index % 2 === 0
                            ? "bg-white"
                            : "bg-slate-50/60"
                      }
                    >
                      <td className="sticky left-0 z-10 border border-border bg-inherit px-3 py-2 font-medium">
                        {student.usn}
                      </td>
                      <td className="sticky left-[7.5rem] z-10 max-w-[12rem] truncate border border-border bg-inherit px-3 py-2">
                        {student.fullName}
                      </td>
                      {displayFinalColumns.map((col) => (
                        <td key={`${student.usn}-final-${col}`} className="border border-border px-2 py-2">
                          {hasFinal ? (
                            <MarkCell row={student.finalRow} column={col} />
                          ) : (
                            <Unavailable />
                          )}
                        </td>
                      ))}
                      {([1, 2, 3] as ReviewNumber[]).flatMap((reviewNumber) =>
                        displayReviewColumns[reviewNumber].map((col) => (
                          <td
                            key={`${student.usn}-r${reviewNumber}-${col}`}
                            className="border border-border px-2 py-2"
                          >
                            {student.hasReviewData[reviewNumber] ? (
                              <MarkCell row={student.reviews[reviewNumber]} column={col} />
                            ) : (
                              <Unavailable />
                            )}
                          </td>
                        )),
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function MarkCell({ row, column }: { row?: MarksRow; column: string }) {
  const value = getCellValue(row, column);
  if (value === "—") return <Unavailable />;
  const isTotal = /total|grand/i.test(column) && !/reduced/i.test(column);
  const isReduced = /reduced/i.test(column);
  return (
    <span
      className={
        isTotal
          ? "font-semibold text-[var(--dsce-blue)]"
          : isReduced
            ? "font-medium text-amber-800"
            : ""
      }
    >
      {value}
    </span>
  );
}

function Unavailable() {
  return <span className="italic text-amber-700">Data unavailable</span>;
}

function StudentMarksFocus({
  focusUsn,
  focusRecord,
  focusStudent,
  batchYear,
  semester,
}: {
  focusUsn: string;
  focusRecord: StudentMarksRecord | null;
  focusStudent: StudentWithMarks | null | undefined;
  batchYear: number;
  semester: number;
}) {
  if (!focusStudent || !focusRecord) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        No student with USN <strong>{focusUsn}</strong> in Batch <strong>{batchYear}</strong>, Semester{" "}
        <strong>{semester}</strong>. Check the USN, batch, and semester match your Excel import.
      </div>
    );
  }

  const finalTotal = extractFinalTotal(focusRecord.finalRow);
  const reducedMarks = extractReducedMarks(focusRecord.finalRow);
  const totalCol = findColumnByPattern(focusRecord.finalRow, /total.*100|max.*100|^total$/i);
  const reducedCol = findColumnByPattern(focusRecord.finalRow, /reduced/i);
  const hasData = hasAnyMarksData(focusRecord);

  return (
    <div className="rounded-xl border-2 border-[#9ad9cf] bg-gradient-to-br from-[#e8f8f5] to-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#9ad9cf]/60 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Student marks</p>
          <h4 className="mt-1 inline-flex items-center gap-2 text-xl font-semibold text-[var(--dsce-navy)]">
            <User className="h-5 w-5 text-primary" />
            {focusStudent.fullName}
          </h4>
          <p className="text-sm text-muted">USN: {focusStudent.usn}</p>
          <p className="text-sm text-muted">
            Batch {batchYear}, Semester {semester}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MiniStat
            label={totalCol ? formatColumnLabel(totalCol) : "Total (out of 100)"}
            value={finalTotal !== null ? String(finalTotal) : "Data unavailable"}
            highlight
          />
          <MiniStat
            label={reducedCol ? formatColumnLabel(reducedCol) : "Reduced marks"}
            value={reducedMarks ?? "Data unavailable"}
          />
        </div>
      </div>

      {!hasData ? (
        <p className="text-sm text-amber-800">
          <strong>Data unavailable</strong> — this student has no marks in the database for batch {batchYear},
          semester {semester}. Re-import Excel via Data Management or run{" "}
          <code className="rounded bg-white/80 px-1">npm run import:excel</code>.
        </p>
      ) : (
        <div className="space-y-4">
          {focusRecord.hasFinalData ? (
            <MarksBreakdown sectionLabel="Final marks" tone="final" row={focusRecord.finalRow} />
          ) : (
            <SectionUnavailable label="Final marks" />
          )}

          {([1, 2, 3] as ReviewNumber[]).map((reviewNumber) => {
            const row = focusRecord.reviews[reviewNumber];
            if (focusRecord.hasReviewData[reviewNumber] && row) {
              return (
                <MarksBreakdown
                  key={reviewNumber}
                  sectionLabel={`Review ${reviewNumber}`}
                  tone="review"
                  row={row}
                />
              );
            }
            return <SectionUnavailable key={reviewNumber} label={`Review ${reviewNumber}`} />;
          })}
        </div>
      )}
    </div>
  );
}

function SectionUnavailable({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-4 py-3 text-sm text-amber-900">
      <span className="font-medium">{label}:</span> Data unavailable in Excel import
    </div>
  );
}

function MarksBreakdown({
  sectionLabel,
  tone,
  row,
}: {
  sectionLabel: string;
  tone: "final" | "review";
  row: MarksRow;
}) {
  const columns = getExcelColumnsFromRow(row);
  if (columns.length === 0) {
    return <SectionUnavailable label={sectionLabel} />;
  }

  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === "final" ? "border-[#dbeafe] bg-[#f8fbff]" : "border-emerald-100 bg-emerald-50/50"
      }`}
    >
      <h5
        className={`mb-3 text-sm font-semibold ${
          tone === "final" ? "text-[var(--dsce-blue)]" : "text-emerald-900"
        }`}
      >
        {sectionLabel}
      </h5>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {columns.map((col) => (
          <div
            key={col}
            className={`rounded-md border bg-white px-3 py-2 ${
              /total/i.test(col) && !/reduced/i.test(col)
                ? "border-primary/30 ring-1 ring-primary/10"
                : /reduced/i.test(col)
                  ? "border-amber-200"
                  : "border-border/80"
            }`}
          >
            <dt className="text-xs font-medium text-slate-600">{formatColumnLabel(col)}</dt>
            <dd className="mt-0.5 text-base font-semibold text-[var(--dsce-navy)]">
              {getCellValue(row, col)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        highlight ? "border-primary/30 bg-white" : "border-border bg-slate-50"
      }`}
    >
      <p className="text-[11px] font-medium text-slate-600">{label}</p>
      <p
        className={`text-lg font-semibold ${
          value === "Data unavailable"
            ? "text-amber-700"
            : highlight
              ? "text-primary"
              : "text-[var(--dsce-navy)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-slate-50 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold text-[var(--dsce-navy)]">{value}</p>
    </div>
  );
}

function CoverageBadge({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <span className="rounded-full border border-[#9ad9cf] bg-white px-3 py-1 text-xs font-medium text-[var(--dsce-navy)]">
      {label}: {count}/{total} ({pct}%)
    </span>
  );
}

function DistributionChart({ buckets, maxCount }: { buckets: DistributionBucket[]; maxCount: number }) {
  return (
    <div className="space-y-3">
      {buckets.map((bucket) => (
        <div key={bucket.label} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3 text-sm">
          <span className="font-medium text-slate-700">{bucket.label}</span>
          <div className="h-7 overflow-hidden rounded-md bg-slate-100">
            <div
              className="flex h-full items-center rounded-md bg-primary/85 px-2 text-xs font-medium text-white transition-all"
              style={{ width: `${Math.max((bucket.count / maxCount) * 100, bucket.count > 0 ? 8 : 0)}%` }}
            >
              {bucket.count > 0 ? bucket.count : ""}
            </div>
          </div>
          <span className="text-right text-xs text-muted">{bucket.percent}%</span>
        </div>
      ))}
    </div>
  );
}

function ColumnStatsSection({
  title,
  icon,
  stats,
}: {
  title: string;
  icon: ReactNode;
  stats: ColumnStats[];
}) {
  const numericStats = stats.filter((s) => s.numericCount > 0);

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <h4 className="mb-4 inline-flex items-center gap-2 font-semibold text-[var(--dsce-navy)]">
        {icon}
        {title}
      </h4>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left">Excel column</th>
              <th className="px-3 py-2 text-left">Filled</th>
              <th className="px-3 py-2 text-left">Min</th>
              <th className="px-3 py-2 text-left">Max</th>
              <th className="px-3 py-2 text-left">Average</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr key={stat.column} className="border-b border-border">
                <td className="max-w-xs px-3 py-2 font-medium" title={formatColumnLabel(stat.column)}>
                  {formatColumnLabel(stat.column)}
                </td>
                <td className="px-3 py-2">{stat.count}</td>
                <td className="px-3 py-2">{stat.min ?? "—"}</td>
                <td className="px-3 py-2">{stat.max ?? "—"}</td>
                <td className="px-3 py-2">
                  {stat.average !== undefined ? stat.average.toFixed(1) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {numericStats.length > 0 ? (
        <details className="mt-4 rounded-lg border border-border bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-800">
            Distribution charts
          </summary>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {numericStats.slice(0, 12).map((stat) => (
              <div key={`dist-${stat.column}`}>
                <p className="mb-2 text-sm font-semibold text-primary">
                  {formatColumnLabel(stat.column)}
                </p>
                {stat.distribution ? (
                  <DistributionChart
                    buckets={stat.distribution}
                    maxCount={Math.max(...stat.distribution.map((b) => b.count), 1)}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
