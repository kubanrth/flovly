"use client";

// Popover renders in a portal to document.body — avoids backdrop-blur containing-block trap.
// Emits a hidden <input name> with ISO string so parent <form action> picks it up.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronDown, ChevronUp, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { pl } from "date-fns/locale";
import "react-day-picker/style.css";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export interface DateTimePickerProps {
  name: string;
  // HTML5 `form` attribute na hidden input — pozwala renderować pickera poza
  // <form> a wartość i tak ląduje w submission. Używane w task-detail (sidebar
  // meta), gdzie submit żyje w sticky footerze a same kontrolki w sidebarze.
  form?: string;
  defaultValue: string | null;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  // "cell" strips input-style border + calendar icon for inline table use.
  variant?: "input" | "cell";
  // Fires on every edit (day pick, time, today, clear) — useful for autosave cells without wrapping form.
  onChange?: (iso: string) => void;
  // Hide hour/minute pickers + format display without time. Use w urlopach,
  // datach końcowych zadań, deadlinach itp. gdzie godzina nie ma znaczenia.
  dateOnly?: boolean;
}

function isoToDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDisplay(date: Date | null, dateOnly: boolean): string {
  if (!date) return "";
  return date.toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(dateOnly ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function DateTimePicker({
  name,
  form,
  defaultValue,
  disabled,
  placeholder = "Wybierz datę",
  label,
  variant = "input",
  dateOnly = false,
  onChange,
}: DateTimePickerProps) {
  const [date, setDate] = useState<Date | null>(() => isoToDate(defaultValue));
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placement: "below" | "above";
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // External resync — if parent re-fetches and passes a new ISO, mirror it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDate(isoToDate(defaultValue));
  }, [defaultValue]);

  // Skip first render so auto-save cells don't fire on mount.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialIsoRef = useRef(date ? date.toISOString() : "");
  const previousIsoRef = useRef(initialIsoRef.current);
  useEffect(() => {
    const next = date ? date.toISOString() : "";
    if (next === previousIsoRef.current) return;
    previousIsoRef.current = next;
    if (next === initialIsoRef.current) return;
    onChangeRef.current?.(next);
  }, [date]);

  const recompute = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const margin = 8;
    const desiredHeight = 380;
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;
    const placement: "below" | "above" =
      spaceBelow >= 280 || spaceBelow >= spaceAbove ? "below" : "above";
    const left = Math.min(
      Math.max(r.left, margin),
      window.innerWidth - 320 - margin,
    );
    if (placement === "below") {
      setCoords({ top: r.bottom + 6, left, placement });
    } else {
      setCoords({
        top: Math.max(margin, r.top - 6 - desiredHeight),
        left,
        placement,
      });
    }
  };

  const openPicker = () => {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    // Mobile: bottom sheet — pomijamy recompute (Sheet sam pozycjonuje).
    if (isMobile) {
      setOpen(true);
      return;
    }
    recompute();
    setOpen(true);
  };

  useEffect(() => {
    // Mobile: Base UI Sheet ma własny outside-click/Escape. Skip żeby
    // uniknąć podwojonych close'ów.
    if (!open || isMobile) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReflow = () => recompute();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, isMobile]);

  const onDaySelect = (day: Date | undefined) => {
    if (!day) {
      setDate(null);
      return;
    }
    // Preserve current time-of-day if user already set one; otherwise 09:00
    // (date-only mode → 00:00 because time is irrelevant in tym kontekście).
    const next = new Date(day);
    if (date) {
      next.setHours(date.getHours(), date.getMinutes(), 0, 0);
    } else if (dateOnly) {
      next.setHours(0, 0, 0, 0);
    } else {
      next.setHours(9, 0, 0, 0);
    }
    setDate(next);
  };

  const setTime = (h: number, m: number) => {
    const base = date ?? new Date();
    const next = new Date(base);
    next.setHours(h, m, 0, 0);
    setDate(next);
  };

  const setToday = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    setDate(now);
  };

  const clear = () => {
    setDate(null);
  };

  const display = formatDisplay(date, dateOnly);
  const hh = date ? pad2(date.getHours()) : "09";
  const mm = date ? pad2(date.getMinutes()) : "00";
  const isoForForm = date ? date.toISOString() : "";

  const isCell = variant === "cell";
  const triggerClass = isCell
    ? `group/dt flex w-full items-center gap-1.5 rounded-md py-1 text-left text-[0.84rem] transition-colors enabled:hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60 ${
        open ? "bg-accent/40" : ""
      }`
    : `flex h-10 w-full items-center gap-2 rounded-md border bg-background px-3 text-left text-[0.88rem] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        open
          ? "border-primary"
          : "border-border hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none"
      }`;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label={label ?? placeholder}
        aria-expanded={open}
        className={triggerClass}
      >
        {!isCell && (
          <CalendarIcon
            size={14}
            className={date ? "text-foreground" : "text-muted-foreground"}
            aria-hidden
          />
        )}
        <span
          className={`min-w-0 flex-1 truncate ${
            date
              ? isCell
                ? "font-mono text-[0.8rem] text-foreground"
                : "text-foreground"
              : isCell
                ? "font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground/60"
                : "text-muted-foreground"
          }`}
        >
          {date ? display : isCell ? "—" : placeholder}
        </span>
        {date && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            aria-label="Wyczyść datę"
            title="Wyczyść"
            className={
              isCell
                ? "grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/dt:opacity-100"
                : "grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            }
          >
            <X size={11} />
          </span>
        )}
      </button>
      <input type="hidden" name={name} value={isoForForm} form={form} />

      {open && coords && !isMobile && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            // Stop pointer events from reaching ancestor dismiss-on-outside
            // listeners — base-ui's Dialog watches document for clicks outside
            // its popup, and since this picker is portaled to document.body
            // (intentionally, so it can escape overflow clipping), a click on
            // the hour stepper looked like "outside" and closed the host
            // dialog. Capture phase so we beat base-ui's handler.
            onPointerDownCapture={(e) => e.stopPropagation()}
            onMouseDownCapture={(e) => e.stopPropagation()}
            style={{ position: "fixed", top: coords.top, left: coords.left, width: 320 }}
            // z-[200] === Z.popoverInModal (F12-K104).
            className="popover-glass popover-enter shadow-aura z-[200] flex flex-col overflow-hidden"
          >
            {/* Presets row — Dziś / Jutro / W tygodniu — v4 spec */}
            <div className="flex shrink-0 items-center gap-1.5 px-3 pt-3">
              <button
                type="button"
                onClick={setToday}
                className="rounded-full bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary active:bg-primary/15"
              >
                Dzisiaj
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = new Date();
                  t.setDate(t.getDate() + 1);
                  if (dateOnly) t.setHours(0, 0, 0, 0);
                  else t.setHours(9, 0, 0, 0);
                  setDate(t);
                }}
                className="rounded-full bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary active:bg-primary/15"
              >
                Jutro
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = new Date();
                  t.setDate(t.getDate() + 7);
                  if (dateOnly) t.setHours(0, 0, 0, 0);
                  else t.setHours(9, 0, 0, 0);
                  setDate(t);
                }}
                className="rounded-full bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary active:bg-primary/15"
              >
                W tygodniu
              </button>
            </div>
            <div className="rdp-host px-3 pt-2">
              <DayPicker
                mode="single"
                selected={date ?? undefined}
                onSelect={onDaySelect}
                locale={pl}
                weekStartsOn={1}
                showOutsideDays
                captionLayout="label"
              />
            </div>
            {!dateOnly && (
              <div className="flex items-center gap-3 border-t border-border/60 bg-muted/30 px-3 py-3">
                <span className="eyebrow text-[0.62rem]">Godzina</span>
                <div className="ml-auto flex items-stretch gap-2">
                  <TimeStepper
                    value={date?.getHours() ?? 9}
                    min={0}
                    max={23}
                    ariaLabel="Godzina"
                    onChange={(v) => setTime(v, date?.getMinutes() ?? 0)}
                  />
                  <span className="grid place-items-center font-mono text-[1rem] font-bold text-muted-foreground">
                    :
                  </span>
                  <TimeStepper
                    value={date?.getMinutes() ?? 0}
                    min={0}
                    max={59}
                    step={5}
                    ariaLabel="Minuty"
                    onChange={(v) => setTime(date?.getHours() ?? 9, v)}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 border-t border-border/60 px-3 py-2">
              <button
                type="button"
                onClick={clear}
                className="rounded-[6px] px-2 py-1 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                Wyczyść
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[6px] bg-primary px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-foreground transition-opacity hover:opacity-90"
              >
                Gotowe
              </button>
            </div>
          </div>,
          document.body,
        )}

      {/* Mobile: bottom sheet — spec v4 linie 169-183. Presets horizontal scroll
          chips + DayPicker + TimeStepper + sticky footer Wyczyść/Gotowe. */}
      {isMobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="sheet-mobile-surface max-h-[90dvh] gap-0 p-0"
          >
            <div className="flex max-h-[90dvh] flex-col">
              <div className="pt-3">
                <div className="sheet-drag-handle" aria-hidden="true" />
              </div>
              <SheetTitle className="sr-only">
                {label ?? placeholder}
              </SheetTitle>
              {/* Presets — horizontal scroll na mobile (spec v4) */}
              <div className="-mx-1 flex shrink-0 items-center gap-2 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={setToday}
                  className="min-h-[36px] shrink-0 rounded-full bg-muted/60 px-3.5 text-[13px] font-medium text-foreground transition-colors active:bg-primary/15"
                >
                  Dzisiaj
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const t = new Date();
                    t.setDate(t.getDate() + 1);
                    if (dateOnly) t.setHours(0, 0, 0, 0);
                    else t.setHours(9, 0, 0, 0);
                    setDate(t);
                  }}
                  className="min-h-[36px] shrink-0 rounded-full bg-muted/60 px-3.5 text-[13px] font-medium text-foreground transition-colors active:bg-primary/15"
                >
                  Jutro
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const t = new Date();
                    t.setDate(t.getDate() + 7);
                    if (dateOnly) t.setHours(0, 0, 0, 0);
                    else t.setHours(9, 0, 0, 0);
                    setDate(t);
                  }}
                  className="min-h-[36px] shrink-0 rounded-full bg-muted/60 px-3.5 text-[13px] font-medium text-foreground transition-colors active:bg-primary/15"
                >
                  W tygodniu
                </button>
              </div>
              <div className="rdp-host min-h-0 flex-1 overflow-y-auto px-3">
                <DayPicker
                  mode="single"
                  selected={date ?? undefined}
                  onSelect={onDaySelect}
                  locale={pl}
                  weekStartsOn={1}
                  showOutsideDays
                  captionLayout="label"
                />
              </div>
              {!dateOnly && (
                <div className="flex shrink-0 items-center gap-3 border-t border-border/60 bg-muted/30 px-4 py-3">
                  <span className="eyebrow text-[0.7rem]">Godzina</span>
                  <div className="ml-auto flex items-stretch gap-2">
                    <TimeStepper
                      value={date?.getHours() ?? 9}
                      min={0}
                      max={23}
                      ariaLabel="Godzina"
                      onChange={(v) => setTime(v, date?.getMinutes() ?? 0)}
                    />
                    <span className="grid place-items-center font-mono text-[1.1rem] font-bold text-muted-foreground">
                      :
                    </span>
                    <TimeStepper
                      value={date?.getMinutes() ?? 0}
                      min={0}
                      max={59}
                      step={5}
                      ariaLabel="Minuty"
                      onChange={(v) => setTime(date?.getHours() ?? 9, v)}
                    />
                  </div>
                </div>
              )}
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 px-4 pt-3 pb-safe-bottom">
                <button
                  type="button"
                  onClick={clear}
                  className="min-h-[44px] rounded-[10px] px-3 text-[14px] font-medium text-destructive transition-colors active:bg-destructive/10"
                >
                  Wyczyść
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-brand-gradient px-5 text-[14px] font-semibold text-white shadow-brand transition-opacity active:opacity-85"
                >
                  Gotowe
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

// Vertical stepper for hour/minute. Native <input type="number"> arrows are
// tiny + browser-styled — this gives us bigger touch targets, predictable
// look, and explicit step control (5-minute jumps for minutes).
function TimeStepper({
  value,
  min,
  max,
  step = 1,
  ariaLabel,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  ariaLabel: string;
  onChange: (v: number) => void;
}) {
  const wrap = (v: number) => {
    if (v < min) return max;
    if (v > max) return min;
    return v;
  };
  return (
    <div className="flex items-stretch overflow-hidden rounded-md border border-border bg-background">
      <input
        type="text"
        inputMode="numeric"
        value={String(value).padStart(2, "0")}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        aria-label={ariaLabel}
        className="w-10 bg-transparent px-2 text-center font-mono text-[0.92rem] font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
      />
      <div className="flex flex-col border-l border-border">
        <button
          type="button"
          onClick={() => onChange(wrap(value + step))}
          aria-label={`${ariaLabel} +${step}`}
          className="grid h-[18px] w-6 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronUp size={13} />
        </button>
        <button
          type="button"
          onClick={() => onChange(wrap(value - step))}
          aria-label={`${ariaLabel} −${step}`}
          className="grid h-[18px] w-6 place-items-center border-t border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronDown size={13} />
        </button>
      </div>
    </div>
  );
}
