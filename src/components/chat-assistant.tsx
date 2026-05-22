"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bot, LoaderCircle, MessageCircle, Send, X } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  mode?: string;
};

const SUGGESTIONS = [
  "How many students are in the database?",
  "What company did 1DS21AI001 intern at?",
  "Summarize internship for Rahul Sharma",
  "Which students have report PDFs uploaded?",
];

export function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "I'm InternBot — ask about any student's company, role, stipend, marks, or reports. Include a USN or put the full name in quotes for best results.",
    },
  ]);

  const history = useMemo(
    () =>
      messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.text })),
    [messages],
  );

  async function sendQuestion(text: string) {
    if (!text.trim() || loading) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          history: history.slice(0, -1),
        }),
      });

      const data = (await response.json()) as { answer?: string; mode?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "Request failed");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.answer ?? "No answer returned.",
          mode: data.mode,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            err instanceof Error
              ? err.message
              : "Could not process this now. Try again with USN or full student name in quotes.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendQuestion(question);
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
          InternBot
        </button>
      ) : (
        <div className="fixed bottom-6 right-6 z-50 flex h-[32rem] w-[24rem] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-slate-50 px-4 py-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4 text-primary" />
              InternBot
            </p>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-slate-500">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1 border-b border-border bg-white px-2 py-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={loading}
                onClick={() => void sendQuestion(s)}
                className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                {s.length > 36 ? `${s.slice(0, 34)}…` : s}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3 text-sm">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[92%] rounded-lg px-3 py-2 ${
                  message.role === "user" ? "ml-auto bg-primary text-white" : "bg-white text-slate-700 shadow-sm"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.mode && message.role === "assistant" ? (
                  <p className="mt-1 text-[10px] opacity-70">via {message.mode}</p>
                ) : null}
              </div>
            ))}
            {loading ? (
              <div className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-slate-600 shadow-sm">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Searching records…
              </div>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-3">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder='e.g. "Priya N" company? or USN…'
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
