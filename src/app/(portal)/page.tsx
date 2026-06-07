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
} from "@/lib/analytics";
import { DashboardFilters } from "@/components/dashboard-filters";
import { ChatAssistant } from "@/components/chat-assistant";
import { DataManagementPanel } from "@/components/data-management-panel";
import { AccountSettingsPanel } from "@/components/account-settings-panel";
import { StatusPanel } from "@/components/status-panel";
import { PortalUserMenu } from "@/components/portal-user-menu";
import { OverviewDashboard } from "@/components/analytics/overview-dashboard";
import { StudentProfilePanel } from "@/components/analytics/student-profile-panel";
import {
  CompactStudentList,
  StudentSearchHint,
} from "@/components/analytics/compact-student-list";
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

  const analytics = buildDashboardAnalytics(allStudents, stats.internshipCount);

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
              <StudentProfilePanel profile={studentProfile} />
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
            />
          </div>
        ) : null}

        {activeTab === "students" ? (
          <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h3 className="mb-1 text-lg font-semibold text-[var(--dsce-navy)]">
              Student directory
            </h3>
            <p className="mb-4 text-sm text-muted">
              {allStudents.length} students · click a row to open analytics profile
            </p>
            <CompactStudentList
              students={allStudents}
              focusUsn={usnQuery}
              batchYear={selectedBatch}
              semester={selectedSemester}
            />
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

        <ChatAssistant
          selectedUsn={focusStudent?.usn ?? students[0]?.usn}
          selectedName={focusStudent?.fullName ?? students[0]?.fullName}
        />
      </main>
    </div>
  );
}
