import { NextRequest, NextResponse } from "next/server";
import { askInternshipAssistant, type ChatTurn } from "@/lib/ai/internship-ai";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      question?: string;
      usn?: string;
      history?: string[];
      turns?: ChatTurn[];
    };
    const question = body.question?.trim();

    if (!question) {
      return NextResponse.json({ message: "Question is required." }, { status: 400 });
    }

    const history = Array.isArray(body.history)
      ? body.history.filter((h): h is string => typeof h === "string").slice(-6)
      : undefined;

    const turns = Array.isArray(body.turns)
      ? body.turns
          .filter(
            (t): t is ChatTurn =>
              t != null &&
              typeof t === "object" &&
              (t.role === "user" || t.role === "assistant") &&
              typeof t.content === "string",
          )
          .slice(-12)
      : undefined;

    const result = await askInternshipAssistant(question, {
      usn: body.usn?.trim(),
      history,
      turns,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { message: "Chat service failed. Please try again." },
      { status: 500 },
    );
  }
}
