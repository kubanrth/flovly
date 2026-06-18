"use client";

// F12-K75: inline edytor priorytetu w wierszu tabeli.
// Click otwiera popover z 5 opcjami (Pilny / Wysoki / Średni / Niski / Brak).
// Save od razu via setTaskPriorityAction — optymistyczny update lokalny,
// fallback gdy serwer odrzuci.

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { PriorityBadge } from "@/components/task/priority-badge";
import {
  PRIORITY_META,
  PRIORITY_VALUES,
  type TaskPriorityValue,
} from "@/lib/task-priority";
import { setTaskPriorityAction } from "@/app/(app)/w/[workspaceId]/t/actions";

export function PriorityPickerCell({
  taskId,
  current,
  canEdit,
}: {
  taskId: string;
  current: TaskPriorityValue;
  canEdit: boolean;
}) {
  // Optimistic override — gdy null, używamy server-driven current.
  // Po sukcesie akcji clearujemy override (parent rerender przyniesie świeże current).
  // Pattern bezpieczny dla realtime broadcastów (current zmienia się → display od razu).
  const [override, setOverride] = useState<TaskPriorityValue | null>(null);
  const optimistic = override ?? current;
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handlePick = (next: TaskPriorityValue) => {
    setOpen(false);
    if (next === optimistic) return;
    setOverride(next);
    startTransition(async () => {
      await setTaskPriorityAction({ taskId, priority: next });
      // Sukces lub fail → clearujemy override żeby zacząć pokazywać server-driven
      // current (parent rerender). Przy fail current jest stary, więc UI wraca.
      setOverride(null);
    });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => canEdit && setOpen((v) => !v)}
        disabled={!canEdit}
        title={canEdit ? "Zmień priorytet" : "Brak uprawnień"}
        className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 transition-colors hover:bg-accent disabled:cursor-not-allowed"
      >
        {optimistic === "NONE" ? (
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/60">
            Brak
          </span>
        ) : (
          <PriorityBadge priority={optimistic} size="xs" />
        )}
        {canEdit && (
          <ChevronDown size={11} className="text-muted-foreground/60" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-1 flex w-[180px] flex-col gap-0.5 rounded-lg border border-border bg-card p-1 shadow-xl"
        >
          {PRIORITY_VALUES.map((value) => {
            const meta = PRIORITY_META[value];
            const active = value === optimistic;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => handlePick(value)}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[0.82rem] transition-colors hover:bg-accent ${
                  active ? "bg-primary/5" : ""
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        value === "NONE" ? "transparent" : meta.dotColor,
                      border:
                        value === "NONE"
                          ? "1px dashed currentColor"
                          : undefined,
                    }}
                  />
                  <span className={value === "NONE" ? "text-muted-foreground" : ""}>
                    {meta.label}
                  </span>
                </span>
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-foreground/60">
                  {meta.shortCode}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
