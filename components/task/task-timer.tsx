"use client";

import { startTransition, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Pause, Play, Timer, X } from "lucide-react";
import {
  completeTaskTimerAction,
  pauseTaskTimerAction,
  startTaskTimerAction,
} from "@/app/(app)/w/[workspaceId]/t/timer-actions";

export interface TaskTimerProps {
  taskId: string;
  // Seconds accumulated from previous sessions.
  accumulatedSeconds: number;
  // ISO — when set, timer is running from this moment.
  startedAt: string | null;
  // ISO — when set, task is completed.
  completedAt: string | null;
  canEdit: boolean;
}

export function TaskTimer({
  taskId,
  accumulatedSeconds,
  startedAt,
  completedAt,
  canEdit,
}: TaskTimerProps) {
  // Live elapsed — re-renders every 1s.
  const [now, setNow] = useState(() => Date.now());
  // Custom dialog instead of window.confirm — native UI has no dark-mode parity.
  const [confirmingComplete, setConfirmingComplete] = useState(false);

  const isRunning = !!startedAt && !completedAt;
  const isCompleted = !!completedAt;

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const elapsedNow = startedAt
    ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
    : 0;
  const totalSeconds = accumulatedSeconds + (isRunning ? elapsedNow : 0);

  const handleSubmit = (
    action: typeof startTaskTimerAction,
  ) => {
    return (fd: FormData) => startTransition(() => action(fd));
  };

  return (
    // Inline pill — sits flat in the sticky footer next to action buttons.
    // No bordered card, no eyebrow. Clock icon + mono time. The pill
    // surface lets the elapsed time read as an ambient indicator rather
    // than a heavy "section" block (spec).
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/60 px-3 py-1.5 backdrop-blur"
        data-running={isRunning ? "true" : "false"}
        data-completed={isCompleted ? "true" : "false"}
      >
        <Timer
          size={12}
          className={
            isCompleted
              ? "text-muted-foreground"
              : isRunning
                ? "text-primary"
                : "text-muted-foreground"
          }
        />
        <span
          className={`font-mono text-[0.86rem] font-semibold tabular-nums tracking-[-0.01em] ${
            isCompleted
              ? "text-muted-foreground"
              : isRunning
                ? "text-primary"
                : "text-foreground"
          }`}
        >
          {formatDuration(totalSeconds)}
        </span>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
          {isCompleted
            ? `· Zakończono ${formatRelative(completedAt!)}`
            : isRunning
              ? "· Trwa"
              : accumulatedSeconds > 0
                ? "· Zatrzymano"
                : "· Nie rozpoczęto"}
        </span>
      </div>

      {canEdit && !isCompleted && (
        <div className="flex flex-wrap items-center gap-2">
          {!isRunning && (
            <form action={handleSubmit(startTaskTimerAction)} className="m-0">
              <input type="hidden" name="id" value={taskId} />
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-gradient px-4 font-sans text-[0.82rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
              >
                <Play size={12} fill="currentColor" />
                Rozpocznij
              </button>
            </form>
          )}
          {isRunning && (
            <>
              <form action={handleSubmit(pauseTaskTimerAction)} className="m-0">
                <input type="hidden" name="id" value={taskId} />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-4 font-sans text-[0.82rem] font-semibold text-foreground transition-colors hover:border-primary/60"
                >
                  <Pause size={12} />
                  Zatrzymaj
                </button>
              </form>
              <button
                type="button"
                onClick={() => setConfirmingComplete(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 font-sans text-[0.82rem] font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
              >
                <CheckCircle2 size={12} />
                Zakończ
              </button>
            </>
          )}
        </div>
      )}

      {isCompleted && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={11} />
          Zakończone
        </span>
      )}

      {/* F12-K40b: brand'owany confirm modal — backdrop blur, top-border
          accent, dwa CTA. Zastępuje natywny window.confirm() (białe okno,
          niebieski OK, źle wygląda w dark mode). */}
      {confirmingComplete && (
        <CompleteConfirmDialog
          taskId={taskId}
          totalSeconds={totalSeconds}
          onCancel={() => setConfirmingComplete(false)}
          onConfirmStart={() => setConfirmingComplete(false)}
        />
      )}
    </div>
  );
}

function CompleteConfirmDialog({
  taskId,
  totalSeconds,
  onCancel,
  onConfirmStart,
}: {
  taskId: string;
  totalSeconds: number;
  onCancel: () => void;
  onConfirmStart: () => void;
}) {
  // Esc + click-on-backdrop = cancel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm"
    >
      <div
        className="relative flex w-[min(440px,100%)] flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-[0_24px_48px_-12px_rgba(10,10,40,0.35)]"
        style={{ borderTop: "4px solid #10B981" }}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Zamknij"
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          >
            <AlertTriangle size={16} />
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-[1.1rem] font-bold leading-tight tracking-[-0.01em]">
              Zakończyć zadanie?
            </h2>
            <p className="text-[0.88rem] leading-relaxed text-muted-foreground">
              Zegar zostanie zablokowany na <strong className="text-foreground">{formatDuration(totalSeconds)}</strong>.
              Po zakończeniu nie będzie można już mierzyć czasu na tym zadaniu.
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 font-sans text-[0.86rem] font-medium text-foreground transition-colors hover:border-primary/60"
          >
            Anuluj
          </button>
          <form
            action={(fd) => {
              onConfirmStart();
              startTransition(() => completeTaskTimerAction(fd));
            }}
            className="m-0"
          >
            <input type="hidden" name="id" value={taskId} />
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-500 px-4 font-sans text-[0.86rem] font-semibold text-white shadow-[0_4px_12px_-4px_rgba(16,185,129,0.5)] transition-[transform,opacity] hover:-translate-y-[1px] hover:bg-emerald-600"
            >
              <CheckCircle2 size={13} />
              Tak, zakończ
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// HH:MM:SS jeśli >= 1h, inaczej MM:SS.
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.round((Date.now() - then) / 1000);
  if (diff < 60) return "przed chwilą";
  if (diff < 60 * 60) return `${Math.round(diff / 60)} min temu`;
  if (diff < 60 * 60 * 24) return `${Math.round(diff / 3600)} godz. temu`;
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
