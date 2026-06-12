import { NextResponse } from "next/server";
import { ADMIN_EMAIL, isAdminEmail, normalizeEmail } from "@/lib/auth-constants";
import { ensureAdminEmailSeeded, requireAdminUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  await ensureAdminEmailSeeded();

  const emails = await prisma.allowedEmail.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: { id: true, email: true, role: true, addedBy: true, createdAt: true },
  });

  return NextResponse.json({ emails });
}

export async function POST(request: Request) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = (await request.json()) as { email?: string };
  const email = normalizeEmail(body.email ?? "");
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (isAdminEmail(email)) {
    return NextResponse.json({ error: "The administrator email is always allowed." }, { status: 400 });
  }

  const record = await prisma.allowedEmail.upsert({
    where: { email },
    create: {
      email,
      role: "coordinator",
      addedBy: auth.user.email,
    },
    update: {},
    select: { id: true, email: true, role: true, addedBy: true, createdAt: true },
  });

  return NextResponse.json({ email: record });
}

export async function DELETE(request: Request) {
  const auth = await requireAdminUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const email = normalizeEmail(searchParams.get("email") ?? "");
  if (!email) {
    return NextResponse.json({ error: "Email query parameter is required." }, { status: 400 });
  }

  if (isAdminEmail(email) || email === normalizeEmail(ADMIN_EMAIL)) {
    return NextResponse.json({ error: "Cannot remove the administrator email." }, { status: 400 });
  }

  await prisma.allowedEmail.deleteMany({ where: { email } });
  return NextResponse.json({ deleted: true });
}
