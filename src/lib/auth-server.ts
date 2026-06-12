import { firebaseConfig } from "@/lib/firebase-config";
import { ADMIN_EMAIL, isAdminEmail, normalizeEmail } from "@/lib/auth-constants";
import { prisma } from "@/lib/prisma";
import type { PortalRole } from "@/lib/auth-roles";

export type VerifiedUser = {
  email: string;
  uid: string;
};

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedUser | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? firebaseConfig.apiKey;
  if (!apiKey || !idToken) return null;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );

  if (!res.ok) return null;

  const data = (await res.json()) as {
    users?: Array<{ email?: string; localId?: string }>;
  };
  const user = data.users?.[0];
  if (!user?.email || !user.localId) return null;

  return { email: user.email, uid: user.localId };
}

export async function resolveRoleForEmail(email: string): Promise<PortalRole | null> {
  const normalized = normalizeEmail(email);
  if (isAdminEmail(normalized)) return "admin";

  const record = await prisma.allowedEmail.findUnique({ where: { email: normalized } });
  if (!record) return null;

  return record.role === "admin" ? "admin" : "coordinator";
}

export async function isEmailAuthorized(email: string): Promise<boolean> {
  return (await resolveRoleForEmail(email)) !== null;
}

export async function ensureAdminEmailSeeded() {
  await prisma.allowedEmail.upsert({
    where: { email: normalizeEmail(ADMIN_EMAIL) },
    create: {
      email: normalizeEmail(ADMIN_EMAIL),
      role: "admin",
      addedBy: "system",
    },
    update: { role: "admin" },
  });
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export async function requireAuthorizedUser(request: Request): Promise<
  | { ok: true; user: VerifiedUser; role: PortalRole }
  | { ok: false; status: number; message: string }
> {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, message: "Missing authorization token." };
  }

  const user = await verifyFirebaseIdToken(token);
  if (!user) {
    return { ok: false, status: 401, message: "Invalid or expired session." };
  }

  const role = await resolveRoleForEmail(user.email);
  if (!role) {
    return { ok: false, status: 403, message: "Email is not authorized for this portal." };
  }

  return { ok: true, user, role };
}

export async function requireAdminUser(request: Request) {
  const auth = await requireAuthorizedUser(request);
  if (!auth.ok) return auth;
  if (auth.role !== "admin") {
    return { ok: false as const, status: 403, message: "Administrator access required." };
  }
  return auth;
}
