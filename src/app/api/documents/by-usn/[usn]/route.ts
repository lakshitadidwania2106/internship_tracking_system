import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

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
            "No report found for this USN. Add PDF/DOC/DOCX in data/imports/reports and include USN in filename.",
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
    return NextResponse.json(
      { message: "Could not read report directory." },
      { status: 500 },
    );
  }
}
