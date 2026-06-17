"use client";

import { Wrench, Bot } from "lucide-react";
import type { ChatMessageRow } from "./czesiek-types";

// F12-K74: pojedynczy message bubble. Trzy warianty:
// - user: prawa strona, gradient brand
// - assistant: lewa strona, neutralna karta + ikonka bota
// - tool: collapsed inline marker "Sprawdzam zadania..." (technical detail dla
//   transparentności, ale nie zaśmieca głównego flow konwersacji)
export function CzesiekMessage({ msg }: { msg: ChatMessageRow }) {
  if (msg.role === "tool") {
    return <ToolMarker name={msg.toolName ?? "tool"} />;
  }
  if (msg.role === "system") return null;

  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-gradient text-white shadow-sm">
          <Bot size={14} />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.88rem] leading-[1.55] ${
          isUser
            ? "rounded-tr-md bg-brand-gradient text-white shadow-brand"
            : "rounded-tl-md border border-border bg-card text-foreground"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
      </div>
    </div>
  );
}

// Inline marker dla tool call — informuje usera że Czesiek "myśli", bez
// zaśmiecania głównego flow. Tooltipowa nazwa tool'a po hoverze.
function ToolMarker({ name }: { name: string }) {
  const label = TOOL_LABELS[name] ?? name;
  return (
    <div className="flex items-center gap-1.5 pl-9 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/70">
      <Wrench size={10} />
      <span>{label}</span>
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  list_boards: "sprawdzam tablice",
  list_tasks: "szukam zadań",
  list_overdue_tasks: "sprawdzam przeterminowane",
  get_user_activity: "sprawdzam aktywność",
};
