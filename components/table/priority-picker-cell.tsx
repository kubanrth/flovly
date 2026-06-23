"use client";

// F12-K75: inline edytor priorytetu w wierszu tabeli.
// Click otwiera popover z 5 opcjami (Pilny / Wysoki / Średni / Niski / Brak).
// Save od razu via setTaskPriorityAction — optymistyczny update lokalny,
// fallback gdy serwer odrzuci.

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import {
  PRIORITY_META,
  PRIORITY_VALUES,
  type TaskPriorityValue,
} from "@/lib/task-priority";
import { setTaskPriorityAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

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
  const isMobile = useIsMobile();

  // Close on outside click / Escape. Mobile: Sheet (Base UI Dialog) ma własny
  // outside-click/Escape handling — skip żeby uniknąć podwojonych close'ów.
  useEffect(() => {
    if (!open || isMobile) return;
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
  }, [open, isMobile]);

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

  // v4 spec (linia 50): pill rounded-[7px] (NIE full!) + dot 6x6 + label 11.5/700.
  // Bg = dotColor @ ~14% (1F hex), color = dotColor. Bez ikony — v4 zostawia
  // tylko kropkę żeby gęsto i kompaktowo wyglądało w wierszu.
  const meta = optimistic !== "NONE" ? PRIORITY_META[optimistic] : null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => canEdit && setOpen((v) => !v)}
        disabled={!canEdit}
        title={canEdit ? "Zmień priorytet" : "Brak uprawnień"}
        className="inline-flex h-7 items-center gap-1 rounded-md px-1 transition-colors hover:bg-accent disabled:cursor-not-allowed"
      >
        {optimistic === "NONE" || !meta ? (
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/60">
            Brak
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-[5px] rounded-[7px] px-[9px] py-[3px]"
            style={{
              background: `${meta.dotColor}1F`,
              color: meta.dotColor,
            }}
          >
            <span
              className="h-[6px] w-[6px] shrink-0 rounded-full"
              style={{ background: meta.dotColor }}
              aria-hidden="true"
            />
            <span className="text-[11.5px] font-bold leading-none">
              {meta.label}
            </span>
          </span>
        )}
        {canEdit && (
          <ChevronDown
            size={11}
            className="text-muted-foreground/60 max-md:hidden"
          />
        )}
      </button>

      {open && !isMobile && (
        <div
          role="menu"
          className="popover-glass popover-enter shadow-aura absolute left-0 top-full z-40 mt-1 flex w-[220px] flex-col gap-1 p-[7px]"
        >
          <span className="eyebrow mb-0.5 block px-1.5 text-[0.66rem]">
            Priorytet
          </span>
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
                data-active={active}
                className="flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-muted active:bg-primary/10 data-[active=true]:bg-primary/10"
              >
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
                  aria-hidden="true"
                />
                <span
                  className={`flex-1 truncate text-[13px] font-medium ${
                    value === "NONE" ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {meta.label}
                </span>
                <span className="ml-auto rounded-[5px] bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {meta.shortCode}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Mobile: bottom sheet zamiast popovera. 5 priorytetów jako duże rows
          z 44px touch target, drag handle, glass surface. */}
      {isMobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="sheet-mobile-surface gap-0 p-0"
          >
            <div className="pt-3">
              <div className="sheet-drag-handle" aria-hidden="true" />
            </div>
            <SheetTitle className="px-4 pb-3 text-base font-bold text-foreground">
              Priorytet
            </SheetTitle>
            <div className="flex flex-col gap-1 px-3 pb-safe-bottom">
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
                    data-active={active}
                    className="flex min-h-[48px] items-center gap-3 rounded-[12px] px-3 text-left transition-colors active:bg-primary/15 data-[active=true]:bg-primary/10"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background:
                          value === "NONE" ? "transparent" : meta.dotColor,
                        border:
                          value === "NONE"
                            ? "1px dashed currentColor"
                            : undefined,
                      }}
                      aria-hidden="true"
                    />
                    <span
                      className={`flex-1 truncate text-[15px] font-medium ${
                        value === "NONE"
                          ? "text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {meta.label}
                    </span>
                    <span className="ml-auto rounded-[6px] bg-muted/60 px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {meta.shortCode}
                    </span>
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
