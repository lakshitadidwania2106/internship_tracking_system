import { NextResponse } from "next/server";
import { requireAuthorizedUser } from "@/lib/auth-server";

export async function POST(request: Request) {
  const auth = await requireAuthorizedUser(request);
  if (!auth.ok) {
    return NextResponse.json({ authorized: false, message: auth.message }, { status: auth.status });
  }

  return NextResponse.json({
    authorized: true,
    email: auth.user.email,
    role: auth.role,
  });
}
