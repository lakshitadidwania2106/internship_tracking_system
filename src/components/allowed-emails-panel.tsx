"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getIdToken } from "firebase/auth";
import { Loader2, MailPlus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase-client";

type AllowedEmailRow = {
  id: number;
  email: string;
  role: string;
  addedBy: string | null;
  createdAt: string;
};

export function AllowedEmailsPanel() {
  const { role } = useAuth();
  const [emails, setEmails] = useState<AllowedEmailRow[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const getToken = useCallback(async () => {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in.");
    return getIdToken(user);
  }, []);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/auth/allowed-emails", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { emails?: AllowedEmailRow[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load allowed emails.");
      }
      setEmails(data.emails ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load allowed emails.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (role === "admin") {
      void loadEmails();
    }
  }, [role, loadEmails]);

  if (role !== "admin") {
    return null;
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const token = await getToken();
      const res = await fetch("/api/auth/allowed-emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to add email.");
      }
      setNewEmail("");
      setMessage("Coordinator email added.");
      await loadEmails();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add email.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(email: string) {
    if (!confirm(`Remove ${email} from the allowed list?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const token = await getToken();
      const res = await fetch(`/api/auth/allowed-emails?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to remove email.");
      }
      setMessage("Coordinator email removed.");
      await loadEmails();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <MailPlus className="h-5 w-5 text-[var(--dsce-blue)]" />
        <h4 className="font-semibold text-[var(--dsce-navy)]">Authorized coordinator emails</h4>
      </div>
      <p className="mb-4 text-sm text-slate-700">
        Only emails on this list (plus the HOD administrator) can sign in to the portal.
      </p>

      <form onSubmit={(e) => void onAdd(e)} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="coordinator@dayanandasagar.edu"
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none ring-primary/20 focus:ring"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
          Add email
        </button>
      </form>

      {loading ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading allowed emails…
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {emails.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-800">{row.email}</p>
                <p className="text-xs text-muted capitalize">
                  {row.role}
                  {row.addedBy ? ` · added by ${row.addedBy}` : ""}
                </p>
              </div>
              {row.role !== "admin" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDelete(row.email)}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              ) : (
                <span className="text-xs font-medium text-[var(--dsce-blue)]">Administrator</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {message ? <p className="mt-3 text-xs text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
