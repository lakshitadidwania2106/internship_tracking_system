"use client";

import type { ReactNode } from "react";
import type { BatchCohortSummary, DashboardAnalytics } from "@/lib/analytics";
import {
  GradePieChart,
  HistogramChart,
  InternshipPieChart,
  KpiCard,
  ReviewComparisonChart,
  SkillRadarChart,
} from "@/components/analytics/analytics-charts";
import { BarChart3, Briefcase, GraduationCap, Layers, TrendingUp } from "lucide-react";

type OverviewDashboardProps = {
  analytics: DashboardAnalytics;
  batchYear: number;
  semester: number;
  allBatchesSummary: BatchCohortSummary[];
};

export function OverviewDashboard({
  analytics,
  batchYear,
  semester,
  allBatchesSummary,
}: OverviewDashboardProps) {
  const { overview: o } = analytics;
  const fmt = (n: number | null, suffix = "") =>
    n !== null ? `${n.toFixed(1)}${suffix}` : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-[var(--dsce-navy)]">
            <BarChart3 className="h-5 w-5 text-primary" />
            Analytics Overview
          </h3>
          <p className="text-sm text-muted">
            Batch {batchYear} · Semester {semester} — faculty insights from imported marks & reviews
          </p>
        </div>
      </div>

      {allBatchesSummary.length > 0 ? (
        <section className="rounded-xl border border-[#9ad9cf] bg-gradient-to-r from-[#e8f8f5] to-white p-4">
          <h4 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--dsce-navy)]">
            <Layers className="h-4 w-4 text-primary" />
            All batches summary
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white/80 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">Batch</th>
                  <th className="px-3 py-2">Sem</th>
                  <th className="px-3 py-2">Students</th>
                  <th className="px-3 py-2">Internships</th>
                  <th className="px-3 py-2">Placement</th>
                  <th className="px-3 py-2">Avg marks</th>
                  <th className="px-3 py-2">Pass rate</th>
                </tr>
              </thead>
              <tbody>
                {allBatchesSummary.map((row) => (
                  <tr
                    key={`${row.batchYear}-${row.semester}`}
                    className={`border-t border-[#9ad9cf]/40 ${
                      row.batchYear === batchYear && row.semester === semester
                        ? "bg-white font-medium"
                        : ""
                    }`}
                  >
                    <td className="px-3 py-2">{row.batchYear}</td>
                    <td className="px-3 py-2">{row.semester}</td>
                    <td className="px-3 py-2">{row.totalStudents}</td>
                    <td className="px-3 py-2">{row.totalInternships}</td>
                    <td className="px-3 py-2">{row.completionPercent}%</td>
                    <td className="px-3 py-2">{fmt(row.averageMarks)}</td>
                    <td className="px-3 py-2">
                      {row.passPercentage !== null ? `${row.passPercentage}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            Highlights the cohort you are viewing. Batch 2021 semester 6 uses merged marks stored on
            semester 8 records when a separate sem 6 import has not run.
          </p>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Students" value={String(o.totalStudents)} accent="blue" />
        <KpiCard
          label="Internships"
          value={String(o.totalInternships)}
          sub={`${analytics.internship.completionPercent}% placed`}
          accent="teal"
        />
        <KpiCard label="Average Marks" value={fmt(o.averageMarks)} sub="Final (out of 100)" accent="gold" />
        <KpiCard
          label="Pass Rate"
          value={o.passPercentage !== null ? `${o.passPercentage}%` : "—"}
          sub="Marks ≥ 40"
          accent="teal"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <KpiCard label="Highest Marks" value={fmt(o.highestMarks)} accent="gold" />
        <KpiCard label="Lowest Marks" value={fmt(o.lowestMarks)} accent="rose" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Marks Distribution" icon={<TrendingUp className="h-4 w-4" />}>
          <HistogramChart data={analytics.marksHistogram} />
        </ChartPanel>
        <ChartPanel title="Performance Categories" icon={<GraduationCap className="h-4 w-4" />}>
          <GradePieChart data={analytics.gradeCategories} />
        </ChartPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="Review Performance Trend" icon={<TrendingUp className="h-4 w-4" />}>
          <ReviewComparisonChart data={analytics.reviewProgress} />
          <ReviewInsightStrip progress={analytics.reviewProgress} />
        </ChartPanel>
        <ChartPanel title="Internship Placement" icon={<Briefcase className="h-4 w-4" />}>
          <InternshipPieChart
            withInternship={analytics.internship.withInternship}
            withoutInternship={analytics.internship.withoutInternship}
          />
        </ChartPanel>
      </div>

      <ChartPanel title="Skill-wise Averages" icon={<BarChart3 className="h-4 w-4" />}>
        <SkillRadarChart skills={analytics.skillAverages} />
      </ChartPanel>
    </div>
  );
}

function ChartPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <h4 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--dsce-navy)]">
        <span className="text-primary">{icon}</span>
        {title}
      </h4>
      {children}
    </section>
  );
}

function ReviewInsightStrip({
  progress,
}: {
  progress: Array<{ stage: string; average: number | null }>;
}) {
  const avgs = progress.filter((p) => p.average !== null).map((p) => p.average!);
  if (avgs.length < 2) return null;

  const first = avgs[0];
  const last = avgs[avgs.length - 1];
  const delta = last - first;
  const direction = delta > 1 ? "improved" : delta < -1 ? "declined" : "remained stable";

  return (
    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
      Cohort average {direction} by{" "}
      <strong>{Math.abs(Math.round(delta * 10) / 10)}</strong> points from first review stage to final
      marks.
    </p>
  );
}

