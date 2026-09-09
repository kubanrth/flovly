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
        className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-5"
      >
        {visible.length === 0 && !sending ? (
          <EmptyState onPick={(q) => onSend(q)} />
        ) : (
          <>
            {visible.map((m, i) => (
              // Awatar tylko przy pierwszej wiadomosci asystenta w serii
              // (poprzednia od uzytkownika albo poczatek watku).
              <CzesiekMessage key={m.id} msg={m} showAvatar={visible[i - 1]?.role !== "assistant"} />
            ))}
            {sending && <ThinkingBubble />}
          </>
        )}
      </div>

      <div className="border-t border-border bg-card p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-orange-400">
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
            placeholder="Zapytaj Aterona…"
            rows={1}
            disabled={sending}
            className="max-h-[160px] min-h-[32px] flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-[1.5] outline-none placeholder:text-fg-3 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!draft.trim() || sending}
            aria-label="Wyślij"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-white transition-[transform,opacity] hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="mt-2 px-1 font-mono text-2xs uppercase tracking-[0.12em] text-fg-3">
          Enter = wyślij · Shift+Enter = nowa linia
        </p>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-2 text-center">
      {/* F12-K81 (v4 brand polish) — 72×72 rounded-[22px] bg-primary
          z literami "At" w centrum (matches Flovly Components spec P4, linia
          470). Outside: animated fl-pulse sonar ring jako "żywy" sygnał. */}
      {/* Cien mial jeszcze fiolet ze starej marki — teraz pomarancz jak reszta v5. */}
      <div className="relative grid size-[72px] place-items-center rounded-[22px] bg-primary text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_16px_36px_-12px_rgba(255,92,0,0.55)]">
        <span className="relative font-display text-[1.6rem] font-extrabold leading-none tracking-[-0.03em]">
          At
        </span>
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-lg font-bold leading-tight tracking-[-0.015em] text-foreground">
          Cześć, jestem Ateron
        </h3>
        <p className="text-sm leading-[1.55] text-muted-foreground">
          Zapytaj o cokolwiek związanego z tym workspace &mdash;<br />
          zadania, deadliny, aktywność użytkowników.
        </p>
      </div>
      <div className="mt-2 flex w-full max-w-[420px] flex-col gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="min-h-11 rounded-lg border border-border bg-card px-3.5 py-2.5 text-left text-sm leading-snug text-foreground transition-[border-color,background-color] duration-150 ease-out hover:border-orange-300 hover:bg-orange-50"
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
    <div className="flex gap-2.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">
        <Bot size={16} />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:200ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:400ms]" />
      </div>
    </div>
  );
}
