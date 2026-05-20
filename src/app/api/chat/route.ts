import { NextRequest, NextResponse } from "next/server";
import { askInternshipAssistant } from "@/lib/ai/internship-ai";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      question?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };
    const question = body.question?.trim();

    if (!question) {
      return NextResponse.json({ message: "Question is required." }, { status: 400 });
    }

    const result = await askInternshipAssistant(question, body.history);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { message: "Chat service failed. Please try again." },
      { status: 500 },
    );
  }
}
