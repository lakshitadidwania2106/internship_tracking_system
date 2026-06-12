"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type ConfirmationResult,
} from "firebase/auth";
import { Loader2, Mail, Phone } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { useAuth } from "@/components/auth-provider";

type AuthMode = "signin" | "signup";
type Channel = "email" | "phone";

export function LoginForm() {
  const router = useRouter();
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [channel, setChannel] = useState<Channel>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  function ensureRecaptcha() {
    if (recaptchaRef.current) return recaptchaRef.current;
    const auth = getFirebaseAuth();
    recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });
    return recaptchaRef.current;
  }

  async function onEmailSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      await refreshProfile();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoneOtp() {
    setError("");
    setBusy(true);
    try {
      const normalized = phone.trim().startsWith("+") ? phone.trim() : `+91${phone.trim()}`;
      const auth = getFirebaseAuth();
      const verifier = ensureRecaptcha();
      confirmationRef.current = await signInWithPhoneNumber(auth, normalized, verifier);
      setOtpSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Phone sign-in failed. Enable Phone auth in Firebase and use E.164 format (+91…).",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhoneOtp(event: FormEvent) {
    event.preventDefault();
    if (!confirmationRef.current) {
      setError("Request an OTP first.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await confirmationRef.current.confirm(otp.trim());
      await refreshProfile();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid verification code.");
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

      <div className="mb-4 flex rounded-full bg-slate-100 p-1 text-xs font-medium">
        <button
          type="button"
          className={`flex-1 rounded-full py-2 ${mode === "signin" ? "bg-white text-[var(--dsce-blue)] shadow-sm" : "text-muted"}`}
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full py-2 ${mode === "signup" ? "bg-white text-[var(--dsce-blue)] shadow-sm" : "text-muted"}`}
          onClick={() => setMode("signup")}
        >
          Sign up
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setChannel("email");
            setOtpSent(false);
            setError("");
          }}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium ${
            channel === "email"
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted"
          }`}
        >
          <Mail className="h-3.5 w-3.5" />
          Email
        </button>
        <button
          type="button"
          onClick={() => {
            setChannel("phone");
            setOtpSent(false);
            setError("");
          }}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium ${
            channel === "phone"
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted"
          }`}
        >
          <Phone className="h-3.5 w-3.5" />
          Phone
        </button>
      </div>

      {channel === "email" ? (
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
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
            {mode === "signup" ? "Create account" : "Sign in with email"}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          {!otpSent ? (
            <>
              <label className="block text-xs font-medium text-slate-700">
                Mobile number
                <input
                  type="tel"
                  required
                  placeholder="+91XXXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none ring-primary/20 focus:ring"
                />
              </label>
              <button
                type="button"
                disabled={busy || !phone.trim()}
                onClick={() => void sendPhoneOtp()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send verification code
              </button>
            </>
          ) : (
            <form onSubmit={(e) => void verifyPhoneOtp(e)} className="space-y-3">
              <label className="block text-xs font-medium text-slate-700">
                Verification code
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none ring-primary/20 focus:ring"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Verify &amp; sign in
              </button>
            </form>
          )}
          <div id="recaptcha-container" />
        </div>
      )}

      {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}

      <p className="mt-4 text-center text-[11px] text-muted">
        Admin access is granted to emails listed in{" "}
        <code className="text-[10px]">NEXT_PUBLIC_AUTH_ADMIN_EMAILS</code>. All other accounts are
        coordinators.
      </p>
    </div>
  );
}
