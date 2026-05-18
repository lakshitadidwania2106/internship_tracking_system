import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectBytes } from "@/lib/r2";

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

  const downloadName = document.fileLabel.replace(/"/g, "");

  if (document.storageKey) {
    try {
      const { buffer, contentType } = await getObjectBytes(document.storageKey);
      const resolvedType =
        contentType ??
        (/\.pdf$/i.test(document.fileLabel) ? "application/pdf" : "application/octet-stream");
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": resolvedType,
          "Content-Disposition": `attachment; filename="${downloadName}"`,
        },
      });
    } catch {
      return NextResponse.json({ message: "Could not read document from object storage." }, { status: 502 });
    }
  }

  const filePath = path.join(process.cwd(), "data", "imports", "reports", document.storagePath);

  try {
    const content = await fs.readFile(filePath);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${downloadName}"`,
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
