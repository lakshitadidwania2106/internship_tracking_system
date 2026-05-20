"use client";

import {
  AlertTriangle,
  Database,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

type StoredFileRow = {
  id: number;
  kind: string;
  batchYear: number;
  semester: number;
  storageKey: string;
  originalName: string | null;
  byteSize: number | null;
  createdAt: string;
};

type StudentDocRow = {
  id: number;
  fileLabel: string;
  storageKey: string | null;
  student: { usn: string; fullName: string };
};

type StatusPayload = {
  batch: {
    year: number;
    _count: { students: number };
    semesters: Array<{ semester: number; courseCode: string; courseName: string }>;
  };
  storedFiles: StoredFileRow[];
  studentDocuments: StudentDocRow[];
  importJobs: Array<{
    id: number;
    sourceFileName: string;
    status: string;
    rowsImported: number;
    createdAt: string;
  }>;
  reviewMarkCount: number;
};

function formatBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function kindLabel(kind: string) {
  return kind.replace(/_/g, " ");
}

export function StatusPanel({
  initialBatchYear,
  initialSemester,
  batchOptions,
}: {
  initialBatchYear: number;
  initialSemester: number;
  batchOptions: number[];
}) {
  const [batchYear, setBatchYear] = useState(initialBatchYear);
  const [semester, setSemester] = useState(String(initialSemester));
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(
        `/api/batches/${batchYear}/files?semester=${encodeURIComponent(semester)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load status");
      setData(json as StatusPayload);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Load failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [batchYear, semester]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteStored(id: number) {
    if (!confirm("Delete this uploaded file from storage? Parsed student rows stay unless you re-import.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/files/stored/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Delete failed");
      setMessage(json.message ?? "File deleted.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDoc(id: number) {
    if (!confirm("Delete this student PDF from storage?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Delete failed");
      setMessage(json.message ?? "Document deleted.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBatch() {
    if (
      !confirm(
        `Permanently delete batch ${batchYear} and ALL students, marks, files, and documents? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/batches/${batchYear}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Delete failed");
      setMessage(json.message ?? "Batch deleted.");
      window.location.href = "/?tab=status";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Batch delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">System status</p>
          <h3 className="text-2xl font-semibold text-[var(--dsce-navy)]">Files & batch health</h3>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Inspect uploads per batch, remove archives to re-upload fresh files, or delete an entire batch.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={batchYear}
            onChange={(e) => setBatchYear(Number(e.target.value))}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
          >
            {batchOptions.map((y) => (
              <option key={y} value={y}>
                Batch {y}
              </option>
            ))}
          </select>
          <input
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="w-20 rounded-lg border border-border bg-white px-3 py-2 text-sm"
            placeholder="Sem"
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || busy}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-2 text-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href={`/?tab=data%20management&batch=${batchYear}&semester=${semester}`}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            <Upload className="h-4 w-4" />
            Upload new files
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading batch status…
        </p>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Students" value={String(data.batch._count.students)} icon={<Database className="h-4 w-4" />} />
            <StatCard label="Stored uploads" value={String(data.storedFiles.length)} icon={<FileText className="h-4 w-4" />} />
            <StatCard label="Report PDFs" value={String(data.studentDocuments.length)} icon={<FileText className="h-4 w-4" />} />
            <StatCard label="Review mark rows" value={String(data.reviewMarkCount)} icon={<FileText className="h-4 w-4" />} />
          </div>

          <div className="rounded-xl border border-border bg-white p-4">
            <h4 className="mb-3 font-semibold">Semesters configured</h4>
            <ul className="flex flex-wrap gap-2 text-sm">
              {data.batch.semesters.map((s) => (
                <li key={s.semester} className="rounded-full bg-slate-100 px-3 py-1">
                  Sem {s.semester}: {s.courseCode} — {s.courseName}
                </li>
              ))}
              {data.batch.semesters.length === 0 ? (
                <li className="text-muted">No semesters — add via Data Management.</li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-white p-4">
            <h4 className="mb-3 font-semibold">Uploaded archives & spreadsheets</h4>
            {data.storedFiles.length === 0 ? (
              <p className="text-sm text-muted">No stored files for this filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Sem</th>
                      <th className="px-3 py-2">Size</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.storedFiles.map((f) => (
                      <tr key={f.id} className="border-t border-border">
                        <td className="px-3 py-2 capitalize">{kindLabel(f.kind)}</td>
                        <td className="max-w-[200px] truncate px-3 py-2" title={f.originalName ?? f.storageKey}>
                          {f.originalName ?? f.storageKey}
                        </td>
                        <td className="px-3 py-2">{f.semester}</td>
                        <td className="px-3 py-2">{formatBytes(f.byteSize)}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <a href={`/api/reports/download/${f.id}`} className="text-primary underline">
                              Download
                            </a>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void deleteStored(f.id)}
                              className="inline-flex items-center gap-1 text-red-600 hover:underline disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-white p-4">
            <h4 className="mb-3 font-semibold">Student report PDFs (database)</h4>
            {data.studentDocuments.length === 0 ? (
              <p className="text-sm text-muted">No PDF rows linked yet. Upload a reports ZIP in Data Management.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2">USN</th>
                      <th className="px-3 py-2">File</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.studentDocuments.map((d) => (
                      <tr key={d.id} className="border-t border-border">
                        <td className="px-3 py-2">{d.student.usn}</td>
                        <td className="max-w-[180px] truncate px-3 py-2">{d.fileLabel}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <a href={`/api/documents/${d.id}`} className="text-primary underline">
                              Download
                            </a>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void deleteDoc(d.id)}
                              className="text-red-600 hover:underline disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h4 className="mb-2 inline-flex items-center gap-2 font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Danger zone
            </h4>
            <p className="mb-3 text-sm text-amber-900/90">
              Deleting batch {batchYear} removes all students, internships, marks, documents, and stored files for
              that batch.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void deleteBatch()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Delete entire batch {batchYear}
            </button>
          </div>
        </>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="mb-1 inline-flex items-center gap-1 text-xs text-muted">
        {icon}
        {label}
      </p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
