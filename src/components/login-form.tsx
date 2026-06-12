"use client";

import { FormEvent, useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { useAuth } from "@/components/auth-provider";

export function LoginForm() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  async function onEmailSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();

      const checkRes = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const checkData = (await checkRes.json()) as { allowed?: boolean; message?: string };
      if (!checkData.allowed) {
        setError(checkData.message ?? "This email is not authorized to access the portal.");
        return;
      }

      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </p>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-lg">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Image
          src="/dsce-logo.png"
          alt="DSCE logo"
          width={88}
          height={88}
          className="h-20 w-20 rounded-full bg-white object-contain"
          unoptimized
        />
        <div>
          <h1 className="text-lg font-semibold text-[var(--dsce-navy)]">Internship Portal</h1>
          <p className="text-sm text-muted">Coordinators &amp; administrators</p>
        </div>
      </div>

      <form onSubmit={(e) => void onEmailSubmit(e)} className="space-y-3">
        <label className="block text-xs font-medium text-slate-700">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none ring-primary/20 focus:ring"
          />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Password
          <input
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none ring-primary/20 focus:ring"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sign in
        </button>
      </form>

      {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}

      <p className="mt-4 text-center text-[11px] text-muted">
        Only authorized coordinator emails can sign in. Contact the HOD administrator (
        <span className="font-medium">hod-ai@dayanandasagar.edu</span>) to request access.
      </p>
    </div>
  );
}
