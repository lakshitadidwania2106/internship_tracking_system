import { BATCH_SEMESTER_MAP, DASHBOARD_LINKS } from "@/lib/constants";
import {
  getBatchSemesterMapFromDb,
  getDashboardStats,
  getStudentsForBatchSemester,
  resolveDashboardFilters,
  searchStudents,
} from "@/lib/data";
import { DashboardFilters } from "@/components/dashboard-filters";
import { ChatAssistant } from "@/components/chat-assistant";
import { DataManagementPanel } from "@/components/data-management-panel";
import { MarksDistributionPanel } from "@/components/marks-distribution-panel";
import { AccountSettingsPanel } from "@/components/account-settings-panel";
import { StatusPanel } from "@/components/status-panel";
import { PortalUserMenu } from "@/components/portal-user-menu";
import { StudentInternshipSummary } from "@/components/student-internship-summary";
import { formatGradeDisplay } from "@/lib/format-grade";
import { CalendarDays, Download, User } from "lucide-react";
import Image from "next/image";

type PageProps = {
  searchParams: Promise<{
    batch?: string;
    semester?: string;
    usn?: string;
    tab?: string;
  }>;
};

export default async function Home({ searchParams }: PageProps) {
  const filters = await searchParams;
  const activeTab = (filters.tab ?? "overview").toLowerCase();

  const dbBatchMap = await getBatchSemesterMapFromDb();
  const effectiveBatchMap = Object.keys(dbBatchMap).length > 0 ? dbBatchMap : BATCH_SEMESTER_MAP;

  const resolved = await resolveDashboardFilters({
    batch: filters.batch,
    semester: filters.semester,
    usn: filters.usn,
    batchMap: effectiveBatchMap,
  });

  const selectedBatch = resolved.batchYear;
  const selectedSemester = resolved.semester;
  const usnQuery = resolved.usnQuery;
  const batchOptions = Object.keys(effectiveBatchMap)
    .map(Number)
    .sort((a, b) => a - b);
  const availableSemesters = effectiveBatchMap[selectedBatch] ?? [];

  const [students, allStudents, stats] = await Promise.all([
    searchStudents({
      batchYear: selectedBatch,
      semester: selectedSemester,
      query: usnQuery || undefined,
    }),
    getStudentsForBatchSemester(selectedBatch, selectedSemester),
    getDashboardStats(selectedBatch, selectedSemester),
  ]);

  const selectedStudent =
    students.find((student) => student.usn.toUpperCase() === usnQuery.toUpperCase()) ?? students[0];
  const topCompanies = getTopCompanies(allStudents);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-[#9ad9cf] bg-[#b8efe3]">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/dsce-logo.png"
              alt="Dayananda Sagar College of Engineering Logo"
              width={56}
              height={56}
              className="h-12 w-12 rounded-full bg-white object-contain p-0.5 sm:h-14 sm:w-14"
              unoptimized
            />
            <h1 className="text-base font-semibold text-[var(--dsce-navy)] sm:text-2xl">
              DSCE | Department of AIML - Internship Portal
            </h1>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <PortalUserMenu />
            <nav className="hidden items-center gap-2 text-xs text-slate-700 md:flex">
              {DASHBOARD_LINKS.map((item) => (
                <a
                  key={item}
                  href={`/?tab=${encodeURIComponent(item.toLowerCase())}&batch=${selectedBatch}&semester=${selectedSemester}&usn=${encodeURIComponent(usnQuery)}`}
                  className={`rounded-full px-3 py-1 ${
                    activeTab === item.toLowerCase() ? "bg-white font-semibold text-[var(--dsce-blue)]" : ""
                  }`}
                >
                  {item}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] p-4 sm:p-6">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <header className="mb-6 flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Internship Dashboard</h2>
              <p className="text-sm text-muted">
                Select a batch and semester, then search by USN to view student internship details.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCard label="Total Students" value={String(stats.totalStudents)} />
              <MetricCard label="Internships" value={String(stats.internshipCount)} />
              <MetricCard label="Batch" value={String(selectedBatch)} />
            </div>
          </header>

          <DashboardFilters
            batchYear={selectedBatch}
            semester={selectedSemester}
            usn={usnQuery}
            tab={activeTab}
            batchOptions={batchOptions}
            semesterOptions={availableSemesters}
            contextAdjusted={resolved.contextAdjusted}
          />

          {activeTab === "overview" ? (
            <section className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-xl border border-border bg-white p-4 lg:col-span-2">
              {!selectedStudent ? (
                <div className="space-y-2 text-sm text-muted">
                  <p>No students found for batch {selectedBatch}, semester {selectedSemester}.</p>
                  {usnQuery ? (
                    <p>Try another USN/name, or switch to batch 2022 / 2021 where imported data exists.</p>
                  ) : (
                    <p>Select batch 2022 or 2021, or search by USN — search works across all batches.</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="border-b border-border pb-4">
                    <h3 className="text-xl font-semibold">{selectedStudent.fullName}</h3>
                    <p className="text-sm text-muted">USN: {selectedStudent.usn}</p>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <InfoItem label="Batch" value={String(selectedStudent.batch.year)} />
                    <InfoItem label="Semester" value={String(selectedStudent.semesterRecord.semester)} />
                    <InfoItem label="Course Code" value={selectedStudent.semesterRecord.courseCode} />
                    <InfoItem label="Course Name" value={selectedStudent.semesterRecord.courseName} />
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
                    <InfoItem
                      label="Grade"
                      value={formatGradeDisplay(selectedStudent.internship?.grade)}
                    />
                  </div>
                  <StudentInternshipSummary usn={selectedStudent.usn} />
                </>
              )}
            </article>

            <aside className="space-y-4">
              <div className="rounded-xl border border-border bg-white p-4">
                <h4 className="mb-3 font-semibold">Internship Report</h4>
                {selectedStudent ? (
                  <a
                    href={`/api/documents/by-usn/${selectedStudent.usn}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
                  >
                    <Download className="h-4 w-4" />
                    Download Soft Copy
                  </a>
                ) : <p className="text-sm text-muted">No student selected.</p>}
                <p className="mt-2 text-xs text-muted">Report filename should include the student USN.</p>
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
          ) : null}

          {activeTab === "students" ? (
            <section className="rounded-xl border border-border bg-white p-4">
              <h3 className="mb-3 text-lg font-semibold">Students ({allStudents.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left">USN</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Company</th>
                      <th className="px-3 py-2 text-left">Role</th>
                      <th className="px-3 py-2 text-left">Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allStudents.map((student) => {
                      const evalRow = getEvaluationSnapshot(student.internship?.sourceRowRawJson);
                      return (
                        <tr key={student.id} className="border-b border-border">
                          <td className="px-3 py-2">{student.usn}</td>
                          <td className="px-3 py-2">{student.fullName}</td>
                          <td className="px-3 py-2">{student.internship?.companyName ?? "-"}</td>
                          <td className="px-3 py-2">{student.internship?.roleTitle ?? "-"}</td>
                          <td className="px-3 py-2">{evalRow.totalMarks ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === "marks distribution" ? (
            <MarksDistributionPanel
              students={allStudents}
              batchYear={selectedBatch}
              semester={selectedSemester}
              focusUsn={usnQuery || undefined}
              focusStudent={selectedStudent ?? null}
              totalStudents={stats.totalStudents}
              internshipCount={stats.internshipCount}
            />
          ) : null}

          {activeTab === "internships" ? (
            <section className="space-y-4">
              <div className="rounded-xl border border-border bg-white p-4">
                <h3 className="mb-3 text-lg font-semibold">Top Internship Companies</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {topCompanies.map((item) => (
                    <MetricCard key={item.name} label={item.name} value={`${item.count} students`} />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-white p-4">
                <h4 className="mb-3 font-semibold">Internship Records</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left">USN</th>
                        <th className="px-3 py-2 text-left">Student</th>
                        <th className="px-3 py-2 text-left">Company</th>
                        <th className="px-3 py-2 text-left">Duration</th>
                        <th className="px-3 py-2 text-left">Stipend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allStudents.map((student) => (
                        <tr key={student.id} className="border-b border-border">
                          <td className="px-3 py-2">{student.usn}</td>
                          <td className="px-3 py-2">{student.fullName}</td>
                          <td className="px-3 py-2">{student.internship?.companyName ?? "-"}</td>
                          <td className="px-3 py-2">
                            {student.internship?.durationText ??
                              `${student.internship?.startDateRaw ?? "-"} to ${student.internship?.endDateRaw ?? "-"}`}
                          </td>
                          <td className="px-3 py-2">{student.internship?.stipend ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "status" ? (
            <section className="rounded-2xl border border-border bg-[#f8fafc] p-5 sm:p-8">
              <StatusPanel
                initialBatchYear={selectedBatch}
                initialSemester={selectedSemester}
                batchOptions={batchOptions}
              />
            </section>
          ) : null}

          {activeTab === "settings" ? (
            <section className="max-w-3xl">
              <AccountSettingsPanel />
            </section>
          ) : null}

          {activeTab === "data management" ? (
            <section className="rounded-2xl border border-border bg-[#eef6fb] p-5 shadow-inner sm:p-8">
              <DataManagementPanel />
            </section>
          ) : null}
        </div>
        <ChatAssistant
          selectedUsn={selectedStudent?.usn}
          selectedName={selectedStudent?.fullName}
        />
      </main>
    </div>
  );
}

function getEvaluationSnapshot(rawJson?: string | null) {
  const fallback = {
    totalMarks: undefined as string | undefined,
    reportMarks: undefined as string | undefined,
    presentationMarks: undefined as string | undefined,
    evaluatorName: undefined as string | undefined,
  };
  if (!rawJson) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(rawJson) as {
      evaluation?: {
        totalMarks?: string;
        reportMarks?: string;
        presentationMarks?: string;
        evaluatorName?: string;
      };
      ["TOTAL\n(100)"]?: string;
      ["Max-100"]?: string;
    };
    return {
      totalMarks: parsed.evaluation?.totalMarks ?? parsed["TOTAL\n(100)"] ?? parsed["Max-100"],
      reportMarks: parsed.evaluation?.reportMarks,
      presentationMarks: parsed.evaluation?.presentationMarks,
      evaluatorName: parsed.evaluation?.evaluatorName,
    };
  } catch {
    return fallback;
  }
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-slate-50 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function getTopCompanies(
  students: Array<{ internship: { companyName: string } | null }>,
) {
  const countMap = new Map<string, number>();
  for (const student of students) {
    const company = student.internship?.companyName?.trim();
    if (!company) continue;
    countMap.set(company, (countMap.get(company) ?? 0) + 1);
  }
  return Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, count }));
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