"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Bot } from "lucide-react";
import { CzesiekMessage } from "./czesiek-message";
import type { ChatMessageRow } from "./czesiek-types";

const SUGGESTED_QUESTIONS = [
  "Jakie tablice mamy w tym workspace?",
  "Co jest przeterminowane?",
  "Pokaż wszystkie aktywne zadania",
];

// F12-K74: główny thread view — header + lista message'y + composer (input).
// Auto-scroll do bottoma przy nowych message'ach. Pokazuje "Czesiek myśli..."
// gdy sending=true. Empty state z 3 przykładowymi pytaniami.
export function CzesiekThread({
  messages,
  sending,
  onSend,
}: {
  messages: ChatMessageRow[];
  sending: boolean;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setDraft("");
    inputRef.current?.focus();
  };

  // Filtruj system messages z UI (LLM context only).
  const visible = messages.filter((m) => m.role !== "system");

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-4"
      >
        {visible.length === 0 && !sending ? (
          <EmptyState onPick={(q) => onSend(q)} />
        ) : (
          <>
            {visible.map((m) => (
              <CzesiekMessage key={m.id} msg={m} />
            ))}
            {sending && <ThinkingBubble />}
          </>
        )}
      </div>

      <div className="border-t border-border bg-card p-2.5">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-2.5 py-1.5 focus-within:border-primary/60">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Zapytaj Czesieka…"
            rows={1}
            disabled={sending}
            className="max-h-[120px] min-h-[28px] flex-1 resize-none bg-transparent py-1 text-[0.88rem] outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!draft.trim() || sending}
            aria-label="Wyślij"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-brand transition-[transform,opacity] hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="mt-1.5 px-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/60">
          Enter = wyślij · Shift+Enter = nowa linia
        </p>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-2 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-gradient text-white shadow-brand">
        <Bot size={22} />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-[1.1rem] font-bold leading-tight tracking-[-0.02em] text-foreground">
          Cześć, jestem Czesiek
        </h3>
        <p className="text-[0.82rem] leading-[1.5] text-muted-foreground">
          Zapytaj o cokolwiek związanego z tym workspace &mdash;<br />
          zadania, deadliny, aktywność użytkowników.
        </p>
      </div>
      <div className="mt-2 flex w-full flex-col gap-1.5">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-left text-[0.8rem] leading-tight text-foreground transition-all hover:border-primary/40 hover:bg-primary/5"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-2">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-gradient text-white shadow-sm">
        <Bot size={14} />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:200ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:400ms]" />
      </div>
    </div>
  );
}
