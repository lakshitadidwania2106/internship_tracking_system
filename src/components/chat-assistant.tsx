"use client";

import { FormEvent, useState } from "react";
import { Bot, LoaderCircle, MessageCircle, Send, X } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hi faculty! Ask me direct questions like: What internship company did 1DS21AI001 do?",
    },
  ]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || loading) {
      return;
    }

    setMessages((prev) => [...prev, { role: "user", text }]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });

      if (!response.ok) {
        throw new Error("failed");
      }

      const data = (await response.json()) as { answer?: string };
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.answer ?? "No answer returned.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Could not process this now. Try again with USN or full student name.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-lg"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="h-4 w-4" />
          Ask Assistant
        </button>
      ) : (
        <div className="fixed bottom-6 right-6 z-50 flex h-[28rem] w-[22rem] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4 text-primary" />
              Teacher Assistant
            </p>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-slate-500">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3 text-sm">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[90%] rounded-lg px-3 py-2 ${
                  message.role === "user"
                    ? "ml-auto bg-primary text-white"
                    : "bg-white text-slate-700"
                }`}
              >
                {message.text}
              </div>
            ))}
            {loading ? (
              <div className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-slate-600">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-3">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask internship question..."
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none ring-primary/20 focus:ring"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-3 py-2 text-white disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
