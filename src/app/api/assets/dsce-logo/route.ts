import fs from "node:fs/promises";
import { NextResponse } from "next/server";

const LOGO_PATH =
  "/Users/lucky21/.cursor/projects/Users-lucky21-Desktop-internship-tracking-system/assets/Screenshot_2026-04-28_at_10.20.36_AM-79867c41-f1ba-4f20-9ebf-2f7baccc4fa4.png";

export async function GET() {
  try {
    const file = await fs.readFile(LOGO_PATH);
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
