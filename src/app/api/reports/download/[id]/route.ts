import path from "node:path";
import { NextResponse } from "next/server";
import { getObjectBytes } from "@/lib/r2";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: "Invalid id." }, { status: 400 });
  }

  const stored = await prisma.storedFile.findUnique({ where: { id } });
  if (!stored) {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }

  try {
    const { buffer, contentType } = await getObjectBytes(stored.storageKey);
    const downloadName = stored.originalName ?? path.basename(stored.storageKey);
    const resolvedType =
      contentType ??
      (stored.kind.endsWith("zip") ? "application/zip" : "application/octet-stream");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": resolvedType,
        "Content-Disposition": `attachment; filename="${downloadName.replace(/"/g, "")}"`,
      },
    });
  } catch {
    return NextResponse.json({ message: "Unable to read object from storage." }, { status: 502 });
  }
}
