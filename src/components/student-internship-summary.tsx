"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

export function StudentInternshipSummary({ usn }: { usn: string }) {
  const [summary, setSummary] = useState("");
  const [mode, setMode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setSummary("");

    void (async () => {
      try {
        const res = await fetch(`/api/students/${encodeURIComponent(usn)}/summary`);
        const data = (await res.json()) as { summary?: string; mode?: string; message?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.message ?? "Could not generate summary.");
          return;
        }
        setSummary(data.summary ?? "");
        setMode(data.mode ?? "");
      } catch {
        if (!cancelled) setError("Summary unavailable right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [usn]);

  return (
    <div className="mt-4 rounded-xl border border-primary/15 bg-linear-to-br from-slate-50 to-blue-50/40 p-4">
      <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[var(--dsce-navy)]">
        <Sparkles className="h-4 w-4 text-primary" />
        Internship summary
        {mode ? (
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-normal text-muted">
            {mode === "ollama" ? "AI-enhanced" : "from records"}
          </span>
        ) : null}
      </p>
      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating summary…
        </p>
      ) : error ? (
        <p className="text-sm text-amber-800">{error}</p>
      ) : (
        <p className="text-sm leading-relaxed text-slate-700">{summary}</p>
      )}
    </div>
  );
}
