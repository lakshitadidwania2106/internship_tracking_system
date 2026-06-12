export type PortalRole = "admin" | "coordinator";

export function resolveRoleFromEmail(email: string | null | undefined): PortalRole {
  if (!email) return "coordinator";
  const normalized = email.trim().toLowerCase();
  const adminList = (process.env.NEXT_PUBLIC_AUTH_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminList.includes(normalized) ? "admin" : "coordinator";
}

export function roleLabel(role: PortalRole) {
  return role === "admin" ? "Administrator" : "Coordinator";
}
