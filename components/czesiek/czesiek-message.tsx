"use client";

import { Wrench, Bot } from "lucide-react";
import type { ChatMessageRow } from "./czesiek-types";

// F12-K74: pojedynczy message bubble. Trzy warianty:
// - user: prawa strona, gradient brand
// - assistant: lewa strona, neutralna karta + ikonka bota
// - tool: collapsed inline marker "Sprawdzam zadania..." (technical detail dla
//   transparentności, ale nie zaśmieca głównego flow konwersacji)
export function CzesiekMessage({ msg, showAvatar = true }: { msg: ChatMessageRow; showAvatar?: boolean }) {
  if (msg.role === "tool") {
    return <ToolMarker name={msg.toolName ?? "tool"} />;
  }
  if (msg.role === "system") return null;

  const isUser = msg.role === "user";

  return (
    // Awatar tylko przy pierwszej wiadomosci z serii — przy kazdej robil pas
    // pomaranczowych kolek i zjadal szerokosc dymka.
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser &&
        (showAvatar ? (
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">
            <Bot size={16} />
          </div>
        ) : (
          <span className="size-8 shrink-0" aria-hidden />
        ))}
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-3 text-[15px] leading-[1.6] ${
          isUser
            ? "rounded-tr-md bg-primary text-white "
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
    <div className="flex items-center gap-1.5 pl-[42px] font-mono text-2xs uppercase tracking-[0.12em] text-fg-3">
      <Wrench size={12} />
      <span>{label}</span>
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  list_boards: "sprawdzam tablice",
  find_user: "szukam osoby",
  count_tasks_by_status: "liczę zadania",
  list_tasks: "szukam zadań",
  list_overdue_tasks: "sprawdzam przeterminowane",
  get_user_activity: "sprawdzam aktywność",
};
