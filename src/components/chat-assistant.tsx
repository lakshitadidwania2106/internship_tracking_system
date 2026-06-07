"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bot, LoaderCircle, MessageCircle, Send, Sparkles, X } from "lucide-react";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  mode?: string;
  intent?: string;
  studentUsn?: string;
};

type ChatAssistantProps = {
  selectedUsn?: string;
  selectedName?: string;
};

const SUGGESTED_PROMPTS = [
  "Show mapping for this student",
  "Explain CO2 for this student",
  "Why is PO5 mapped for this student?",
];

export function ChatAssistant({ selectedUsn, selectedName }: ChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const contextLine = selectedUsn
      ? `Context: ${selectedName ?? "Selected student"} (${selectedUsn}). Ask about their CO, PO, and PSO — each student has different mappings.`
      : "Include a USN or student name. CO / PO / PSO differ for every intern.";

    setMessages([
      {
        role: "assistant",
        text: `Hi faculty! I'm InternBot (ML intent + per-student outcome engine).\n\n${contextLine}`,
      },
    ]);
  }, [selectedUsn, selectedName]);

  async function submitQuestion(text: string) {
    if (!text.trim() || loading) {
      return;
    }

    setMessages((prev) => [...prev, { role: "user", text }]);
    setQuestion("");
    setLoading(true);

    try {
      const priorTurns = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map((m) => ({
          role: m.role,
          content: m.text,
          intent: m.intent,
          studentUsn: m.studentUsn,
        }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          usn: selectedUsn,
          turns: priorTurns,
        }),
      });

      const data = (await response.json()) as {
        answer?: string;
        mode?: string;
        message?: string;
        intent?: string;
        studentUsn?: string;
        debug?: {
          responsePath?: string;
          primaryUsn?: string;
          intentSource?: string;
          fallbackTriggered?: boolean;
        };
      };

      if (!response.ok) {
        throw new Error(data.message ?? "Request failed");
      }

      if (data.debug) {
        console.debug("[InternBot]", data.debug);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.answer ?? "No answer returned.",
          mode: data.mode,
          intent: data.intent,
          studentUsn: data.studentUsn,
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error && error.message !== "Request failed"
          ? error.message
          : "Could not process this now. Try again with USN or full student name.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: message,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await submitQuestion(question);
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full border border-[#9ad9cf] bg-[#b8efe3] px-4 py-3 text-sm font-semibold text-[var(--dsce-navy)] shadow-lg transition hover:bg-[#a8e5d8]"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="h-4 w-4 text-[var(--dsce-blue)]" />
          InternBot
        </button>
      ) : (
        <div className="fixed bottom-6 right-6 z-50 flex h-[32rem] w-[24rem] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl sm:w-[26rem]">
          <ChatPanelHeader
            onClose={() => setOpen(false)}
            selectedUsn={selectedUsn}
            selectedName={selectedName}
          />
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f4f7fb] p-3 text-sm">
            {messages.map((message, index) => (
              <MessageBubble key={`${message.role}-${index}`} message={message} />
            ))}
            {loading ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-slate-600">
                <LoaderCircle className="h-4 w-4 animate-spin text-[var(--dsce-blue)]" />
                InternBot is analysing outcomes...
              </div>
            ) : null}
            {!loading && messages.length <= 2 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">Try asking:</p>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => submitQuestion(prompt)}
                    className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-left text-xs text-slate-700 hover:border-[var(--dsce-blue)] hover:text-[var(--dsce-blue)]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <form onSubmit={onSubmit} className="flex gap-2 border-t border-border bg-white p-3">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={
                selectedUsn
                  ? `Ask about ${selectedUsn} CO / PO / PSO...`
                  : "Ask CO PO PSO or internship question..."
              }
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none ring-[var(--dsce-blue)]/20 focus:ring-2"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[var(--dsce-blue)] px-3 py-2 text-white disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function ChatPanelHeader({
  onClose,
  selectedUsn,
  selectedName,
}: {
  onClose: () => void;
  selectedUsn?: string;
  selectedName?: string;
}) {
  return (
    <div className="border-b border-[#9ad9cf] bg-[#b8efe3] px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--dsce-navy)]">
          <Bot className="h-4 w-4 text-[var(--dsce-blue)]" />
          InternBot
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-[var(--dsce-gold)]">
            ML
          </span>
        </p>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-600 hover:bg-white/60">
          <X className="h-4 w-4" />
        </button>
      </div>
      {selectedUsn ? (
        <p className="mt-1 truncate text-xs text-slate-700">
          Active: {selectedName ?? "Student"} · {selectedUsn}
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-600">Per-student CO / PO / PSO from database</p>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={`max-w-[92%] whitespace-pre-wrap rounded-lg px-3 py-2 ${
        isUser
          ? "ml-auto bg-[var(--dsce-blue)] text-white"
          : "border border-border bg-white text-slate-700"
      }`}
    >
      {!isUser && message.intent ? (
        <p className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--dsce-gold)]">
          {message.intent === "invalid_query" ? (
            "unrecognized"
          ) : (
            <>
              <Sparkles className="h-3 w-3" />
              {message.intent.replace(/_/g, " ")}
            </>
          )}
        </p>
      ) : null}
      {message.text}
    </div>
  );
}
