"use client";

import { FormEvent, useState } from "react";

export function DataUploadPanel() {
  const [status, setStatus] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setUploading(true);
    setStatus("Uploading...");
    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as { message?: string; result?: { imported?: number; rowsRead?: number } };
      if (!response.ok) {
        throw new Error(data.message ?? "Upload failed.");
      }
      if (data.result) {
        setStatus(`${data.message} Imported ${data.result.imported}/${data.result.rowsRead} rows.`);
      } else {
        setStatus(data.message ?? "Upload complete.");
      }
      form.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <h4 className="mb-3 font-semibold">Upload New Batch/Sem Data</h4>
      <p className="mb-3 text-xs text-muted">
        Upload Excel/CSV to import internship data for new years. Upload PDF/DOC/DOCX reports too.
      </p>
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-3">
        <input name="file" type="file" required className="rounded-lg border border-border px-3 py-2 text-sm" />
        <input name="batchYear" type="number" placeholder="Batch year (e.g. 2022)" className="rounded-lg border border-border px-3 py-2 text-sm" />
        <input name="semester" type="number" placeholder="Semester (e.g. 8)" className="rounded-lg border border-border px-3 py-2 text-sm" />
        <input name="sheetName" placeholder="Sheet name (optional)" className="rounded-lg border border-border px-3 py-2 text-sm" />
        <input name="headerRowIndex" placeholder="Header row index, 0-based (optional)" className="rounded-lg border border-border px-3 py-2 text-sm" />
        <select name="mode" className="rounded-lg border border-border px-3 py-2 text-sm">
          <option value="internship">Internship data mode</option>
          <option value="marks">Marks sheet mode</option>
        </select>
        <input name="courseCode" placeholder="Course code (optional)" className="rounded-lg border border-border px-3 py-2 text-sm" />
        <input name="courseName" placeholder="Course name (optional)" className="rounded-lg border border-border px-3 py-2 text-sm" />
        <input name="credits" type="number" placeholder="Credits (optional)" className="rounded-lg border border-border px-3 py-2 text-sm" />
        <button
          type="submit"
          disabled={uploading}
          className="md:col-span-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {uploading ? "Uploading..." : "Upload and Process"}
        </button>
      </form>
      {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
    </div>
  );
}
