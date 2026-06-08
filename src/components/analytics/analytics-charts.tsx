"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartBucket, SkillAverage } from "@/lib/analytics";

const COLORS = {
  primary: "#0f4c81",
  secondary: "#2a7ab8",
  gold: "#d2a52a",
  teal: "#0d9488",
  amber: "#d97706",
  rose: "#e11d48",
  slate: "#64748b",
};

const PIE_COLORS = [COLORS.primary, COLORS.secondary, COLORS.gold, COLORS.rose];

export function HistogramChart({ data }: { data: ChartBucket[] }) {
  const hasData = data.some((bucket) => bucket.count > 0);
  if (!hasData) {
    return <EmptyChart message="No final marks data for this cohort yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }}>
          <Label value="Marks Range" offset={-8} position="insideBottom" style={{ fontSize: 12 }} />
        </XAxis>
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }}>
          <Label
            value="Number of Students"
            angle={-90}
            position="insideLeft"
            style={{ fontSize: 12, textAnchor: "middle" }}
          />
        </YAxis>
        <Tooltip
          formatter={(value) => [`${value ?? 0} students`, "Count"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #dbe4ef" }}
        />
        <Bar dataKey="count" fill={COLORS.primary} radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GradePieChart({ data }: { data: ChartBucket[] }) {
  const chartData = data.filter((d) => d.count > 0);
  if (chartData.length === 0) {
    return <EmptyChart message="No final marks data for grade distribution." />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={88}
          paddingAngle={2}
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value, name) => [`${value ?? 0} students`, name]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ReviewComparisonChart({
  data,
}: {
  data: Array<{ stage: string; average: number | null; count: number }>;
}) {
  const chartData = data
    .filter((d) => d.average !== null && d.count > 0)
    .map((d) => ({
      stage: d.stage,
      average: Math.round((d.average ?? 0) * 10) / 10,
      count: d.count,
    }));

  if (chartData.length === 0) {
    return <EmptyChart message="No review or final marks trend data for this cohort." />;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="stage" tick={{ fontSize: 12 }}>
          <Label value="Review Stage" offset={-8} position="insideBottom" style={{ fontSize: 12 }} />
        </XAxis>
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }}>
          <Label
            value="Average Score"
            angle={-90}
            position="insideLeft"
            style={{ fontSize: 12, textAnchor: "middle" }}
          />
        </YAxis>
        <Tooltip
          formatter={(value, _name, props) => {
            const payload = props?.payload as { count?: number } | undefined;
            return [`${value ?? 0} / 100 (${payload?.count ?? 0} students)`, "Average"];
          }}
        />
        <Line
          type="monotone"
          dataKey="average"
          stroke={COLORS.teal}
          strokeWidth={chartData.length > 1 ? 3 : 2}
          connectNulls
          dot={{ r: 5, fill: COLORS.primary }}
          activeDot={{ r: 7 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SkillRadarChart({ skills }: { skills: SkillAverage[] }) {
  if (skills.length === 0) {
    return <EmptyChart message="No skill columns detected in imported marks." />;
  }
  const data = skills.map((s) => ({
    skill: s.skill,
    average: Math.round(s.average * 10) / 10,
    max: s.maxScore,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="skill"
          tick={{ fontSize: 10 }}
          angle={-25}
          textAnchor="end"
          interval={0}
          height={56}
        >
          <Label value="Skills" offset={-4} position="insideBottom" style={{ fontSize: 12 }} />
        </XAxis>
        <YAxis domain={[0, "auto"]} tick={{ fontSize: 11 }}>
          <Label
            value="Average Rating"
            angle={-90}
            position="insideLeft"
            style={{ fontSize: 12, textAnchor: "middle" }}
          />
        </YAxis>
        <Tooltip formatter={(value) => [`${value ?? 0}`, "Avg score"]} />
        <Bar dataKey="average" fill={COLORS.gold} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function InternshipPieChart({
  withInternship,
  withoutInternship,
}: {
  withInternship: number;
  withoutInternship: number;
}) {
  const data = [
    { label: "With internship", count: withInternship },
    { label: "Without internship", count: withoutInternship },
  ].filter((d) => d.count > 0);

  if (data.length === 0) {
    return <EmptyChart message="No internship records in this cohort." />;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={78}>
          <Cell fill={COLORS.teal} />
          <Cell fill={COLORS.slate} />
        </Pie>
        <Tooltip formatter={(value) => [`${value ?? 0} students`]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border bg-slate-50/80 px-4 text-center text-sm text-muted">
      {message}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "blue" | "gold" | "teal" | "rose";
}) {
  const accentClass = {
    blue: "border-l-[var(--dsce-blue)]",
    gold: "border-l-[var(--dsce-gold)]",
    teal: "border-l-teal-600",
    rose: "border-l-rose-500",
  }[accent ?? "blue"];

  return (
    <div className={`rounded-xl border border-border bg-white p-4 shadow-sm border-l-4 ${accentClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--dsce-navy)]">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

