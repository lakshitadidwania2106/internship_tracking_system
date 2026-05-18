import { NextRequest, NextResponse } from "next/server";
import { listBatchesDetailed } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const batches = await listBatchesDetailed();
  return NextResponse.json({ batches });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { year?: number; batchYear?: number } | null;
  const year = Number(body?.year ?? body?.batchYear);
  if (!Number.isFinite(year)) {
    return NextResponse.json({ message: "Numeric `year` (batch start year) is required." }, { status: 400 });
  }

  const batch = await prisma.batch.upsert({
    where: { year },
    update: {},
    create: { year },
  });

  return NextResponse.json({ batch });
}
