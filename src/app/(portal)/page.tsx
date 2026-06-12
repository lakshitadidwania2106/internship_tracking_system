import { BATCH_SEMESTER_MAP, DASHBOARD_LINKS, DASHBOARD_SEMESTER_OPTIONS } from "@/lib/constants";
import {
  getBatchSemesterMapFromDb,
  getDashboardStats,
  getStudentsForBatchSemester,
  resolveDashboardFilters,
  searchStudents,
} from "@/lib/data";
import {
  buildDashboardAnalytics,
  buildStudentProfileAnalytics,
  type BatchCohortSummary,
} from "@/lib/analytics";
import { DashboardFilters } from "@/components/dashboard-filters";
import { ChatAssistant } from "@/components/chat-assistant";
import { DataManagementPanel } from "@/components/data-management-panel";
import { AccountSettingsPanel } from "@/components/account-settings-panel";
import { StatusPanel } from "@/components/status-panel";
import { PortalUserMenu } from "@/components/portal-user-menu";
import { StudentInternshipSummary } from "@/components/student-internship-summary";
import { OverviewDashboard } from "@/components/analytics/overview-dashboard";
import { StudentProfilePanel } from "@/components/analytics/student-profile-panel";
import { StudentSearchHint } from "@/components/analytics/compact-student-list";
import { formatGradeDisplay } from "@/lib/format-grade";
import { Download } from "lucide-react";
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
  const semesterOptions = [...DASHBOARD_SEMESTER_OPTIONS];

  const [students, allStudents, stats] = await Promise.all([
    searchStudents({
      batchYear: selectedBatch,
      semester: selectedSemester,
      query: usnQuery || undefined,
    }),
    getStudentsForBatchSemester(selectedBatch, selectedSemester),
    getDashboardStats(selectedBatch, selectedSemester),
  ]);

  const analytics = buildDashboardAnalytics(allStudents, stats.internshipCount, selectedSemester);

  const cohortSemesters = (batchYear: number) =>
    batchYear === 2020 || batchYear === 2022 ? [8] : [...DASHBOARD_SEMESTER_OPTIONS];

  const allBatchesSummary: BatchCohortSummary[] = await Promise.all(
    batchOptions.flatMap((batchYear) =>
      cohortSemesters(batchYear).map(async (semester) => {
        const [cohortStudents, cohortStats] = await Promise.all([
          getStudentsForBatchSemester(batchYear, semester),
          getDashboardStats(batchYear, semester),
        ]);
        const cohortAnalytics = buildDashboardAnalytics(
          cohortStudents,
          cohortStats.internshipCount,
          semester,
        );
        return {
          batchYear,
          semester,
          totalStudents: cohortStats.totalStudents,
          totalInternships: cohortStats.internshipCount,
          averageMarks: cohortAnalytics.overview.averageMarks,
          passPercentage: cohortAnalytics.overview.passPercentage,
          completionPercent: cohortAnalytics.internship.completionPercent,
        };
      }),
    ),
  );

  const focusStudent =
    usnQuery.length > 0
      ? allStudents.find((s) => s.usn.toUpperCase() === usnQuery.toUpperCase()) ??
        students.find((s) => s.usn.toUpperCase() === usnQuery.toUpperCase()) ??
        null
      : null;

  const studentProfile = focusStudent
    ? buildStudentProfileAnalytics(focusStudent, selectedBatch, selectedSemester)
    : null;

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
            <div>
              <h1 className="text-base font-semibold text-[var(--dsce-navy)] sm:text-xl">
                DSCE AIML · Internship Analytics Portal
              </h1>
              <p className="hidden text-xs text-slate-600 sm:block">
                Faculty & HOD dashboard — marks, reviews & outcomes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <PortalUserMenu />
            <nav className="hidden items-center gap-1 text-xs text-slate-700 lg:flex">
              {DASHBOARD_LINKS.map((item) => (
                <a
                  key={item}
                  href={`/?tab=${encodeURIComponent(item.toLowerCase())}&batch=${selectedBatch}&semester=${selectedSemester}&usn=${encodeURIComponent(usnQuery)}`}
                  className={`rounded-full px-3 py-1.5 transition ${
                    activeTab === item.toLowerCase()
                      ? "bg-white font-semibold text-[var(--dsce-blue)] shadow-sm"
                      : "hover:bg-white/60"
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
        <DashboardFilters
          batchYear={selectedBatch}
          semester={selectedSemester}
          usn={usnQuery}
          tab={activeTab}
          batchOptions={batchOptions}
          semesterOptions={semesterOptions}
          contextAdjusted={resolved.contextAdjusted}
        />

        {activeTab === "overview" ? (
          <div className="space-y-6">
            {studentProfile ? (
              <>
                <StudentProfilePanel profile={studentProfile} />
                <section className="rounded-xl border border-border bg-white p-4">
                  <div className="border-b border-border pb-4">
                    <h3 className="text-lg font-semibold">{focusStudent?.fullName}</h3>
                    <p className="text-sm text-muted">USN: {focusStudent?.usn}</p>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <InfoItem label="Batch" value={String(focusStudent?.batch.year ?? selectedBatch)} />
                    <InfoItem
                      label="Semester"
                      value={String(focusStudent?.semesterRecord.semester ?? selectedSemester)}
                    />
                    <InfoItem
                      label="Course Code"
                      value={focusStudent?.semesterRecord.courseCode ?? "-"}
                    />
                    <InfoItem
                      label="Course Name"
                      value={focusStudent?.semesterRecord.courseName ?? "-"}
                    />
                    <InfoItem
                      label="Credits"
                      value={String(focusStudent?.semesterRecord.credits ?? "-")}
                    />
                    <InfoItem
                      label="Company"
                      value={focusStudent?.internship?.companyName ?? "Not available"}
                    />
                    <InfoItem
                      label="Role"
                      value={focusStudent?.internship?.roleTitle ?? "Not available"}
                    />
                    <InfoItem label="Stipend" value={focusStudent?.internship?.stipend ?? "-"} />
                    <InfoItem
                      label="Duration"
                      value={
                        focusStudent?.internship?.durationText ??
                        `${focusStudent?.internship?.startDateRaw ?? "-"} to ${focusStudent?.internship?.endDateRaw ?? "-"}`
                      }
                    />
                    <InfoItem
                      label="Grade"
                      value={formatGradeDisplay(focusStudent?.internship?.grade)}
                    />
                  </div>
                  {focusStudent ? <StudentInternshipSummary usn={focusStudent.usn} /> : null}
                  <div className="mt-4 rounded-lg border border-border bg-slate-50 p-4">
                    <h4 className="mb-3 font-semibold">Internship Report</h4>
                    <a
                      href={`/api/documents/by-usn/${focusStudent?.usn}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
                    >
                      <Download className="h-4 w-4" />
                      Download Soft Copy
                    </a>
                    <p className="mt-2 text-xs text-muted">
                      Report filename should include the student USN.
                    </p>
                  </div>
                </section>
              </>
            ) : usnQuery ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                No student matching <strong>{usnQuery}</strong> in batch {selectedBatch}, semester{" "}
                {selectedSemester}. Try another USN or adjust batch/semester filters.
              </div>
            ) : (
              <StudentSearchHint />
            )}
            <OverviewDashboard
              analytics={analytics}
              batchYear={selectedBatch}
              semester={selectedSemester}
              allBatchesSummary={allBatchesSummary}
            />
          </div>
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

        <ChatAssistant
          selectedUsn={focusStudent?.usn ?? students[0]?.usn ?? allStudents[0]?.usn}
          selectedName={focusStudent?.fullName ?? students[0]?.fullName ?? allStudents[0]?.fullName}
        />
      </main>
    </div>
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
