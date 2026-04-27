import { BATCH_SEMESTER_MAP, DASHBOARD_LINKS } from "@/lib/constants";
import { getDashboardStats, searchStudents } from "@/lib/data";
import { ChatAssistant } from "@/components/chat-assistant";
import { CalendarDays, Download, Search, User } from "lucide-react";

type PageProps = {
  searchParams: Promise<{
    batch?: string;
    semester?: string;
    usn?: string;
  }>;
};

export default async function Home({ searchParams }: PageProps) {
  const filters = await searchParams;
  const selectedBatch = Number(filters.batch) || 2020;
  const availableSemesters = BATCH_SEMESTER_MAP[selectedBatch] ?? [];
  const selectedSemester =
    Number(filters.semester) || (availableSemesters.length > 0 ? availableSemesters[0] : 8);
  const usnQuery = filters.usn?.trim() ?? "";

  const [students, stats] = await Promise.all([
    searchStudents({
      batchYear: selectedBatch,
      semester: selectedSemester,
      usn: usnQuery || undefined,
    }),
    getDashboardStats(selectedBatch, selectedSemester),
  ]);

  const selectedStudent =
    students.find((student) => student.usn.toUpperCase() === usnQuery.toUpperCase()) ?? students[0];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 flex-col border-r border-border bg-white px-5 py-6 lg:flex">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">DSCE AIML</p>
          <h1 className="mt-2 text-lg font-semibold">Internship Portal</h1>
        </div>
        <nav className="mt-8 space-y-1">
          {DASHBOARD_LINKS.map((item, index) => (
            <div
              key={item}
              className={`rounded-lg px-3 py-2 text-sm ${index === 0 ? "bg-blue-50 font-medium text-primary" : "text-slate-600"}`}
            >
              {item}
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <header className="mb-6 flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">DSCE | Department of AIML - Internship Portal</h2>
              <p className="text-sm text-muted">
                Select a batch and semester, then search by USN to view student internship details.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Total Students" value={String(stats.totalStudents)} />
              <MetricCard label="Internships" value={String(stats.internshipCount)} />
              <MetricCard label="Conversion" value={`${stats.conversionRate}%`} />
              <MetricCard label="Batch" value={String(selectedBatch)} />
            </div>
          </header>

          <form className="mb-6 grid gap-3 md:grid-cols-4">
            <SelectFilter name="batch" value={String(selectedBatch)} options={["2020", "2021"]} />
            <SelectFilter
              name="semester"
              value={String(selectedSemester)}
              options={availableSemesters.map(String)}
            />
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                name="usn"
                defaultValue={usnQuery}
                placeholder="Enter USN (e.g., 1DS21AI001)"
                className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-primary/20 focus:ring"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 md:col-start-4"
            >
              Search Student
            </button>
          </form>

          <section className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-xl border border-border bg-white p-4 lg:col-span-2">
              {!selectedStudent ? (
                <p className="text-sm text-muted">No students found for this filter.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                    <div>
                      <h3 className="text-xl font-semibold">{selectedStudent.fullName}</h3>
                      <p className="text-sm text-muted">USN: {selectedStudent.usn}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      {selectedStudent.internship?.status ?? "Status N/A"}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <InfoItem label="Batch" value={String(selectedStudent.batch.year)} />
                    <InfoItem label="Semester" value={String(selectedStudent.semesterRecord.semester)} />
                    <InfoItem label="Course Code" value={selectedStudent.semesterRecord.courseCode} />
                    <InfoItem label="Credits" value={String(selectedStudent.semesterRecord.credits)} />
                    <InfoItem
                      label="Company"
                      value={selectedStudent.internship?.companyName ?? "Not available"}
                    />
                    <InfoItem label="Role" value={selectedStudent.internship?.roleTitle ?? "Not available"} />
                    <InfoItem label="Stipend" value={selectedStudent.internship?.stipend ?? "-"} />
                    <InfoItem
                      label="Duration"
                      value={
                        selectedStudent.internship?.durationText ??
                        `${selectedStudent.internship?.startDateRaw ?? "-"} to ${selectedStudent.internship?.endDateRaw ?? "-"}`
                      }
                    />
                    <InfoItem label="Grade" value={selectedStudent.internship?.grade ?? "Not assigned"} />
                  </div>
                </>
              )}
            </article>

            <aside className="space-y-4">
              <div className="rounded-xl border border-border bg-white p-4">
                <h4 className="mb-3 font-semibold">CO-PO-PSO Mapping</h4>
                <MappingRow label="Relevant POs" value={selectedStudent?.mapping?.relevantPOs} />
                <MappingRow label="Relevant PSOs" value={selectedStudent?.mapping?.relevantPSOs} />
                <MappingRow
                  label="Summary"
                  value={selectedStudent?.mapping?.coMappingSummary ?? "Will be populated from uploaded data."}
                />
              </div>
              <div className="rounded-xl border border-border bg-white p-4">
                <h4 className="mb-3 font-semibold">Internship Report</h4>
                {selectedStudent?.documents[0] ? (
                  <a
                    href={`/api/documents/${selectedStudent.documents[0].id}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
                  >
                    <Download className="h-4 w-4" />
                    Download Soft Copy
                  </a>
                ) : (
                  <p className="text-sm text-muted">No document linked yet.</p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-white p-4">
                <h4 className="mb-3 font-semibold">Students In Selection</h4>
                <ul className="space-y-2 text-sm">
                  {students.slice(0, 8).map((student) => (
                    <li key={student.id} className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        {student.fullName}
                      </span>
                      <span className="text-xs text-muted">{student.usn}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-white p-4 text-sm text-muted">
                <p className="mb-1 inline-flex items-center gap-2 font-medium text-slate-700">
                  <CalendarDays className="h-4 w-4" />
                  Data Notes
                </p>
                <p>Excel import folders are ready at data/imports/excel and data/imports/reports.</p>
              </div>
            </aside>
          </section>
        </div>
        <ChatAssistant />
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-slate-50 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function SelectFilter({
  name,
  value,
  options,
}: {
  name: string;
  value: string;
  options: string[];
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {name === "semester" ? `Semester ${option}` : `Batch ${option}`}
        </option>
      ))}
    </select>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function MappingRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="mb-3 text-sm">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-slate-700">{value || "-"}</p>
    </div>
  );
}
