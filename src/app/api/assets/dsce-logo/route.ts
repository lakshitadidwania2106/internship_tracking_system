import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const logoPath = path.join(process.cwd(), "public", "dsce-logo.png");
  try {
    const file = await fs.readFile(logoPath);
    return new NextResponse(file, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ message: "DSCE logo not found." }, { status: 404 });
  }
}
