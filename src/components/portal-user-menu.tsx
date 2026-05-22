"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function PortalUserMenu() {
  const { user, roleDisplay, signOut } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const label = user.email ?? user.phoneNumber ?? "Signed in";

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="flex items-center gap-3 text-xs text-slate-700">
      <div className="hidden text-right sm:block">
        <p className="font-medium text-[var(--dsce-navy)]">{label}</p>
        {roleDisplay ? <p className="text-muted">{roleDisplay}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/90 px-3 py-1.5 font-medium text-[var(--dsce-blue)] hover:bg-white"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
    </div>
  );
}
