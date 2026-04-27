import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, context: { params: Promise<{ documentId: string }> }) {
  const params = await context.params;
  const documentId = Number(params.documentId);

  if (!documentId) {
    return NextResponse.json({ message: "Invalid document id" }, { status: 400 });
  }

  const document = await prisma.studentDocument.findUnique({ where: { id: documentId } });
  if (!document) {
    return NextResponse.json({ message: "Document not found" }, { status: 404 });
  }

  const filePath = path.join(
    process.cwd(),
    "data",
    "imports",
    "reports",
    document.storagePath,
  );

  try {
    const content = await fs.readFile(filePath);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=\"${document.fileLabel}\"`,
      },
    });
  } catch {
    return NextResponse.json(
      {
        message:
          "Document file is not available yet. Place files in data/imports/reports with the configured name.",
      },
      { status: 404 },
    );
  }
}
