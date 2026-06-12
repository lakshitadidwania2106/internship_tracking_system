"use client";

import { Loader2, Shield, UserCircle } from "lucide-react";
import { AllowedEmailsPanel } from "@/components/allowed-emails-panel";
import { useAuth } from "@/components/auth-provider";
import { roleLabel } from "@/lib/auth-roles";

export function AccountSettingsPanel() {
  const { user, role, roleDisplay, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading account…
      </p>
    );
  }

  if (!user) {
    return <p className="text-sm text-muted">Sign in to view your account details.</p>;
  }

  const effectiveRole = role ?? "coordinator";
  const email = user.email ?? "—";
  const provider = user.providerData[0]?.providerId ?? "firebase";

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-full bg-[#b8efe3] p-3">
            <UserCircle className="h-8 w-8 text-[var(--dsce-blue)]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--dsce-navy)]">Account</h3>
            <p className="text-sm text-muted">Signed-in coordinator or administrator</p>
          </div>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Role" value={roleDisplay || roleLabel(effectiveRole)} highlight />
          <Detail label="Email" value={email} />
          <Detail label="Sign-in provider" value={provider} />
          <Detail label="User ID" value={user.uid} mono />
        </dl>
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-5 w-5 text-[var(--dsce-blue)]" />
          <h4 className="font-semibold text-[var(--dsce-navy)]">Access level</h4>
        </div>
        {effectiveRole === "admin" ? (
          <p className="text-sm text-slate-700">
            You have <strong>administrator</strong> access: full portal tabs including Data Management,
            batch uploads, and coordinator email management.
          </p>
        ) : (
          <p className="text-sm text-slate-700">
            You have <strong>coordinator</strong> access: view students, internships, reports, and use
            InternBot. Data Management requires an administrator account.
          </p>
        )}
      </div>

      <AllowedEmailsPanel />
    </section>
  );
}

function Detail({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-slate-50/80 px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-sm font-medium text-slate-800 ${highlight ? "text-[var(--dsce-blue)]" : ""} ${mono ? "break-all font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
