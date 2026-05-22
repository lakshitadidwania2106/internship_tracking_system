export type ChatDebugTrace = {
  question: string;
  intent: string;
  intentSource: string;
  confidence: number;
  isRecognizable: boolean;
  questionUsns: string[];
  hintUsn: string | null;
  primaryUsn: string | null;
  studentsResolved: string[];
  responsePath: string;
  fallbackTriggered: boolean;
  coId: string | null;
  poId: string | null;
};

const ENABLED =
  process.env.CHAT_DEBUG === "1" || process.env.NODE_ENV === "development";

export function logChatDebug(trace: ChatDebugTrace): void {
  if (!ENABLED) return;
  console.info("[InternBot]", JSON.stringify(trace, null, 0));
}

export function shouldReturnDebugToClient(): boolean {
  return ENABLED;
}
