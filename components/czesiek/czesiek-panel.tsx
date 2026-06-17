"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { CzesiekSessions } from "./czesiek-sessions";
import { CzesiekThread } from "./czesiek-thread";
import type { ChatMessageRow, ChatSessionSummary } from "./czesiek-types";

// F12-K74: slide-in panel od prawej.
// - Desktop: 720px wide, fixed prawej krawędzi, slide animation.
// - Mobile (< md): pełnoekranowy overlay.
// Wewnątrz: sesje sidebar (180px) + thread (flex-1).
//
// Otwarcie/zamknięcie kontrolowane przez parent (CzesiekFab) — panel
// pozostaje zamontowany żeby zachować draft input + scroll position między
// otwarciami.
export function CzesiekPanel({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [sending, setSending] = useState(false);
  const fetchedRef = useRef(false);

  // ─────────── Fetch sessions on first open ───────────
  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    void (async () => {
      const res = await fetch(
        `/api/chat/sessions?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { sessions: ChatSessionSummary[] };
      setSessions(data.sessions);
      // Auto-select najnowszą sesję jeśli jakaś jest, inaczej zostaw null
      // (thread pokaże empty state z suggested questions).
      if (data.sessions.length > 0) {
        await loadSession(data.sessions[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ─────────── ESC żeby zamknąć ───────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const loadSession = useCallback(async (id: string) => {
    setActiveSessionId(id);
    const res = await fetch(`/api/chat/sessions/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { messages: ChatMessageRow[] };
    setMessages(data.messages);
  }, []);

  const handleNew = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setMessages([]);
      }
    },
    [activeSessionId],
  );

  const handleSend = useCallback(
    async (text: string) => {
      // Optimistic: dorzucamy user message do UI od razu.
      const optimisticId = `tmp-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          role: "user",
          content: text,
          toolName: null,
          createdAt: new Date().toISOString(),
        },
      ]);
      setSending(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            sessionId: activeSessionId ?? undefined,
            message: text,
          }),
        });

        if (!res.ok) {
          // Replace optimistic z error message.
          setMessages((prev) =>
            prev
              .filter((m) => m.id !== optimisticId)
              .concat({
                id: `err-${Date.now()}`,
                role: "assistant",
                content:
                  "Czesiek nie odpowiada. Spróbuj za chwilę albo skontaktuj się z adminem.",
                toolName: null,
                createdAt: new Date().toISOString(),
              }),
          );
          return;
        }

        const data = (await res.json()) as {
          sessionId: string;
          messages: ChatMessageRow[];
        };
        setMessages(data.messages);

        // Refresh sessions list (tytuł mógł się zmienić, updatedAt na pewno).
        if (!activeSessionId) setActiveSessionId(data.sessionId);
        const sessionsRes = await fetch(
          `/api/chat/sessions?workspaceId=${encodeURIComponent(workspaceId)}`,
        );
        if (sessionsRes.ok) {
          const sessionsData = (await sessionsRes.json()) as {
            sessions: ChatSessionSummary[];
          };
          setSessions(sessionsData.sessions);
        }
      } finally {
        setSending(false);
      }
    },
    [workspaceId, activeSessionId],
  );

  return (
    <>
      {/* Backdrop — tylko mobile */}
      <div
        data-open={open ? "true" : "false"}
        onClick={onClose}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40 bg-foreground/20 opacity-0 transition-opacity data-[open=true]:pointer-events-auto data-[open=true]:opacity-100 md:hidden"
      />

      <div
        data-open={open ? "true" : "false"}
        role="dialog"
        aria-modal="true"
        aria-label="Czesiek AI"
        className="fixed inset-0 z-50 flex translate-x-full flex-col border-l border-border bg-background opacity-0 transition-[transform,opacity] duration-300 ease-out data-[open=true]:translate-x-0 data-[open=true]:opacity-100 md:left-auto md:w-[720px] md:shadow-2xl"
        style={{ pointerEvents: open ? "auto" : "none" }}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border bg-card px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-gradient text-[0.7rem] font-bold text-white shadow-sm">
              Cz
            </span>
            <div className="flex flex-col">
              <span className="font-display text-[0.95rem] font-bold leading-none text-foreground">
                Czesiek AI
              </span>
              <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground/70">
                Twój asystent workspace'u
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={14} />
          </button>
        </header>

        {/* Sessions + Thread */}
        <div className="flex min-h-0 flex-1">
          <CzesiekSessions
            sessions={sessions}
            activeId={activeSessionId}
            onSelect={loadSession}
            onNew={handleNew}
            onDelete={handleDelete}
          />
          <CzesiekThread
            messages={messages}
            sending={sending}
            onSend={handleSend}
          />
        </div>
      </div>
    </>
  );
}
