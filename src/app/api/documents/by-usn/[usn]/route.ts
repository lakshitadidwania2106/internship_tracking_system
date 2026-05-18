import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectBytes } from "@/lib/r2";

async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

export async function GET(_: Request, context: { params: Promise<{ usn: string }> }) {
  const { usn } = await context.params;
  const normalizedUsn = usn.toUpperCase();

  const student = await prisma.student.findUnique({
    where: { usn: normalizedUsn },
    include: {
      documents: { orderBy: { updatedAt: "desc" } },
    },
  });

  const storedPdf = student?.documents.find((d) => d.storageKey && /\.pdf$/i.test(d.fileLabel));
  if (storedPdf?.storageKey) {
    try {
      const { buffer, contentType } = await getObjectBytes(storedPdf.storageKey);
      const downloadName = storedPdf.fileLabel.replace(/"/g, "");
      const resolvedType = contentType ?? "application/pdf";
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": resolvedType,
          "Content-Disposition": `attachment; filename="${downloadName}"`,
        },
      });
    } catch {
      // Fall through to filesystem search.
    }
  }

  const candidateDirs = [
    path.join(process.cwd(), "data", "imports", "reports"),
    path.join(process.cwd(), "data", "imports", "excel"),
  ];

  try {
    let allFiles: string[] = [];
    for (const candidateDir of candidateDirs) {
      try {
        allFiles = allFiles.concat(await listFilesRecursive(candidateDir));
      } catch {
        // Ignore missing directories.
      }
    }

    const documentFiles = allFiles.filter((file) =>
      [".pdf", ".doc", ".docx"].includes(path.extname(file).toLowerCase()),
    );
    const matchedFile =
      documentFiles.find((file) => path.basename(file).toUpperCase().startsWith(normalizedUsn)) ??
      documentFiles.find((file) => path.basename(file).toUpperCase().includes(normalizedUsn));

    if (!matchedFile) {
      return NextResponse.json(
        {
          message:
            "No report found for this USN. Upload a ZIP via Data Management or add files under data/imports/reports.",
        },
        { status: 404 },
      );
    }

    const content = await fs.readFile(matchedFile);
    const fileName = path.basename(matchedFile);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ message: "Could not read report directory." }, { status: 500 });
  }
}
