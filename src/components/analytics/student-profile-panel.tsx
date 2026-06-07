"use client";

import type { StudentProfileAnalytics } from "@/lib/analytics";
import { CheckCircle2, Circle, Download, User } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type StudentProfilePanelProps = {
  profile: StudentProfileAnalytics;
};

export function StudentProfilePanel({ profile }: StudentProfilePanelProps) {
  const skillChartData = profile.skillScores.map((s) => ({
    skill: s.skill,
    average: s.value,
    max: s.max,
  }));

  return (
    <section className="rounded-xl border-2 border-[#9ad9cf] bg-gradient-to-br from-white to-[#f0faf8] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#9ad9cf]/50 pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2.5">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
              Student profile
            </p>
            <h3 className="text-xl font-semibold text-[var(--dsce-navy)]">{profile.fullName}</h3>
            <p className="text-sm text-muted">
              {profile.usn} · Batch {profile.batchYear} · Sem {profile.semester}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {profile.company} · {profile.role}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <ScoreBadge
            label="Total (out of 100)"
            value={profile.finalTotal !== null ? String(profile.finalTotal) : "—"}
            highlight
          />
          <ScoreBadge
            label="Reduced marks"
            value={profile.reducedMarks ?? "—"}
          />
          <a
            href={`/api/documents/by-usn/${profile.usn}`}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-white px-3 py-2 text-xs font-medium text-primary hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Report PDF
          </a>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="mb-4 text-sm font-semibold text-[var(--dsce-navy)]">Review & marks timeline</h4>
        <div className="relative grid gap-0 md:grid-cols-4">
          {profile.timeline.map((step, index) => (
            <TimelineStep key={step.stage} step={step} isLast={index === profile.timeline.length - 1} />
          ))}
        </div>
      </div>

      {skillChartData.length > 0 ? (
        <div className="mt-6 rounded-lg border border-border bg-white p-4">
          <h4 className="mb-2 text-sm font-semibold text-[var(--dsce-navy)]">Skill-wise performance</h4>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={skillChartData} margin={{ top: 4, right: 8, left: 8, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="skill" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={48}>
                <Label value="Skills" offset={-4} position="insideBottom" style={{ fontSize: 12 }} />
              </XAxis>
              <YAxis tick={{ fontSize: 11 }}>
                <Label
                  value="Score"
                  angle={-90}
                  position="insideLeft"
                  style={{ fontSize: 12, textAnchor: "middle" }}
                />
              </YAxis>
              <Tooltip formatter={(v) => [`${v ?? 0}`, "Score"]} />
              <Bar dataKey="average" fill="#0f4c81" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </section>
  );
}

function TimelineStep({
  step,
  isLast,
}: {
  step: StudentProfileAnalytics["timeline"][number];
  isLast: boolean;
}) {
  return (
    <div className="relative flex flex-col items-center px-2 pb-4 text-center md:pb-0">
      {!isLast ? (
        <div className="absolute left-1/2 top-5 hidden h-0.5 w-full bg-[#9ad9cf] md:block" />
      ) : null}
      <div
        className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 ${
          step.available
            ? "border-primary bg-white text-primary"
            : "border-slate-300 bg-slate-50 text-slate-400"
        }`}
      >
        {step.available ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </div>
      <p className="mt-2 text-xs font-semibold text-[var(--dsce-navy)]">{step.stage}</p>
      <p
        className={`mt-0.5 text-lg font-bold ${
          step.marks !== null ? "text-primary" : "text-amber-700"
        }`}
      >
        {step.marks !== null ? step.marks : "N/A"}
      </p>
      {!step.available ? (
        <p className="text-[10px] text-muted">Not imported</p>
      ) : step.skills.length > 0 ? (
        <p className="mt-1 text-[10px] text-muted">
          {step.skills.slice(0, 2).map((s) => `${s.label}: ${s.value}`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function ScoreBadge({
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
      className={`min-w-[7rem] rounded-lg border px-3 py-2 ${
        highlight ? "border-primary/30 bg-white" : "border-border bg-slate-50"
      }`}
    >
      <p className="text-[10px] font-medium text-muted">{label}</p>
      <p
        className={`text-xl font-bold ${
          value === "—" ? "text-amber-700" : highlight ? "text-primary" : "text-[var(--dsce-navy)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
