"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useTransition } from "react";

type DashboardFiltersProps = {
  batchYear: number;
  semester: number;
  usn: string;
  tab: string;
  batchOptions: number[];
  semesterOptions: number[];
  contextAdjusted?: boolean;
};

export function DashboardFilters({
  batchYear,
  semester,
  usn,
  tab,
  batchOptions,
  semesterOptions,
  contextAdjusted,
}: DashboardFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [usnInput, setUsnInput] = useState(usn);

  useEffect(() => {
    setUsnInput(usn);
  }, [usn]);

  function navigate(params: { batch: number; semester: number; usn: string }) {
    const search = new URLSearchParams();
    search.set("tab", tab);
    search.set("batch", String(params.batch));
    search.set("semester", String(params.semester));
    if (params.usn.trim()) {
      search.set("usn", params.usn.trim());
    }
    startTransition(() => {
      router.push(`/?${search.toString()}`);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    navigate({
      batch: Number(fd.get("batch")),
      semester: Number(fd.get("semester")),
      usn: String(fd.get("usn") ?? ""),
    });
  }

  return (
    <div className="mb-6 space-y-2">
      {contextAdjusted ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Student found in batch {batchYear}, semester {semester} — filters were updated to match records.
        </p>
      ) : null}
      <form
        method="get"
        action="/"
        onSubmit={onSubmit}
        className="grid gap-3 md:grid-cols-4"
      >
        <input type="hidden" name="tab" value={tab} />
        <select
          name="batch"
          defaultValue={String(batchYear)}
          disabled={isPending}
          onChange={(e) => {
            const batch = Number(e.target.value);
            const sem = semesterOptions.includes(semester)
              ? semester
              : semesterOptions[0];
            navigate({ batch, semester: sem, usn: usnInput });
          }}
          className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring disabled:opacity-60"
        >
          {batchOptions.map((option) => (
            <option key={option} value={option}>
              Batch {option}
            </option>
          ))}
        </select>
        <select
          name="semester"
          defaultValue={String(semester)}
          disabled={isPending}
          onChange={(e) => {
            navigate({
              batch: batchYear,
              semester: Number(e.target.value),
              usn: usnInput,
            });
          }}
          className="rounded-lg border border-border bg-white px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring disabled:opacity-60"
        >
          {semesterOptions.map((option) => (
            <option key={option} value={option}>
              Semester {option}
            </option>
          ))}
        </select>
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            name="usn"
            value={usnInput}
            onChange={(e) => setUsnInput(e.target.value)}
            disabled={isPending}
            placeholder="USN or student name (e.g. 1DS22AI001)"
            className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-primary/20 focus:ring disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 md:col-start-4"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isPending ? "Searching…" : "Search"}
        </button>
      </form>
    </div>
  );
}
