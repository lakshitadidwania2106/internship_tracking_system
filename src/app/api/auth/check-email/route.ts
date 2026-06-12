import { NextResponse } from "next/server";
import { isEmailAuthorized, resolveRoleForEmail } from "@/lib/auth-server";
import { normalizeEmail } from "@/lib/auth-constants";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = normalizeEmail(body.email ?? "");
    if (!email || !email.includes("@")) {
      return NextResponse.json({ allowed: false, message: "Enter a valid email address." }, { status: 400 });
    }

    const allowed = await isEmailAuthorized(email);
    if (!allowed) {
      return NextResponse.json({
        allowed: false,
        message: "This email is not authorized. Contact the HOD administrator.",
      });
    }

    const role = await resolveRoleForEmail(email);
    return NextResponse.json({ allowed: true, role });
  } catch {
    return NextResponse.json({ allowed: false, message: "Unable to verify email." }, { status: 500 });
  }
}
