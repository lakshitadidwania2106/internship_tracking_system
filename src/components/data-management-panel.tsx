"use client";

import { BATCH_SEMESTER_MAP, getMarksImportPreset, type MarkUploadKind } from "@/lib/constants";
import {
  CalendarClock,
  CheckCircle2,
  Cloud,
  FileSpreadsheet,
  FolderArchive,
  Layers,
  Loader2,
  Plus,
  Upload,
} from "lucide-react";
import type { ReactNode } from "react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type BatchRow = {
  id: number;
  year: number;
  semesters: Array<{
    id: number;
    semester: number;
    courseCode: string;
    courseName: string;
    credits: number;
    reviewCount: number;
  }>;
  _count: { students: number };
};

export function DataManagementPanel() {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [batchYearInput, setBatchYearInput] = useState("");
  const [semBatchYear, setSemBatchYear] = useState<number | "">("");
  const [semesterNo, setSemesterNo] = useState("8");
  const [reviewCount, setReviewCount] = useState("3");
  const [courseCode, setCourseCode] = useState("21AIL64");
  const [courseName, setCourseName] = useState("Internship");
  const [credits, setCredits] = useState("4");

  const [uploadBatchYear, setUploadBatchYear] = useState<number | "">("");
  const [uploadSemester, setUploadSemester] = useState("8");

  const [reviewFiles, setReviewFiles] = useState<Record<string, File | undefined>>({});
  const [finalFile, setFinalFile] = useState<File | undefined>();
  const [detailsFile, setDetailsFile] = useState<File | undefined>();
  const [reportsZip, setReportsZip] = useState<File | undefined>();

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/batches");
      const data = (await res.json()) as { batches?: BatchRow[] };
      setBatches(data.batches ?? []);
    } catch {
      setMessage("Could not load batches.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (batches.length === 0 || uploadBatchYear !== "") return;
    const y = batches[batches.length - 1].year;
    setUploadBatchYear(y);
    setSemBatchYear(y);
  }, [batches, uploadBatchYear]);

  useEffect(() => {
    if (uploadBatchYear === "") return;
    const sems = BATCH_SEMESTER_MAP[uploadBatchYear];
    if (sems?.length && !sems.includes(Number(uploadSemester))) {
      setUploadSemester(String(sems[0]));
    }
  }, [uploadBatchYear, uploadSemester]);

  const selectedUploadBatch = useMemo(() => {
    if (uploadBatchYear === "") return undefined;
    return batches.find((b) => b.year === uploadBatchYear);
  }, [batches, uploadBatchYear]);

  const reportStudentCount = selectedUploadBatch?._count.students ?? 0;

  async function postJson(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? "Request failed.");
    }
    return data;
  }

  async function createBatch(e: FormEvent) {
    e.preventDefault();
    const year = Number(batchYearInput.trim().split(/[-–]/)[0]);
    if (!Number.isFinite(year)) {
      setMessage("Enter a batch start year (e.g. 2024).");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await postJson("/api/batches", { year });
      setMessage(`Batch ${year} is ready.`);
      setBatchYearInput("");
      await loadBatches();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not create batch.");
    } finally {
      setBusy(false);
    }
  }

  async function addSemester(e: FormEvent) {
    e.preventDefault();
    if (semBatchYear === "") {
      setMessage("Select a batch year for the semester.");
      return;
    }
    const semester = Number(semesterNo);
    const rc = Number(reviewCount);
    const cr = Number(credits);
    if (!Number.isFinite(semester)) {
      setMessage("Semester must be a number.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await postJson(`/api/batches/${semBatchYear}/semesters`, {
        semester,
        reviewCount: Number.isFinite(rc) ? rc : undefined,
        courseCode: courseCode.trim() || undefined,
        courseName: courseName.trim() || undefined,
        credits: Number.isFinite(cr) ? cr : undefined,
      });
      setMessage(`Semester ${semester} saved for batch ${semBatchYear}.`);
      await loadBatches();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save semester.");
    } finally {
      setBusy(false);
    }
  }

  async function submitMarks(markKind: MarkUploadKind, file: File | undefined) {
    if (uploadBatchYear === "" || !uploadSemester) {
      setMessage("Choose batch year and semester for uploads.");
      return;
    }
    if (!file) {
      setMessage("Pick a spreadsheet first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("batchYear", String(uploadBatchYear));
      fd.set("semester", uploadSemester);
      fd.set("markKind", markKind);
      const preset = getMarksImportPreset(uploadBatchYear, Number(uploadSemester), markKind);
      if (preset.sheetName) fd.set("sheetName", preset.sheetName);
      if (preset.headerRowIndex !== undefined) {
        fd.set("headerRowIndex", String(preset.headerRowIndex));
      }
      if (preset.headerRowSpan !== undefined) {
        fd.set("headerRowSpan", String(preset.headerRowSpan));
      }
      const res = await fetch("/api/marks/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { message?: string }).message ?? "Upload failed.");
      }
      setMessage(
        `${markKind}: stored & imported (${(data as { result?: { imported?: number } }).result?.imported ?? "?"} rows).`,
      );
      await loadBatches();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReportsZip(e: FormEvent) {
    e.preventDefault();
    if (uploadBatchYear === "") {
      setMessage("Choose batch year for the ZIP.");
      return;
    }
    if (!reportsZip) {
      setMessage("Select a ZIP of PDF reports.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.set("file", reportsZip);
      fd.set("batchYear", String(uploadBatchYear));
      fd.set("semester", uploadSemester);
      const res = await fetch("/api/reports/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { message?: string }).message ?? "Upload failed.");
      }
      const id = (data as { storedFileId?: number }).storedFileId;
      const pdfImport = (data as { pdfImport?: { linked?: number; unmatchedPdfCount?: number } }).pdfImport;
      setMessage(
        `ZIP stored — download archive: /api/reports/download/${id ?? ""}. ` +
          `PDFs in StudentDocument (Prisma): linked ${pdfImport?.linked ?? 0}, ` +
          `not matched ${pdfImport?.unmatchedPdfCount ?? 0}.`,
      );
      await loadBatches();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "ZIP upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Data management</p>
          <h3 className="text-2xl font-semibold text-[var(--dsce-navy)]">New data & reporting</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Configure batches and semesters, import spreadsheets into the database, and park raw Excel/ZIPs in
            Cloudflare R2 (or local fallback when env vars are absent). Only storage keys are persisted.
          </p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--dsce-navy)]">
            <Plus className="h-4 w-4" />
            Create new batch
          </div>
          <form onSubmit={createBatch} className="space-y-3">
            <label className="block text-xs font-medium text-muted">
              Batch start year
              <input
                value={batchYearInput}
                onChange={(e) => setBatchYearInput(e.target.value)}
                placeholder="e.g. 2024 (or 2024–2028)"
                className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none ring-primary/15 focus:ring"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
            >
              {busy ? "Saving…" : "Create batch"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--dsce-navy)]">
            <CalendarClock className="h-4 w-4" />
            Add semester
          </div>
          <form onSubmit={addSemester} className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-muted sm:col-span-2">
              Batch
              <select
                value={semBatchYear === "" ? "" : String(semBatchYear)}
                onChange={(e) => setSemBatchYear(e.target.value ? Number(e.target.value) : "")}
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none ring-primary/15 focus:ring"
              >
                <option value="">Select batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.year}>
                    Batch {b.year}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-muted">
              Semester no.
              <input
                value={semesterNo}
                onChange={(e) => setSemesterNo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none ring-primary/15 focus:ring"
              />
            </label>
            <label className="block text-xs font-medium text-muted">
              Number of reviews
              <input
                value={reviewCount}
                onChange={(e) => setReviewCount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none ring-primary/15 focus:ring"
              />
            </label>
            <label className="block text-xs font-medium text-muted">
              Course code
              <input
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none ring-primary/15 focus:ring"
              />
            </label>
            <label className="block text-xs font-medium text-muted">
              Course name
              <input
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none ring-primary/15 focus:ring"
              />
            </label>
            <label className="block text-xs font-medium text-muted sm:col-span-2">
              Credits
              <input
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none ring-primary/15 focus:ring"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="sm:col-span-2 w-full rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
            >
              + Add semester data
            </button>
          </form>
        </div>
      </section>

      <div className="rounded-2xl border border-dashed border-emerald-300/80 bg-gradient-to-br from-emerald-50/80 to-white p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Layers className="h-5 w-5 text-emerald-700" />
          <div>
            <p className="text-sm font-semibold text-[var(--dsce-navy)]">Upload context</p>
            <p className="text-xs text-muted">Applies to spreadsheets and the reports ZIP below.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-xs font-medium text-muted">
            Batch year
            <select
              value={uploadBatchYear === "" ? "" : String(uploadBatchYear)}
              onChange={(e) => setUploadBatchYear(e.target.value ? Number(e.target.value) : "")}
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none ring-primary/15 focus:ring"
            >
              <option value="">Select batch</option>
              {batches.map((b) => (
                <option key={b.id} value={b.year}>
                  Batch {b.year} ({b._count.students} students)
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-muted">
            Semester
            <select
              value={uploadSemester}
              onChange={(e) => setUploadSemester(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none ring-primary/15 focus:ring"
            >
              {(uploadBatchYear !== ""
                ? (BATCH_SEMESTER_MAP[uploadBatchYear] ?? [6, 8])
                : [6, 8]
              ).map((sem) => (
                <option key={sem} value={String(sem)}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <UploadCard
          title="Review-wise marking"
          subtitle="Each workbook is copied to object storage, then parsed into student rows."
          icon={<FileSpreadsheet className="h-5 w-5 text-emerald-800" />}
        >
          <div className="space-y-2">
            {(["review_1", "review_2", "review_3"] as const).map((kind) => (
              <label
                key={kind}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
              >
                <span className="inline-flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5" />
                  {kind.replace("_", " ").toUpperCase()} Excel
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) =>
                    setReviewFiles((prev) => ({ ...prev, [kind]: e.target.files?.[0] }))
                  }
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => submitMarks("review_1", reviewFiles.review_1)}
            className="mt-2 w-full rounded-xl bg-[#7ccf91] px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-[#6bc083] disabled:opacity-50"
          >
            Upload review 1
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submitMarks("review_2", reviewFiles.review_2)}
            className="w-full rounded-xl bg-[#7ccf91] px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-[#6bc083] disabled:opacity-50"
          >
            Upload review 2
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submitMarks("review_3", reviewFiles.review_3)}
            className="w-full rounded-xl bg-[#7ccf91] px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-[#6bc083] disabled:opacity-50"
          >
            Upload review 3
          </button>
        </UploadCard>

        <UploadCard
          title="Final & internship sheets"
          subtitle="Final merges evaluation columns; internship details seeds company rows."
          icon={<FileSpreadsheet className="h-5 w-5 text-emerald-800" />}
        >
          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-100">
            <span className="inline-flex items-center gap-2">
              <Upload className="h-3.5 w-3.5" />
              Final marks Excel
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => setFinalFile(e.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => submitMarks("final", finalFile)}
            className="mt-2 w-full rounded-xl bg-[#7ccf91] px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-[#6bc083] disabled:opacity-50"
          >
            Upload final Excel
          </button>
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-100">
            <span className="inline-flex items-center gap-2">
              <Upload className="h-3.5 w-3.5" />
              Student details Excel
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => setDetailsFile(e.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => submitMarks("internship_details", detailsFile)}
            className="w-full rounded-xl bg-[#7ccf91] px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-[#6bc083] disabled:opacity-50"
          >
            Upload details Excel
          </button>
        </UploadCard>

        <div className="flex flex-col rounded-2xl border border-border bg-white p-5 shadow-sm lg:row-span-1">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--dsce-navy)]">
            <FolderArchive className="h-4 w-4 text-emerald-800" />
            Student report repository
          </div>
          <form
            onSubmit={submitReportsZip}
            className="flex flex-1 flex-col rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4"
          >
            <p className="mb-3 text-center text-xs text-muted">
              PDF rows appear in Prisma Studio under{" "}
              <span className="font-medium text-slate-700">StudentDocument</span> (
              <code className="rounded bg-white px-1">internship_report_pdf</code>) with{" "}
              <code className="rounded bg-white px-1">storageKey</code> pointing at the file.
            </p>
            <label className="mb-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl bg-white px-3 py-6 text-center text-xs text-emerald-900 ring-1 ring-emerald-100">
              <Upload className="h-6 w-6 text-emerald-700" />
              <span className="font-semibold">Choose reports ZIP</span>
              <input
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => setReportsZip(e.target.files?.[0])}
              />
              {reportsZip ? (
                <span className="text-[11px] text-muted">{reportsZip.name}</span>
              ) : null}
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#7ccf91] px-3 py-2.5 text-xs font-semibold text-emerald-950 hover:bg-[#6bc083] disabled:opacity-50"
            >
              Upload student reports ZIP
            </button>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-border bg-white px-2 py-2">
                <p className="text-[10px] uppercase text-muted">Report scope</p>
                <p className="font-semibold text-slate-800">{reportStudentCount} students</p>
              </div>
              <div className="rounded-lg border border-border bg-white px-2 py-2">
                <p className="text-[10px] uppercase text-muted">Archive status</p>
                <p className="font-semibold text-slate-800">{reportsZip ? "Ready" : "Awaiting ZIP"}</p>
              </div>
            </div>
          </form>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted">
        <div className="inline-flex items-center gap-2">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
          <span>
            {loading ? "Refreshing batches…" : `System status: ready • ${batches.length} batch(es)`}
          </span>
        </div>
        <p className="text-[11px]">API: GET /api/batches · POST /api/marks/upload · POST /api/reports/upload</p>
      </footer>

      {message ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-slate-800">
          {message}
        </div>
      ) : null}
    </div>
  );
}

function UploadCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-xl bg-emerald-50 p-2">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-[var(--dsce-navy)]">{title}</p>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
