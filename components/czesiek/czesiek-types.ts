// F12-K74 Czesiek AI — shared types dla UI.

export type ChatSessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

export type ChatMessageRow = {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolName: string | null;
  createdAt: string;
};
