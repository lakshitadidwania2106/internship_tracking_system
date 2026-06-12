import { isAdminEmail } from "@/lib/auth-constants";

export type PortalRole = "admin" | "coordinator";

export function resolveRoleFromEmail(email: string | null | undefined): PortalRole {
  if (!email) return "coordinator";
  return isAdminEmail(email) ? "admin" : "coordinator";
}

export function roleLabel(role: PortalRole) {
  return role === "admin" ? "Administrator" : "Coordinator";
}
