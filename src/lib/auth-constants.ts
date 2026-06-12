export const ADMIN_EMAIL = "hod-ai@dayanandasagar.edu";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email: string): boolean {
  return normalizeEmail(email) === normalizeEmail(ADMIN_EMAIL);
}
