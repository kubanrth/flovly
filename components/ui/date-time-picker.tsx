"use client";

// Hidden <input name> z ISO string → parent <form action> zbiera wartość.
// Desktop: base-ui Popover; mobile (<768): bottom Sheet.

import { useState } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { DayPicker } from "react-day-picker";
import { pl } from "date-fns/locale";
import "react-day-picker/style.css";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { IconCalendar, IconChevronDown, IconChevronUp, IconClose } from "./icons";
import { inputVariants } from "./input";
import { POPUP_CLASS } from "./popover";
import { Sheet, SheetContent, SheetTitle } from "./sheet";

export interface DateTimePickerProps {
  name: string;
  // HTML5 `form` na hidden input — picker może żyć poza <form>.
  form?: string;
  defaultValue: string | null;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  // "cell" = bez ramki, do inline edycji w tabeli.
  variant?: "input" | "cell";
  // Każda edycja (dzień, godzina, preset, wyczyść) — autosave bez formularza.
  onChange?: (iso: string) => void;
  dateOnly?: boolean;
  // Custom display of the picked date (Lista shows „29 sie”); text then inherits the trigger colour.
  format?: (d: Date) => string;
  triggerClassName?: string;
}

function isoToDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
const pad2 = (n: number) => String(n).padStart(2, "0");
// dd.mm.rr (+ HH:MM) — mieści się w wąskich komórkach (K117).
function formatDisplay(d: Date | null, dateOnly: boolean) {
  if (!d) return "";
  const base = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;
  return dateOnly ? base : `${base} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
const PRESETS: [string, number][] = [["Dzisiaj", 0], ["Jutro", 1], ["W tygodniu", 7]];

export function DateTimePicker({ name, form, defaultValue, disabled, placeholder = "Wybierz datę", label, variant = "input", dateOnly = false, onChange, format, triggerClassName }: DateTimePickerProps) {
  const [date, setDate] = useState<Date | null>(() => isoToDate(defaultValue));
  const [prevDefault, setPrevDefault] = useState(defaultValue);
  if (defaultValue !== prevDefault) {
    setPrevDefault(defaultValue);
    setDate(isoToDate(defaultValue));
  }
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const update = (next: Date | null) => {
    const iso = next ? next.toISOString() : "";
    if (iso !== (date ? date.toISOString() : "")) onChange?.(iso);
    setDate(next);
  };
  const onDaySelect = (day: Date | undefined) => {
    if (!day) return update(null);
    const next = new Date(day);
    if (date) next.setHours(date.getHours(), date.getMinutes(), 0, 0);
    else next.setHours(dateOnly ? 0 : 9, 0, 0, 0);
    update(next);
  };
  const setTime = (h: number, m: number) => {
    const next = new Date(date ?? new Date());
    next.setHours(h, m, 0, 0);
    update(next);
  };
  const preset = (days: number) => {
    const t = new Date();
    if (days === 0) t.setSeconds(0, 0);
    else {
      t.setDate(t.getDate() + days);
      t.setHours(dateOnly ? 0 : 9, 0, 0, 0);
    }
    update(t);
  };

  const isCell = variant === "cell";
  const triggerClass = isCell
    ? cn("flex h-full min-h-7 w-full items-center gap-1.5 rounded-sm px-2 text-left text-sm outline-none hover:bg-row-hover disabled:pointer-events-none disabled:text-n-400", open && "bg-row-hover", triggerClassName)
    : cn(inputVariants({ size: "md" }), "flex items-center gap-2 text-left", open && "border-orange-500", triggerClassName);
  const triggerInner = (
    <>
      <span className={cn("min-w-0 flex-1 truncate", date ? (format ? "" : "font-mono text-xs tabular-nums text-foreground") : "text-n-500")}>{date ? (format ? format(date) : formatDisplay(date, dateOnly)) : isCell ? "—" : placeholder}</span>
      {date && !disabled && (
        <span role="button" tabIndex={-1} aria-label="Wyczyść datę" onClick={(e) => { e.stopPropagation(); update(null); }} className="inline-flex size-4 shrink-0 items-center justify-center rounded-[2px] text-n-500 hover:text-foreground">
          <IconClose width={11} height={11} />
        </span>
      )}
      {!isCell && <IconCalendar width={13} height={13} className="shrink-0 text-n-500" />}
    </>
  );
  const hidden = <input type="hidden" name={name} value={date ? date.toISOString() : ""} form={form} />;

  const body = (mobile: boolean) => (
    <>
      <div className={cn("flex items-center gap-1.5 px-3 pt-3", mobile && "px-4")}>
        {PRESETS.map(([l, d]) => (
          <button key={l} type="button" onClick={() => preset(d)} className="h-6 rounded-sm bg-n-100 px-2 text-2xs font-medium text-muted-foreground outline-none hover:bg-n-200 hover:text-foreground">{l}</button>
        ))}
      </div>
      <div className="rdp-host px-3 pt-2">
        <DayPicker mode="single" selected={date ?? undefined} onSelect={onDaySelect} locale={pl} weekStartsOn={1} showOutsideDays captionLayout="label" />
      </div>
      {!dateOnly && (
        <div className="flex items-center gap-3 border-t border-border bg-canvas px-3 py-2.5">
          <span className="eyebrow">Godzina</span>
          <div className="ml-auto flex items-center gap-1.5">
            <TimeStepper value={date?.getHours() ?? 9} min={0} max={23} ariaLabel="Godzina" onChange={(v) => setTime(v, date?.getMinutes() ?? 0)} />
            <span className="font-mono text-sm font-semibold text-muted-foreground">:</span>
            <TimeStepper value={date?.getMinutes() ?? 0} min={0} max={59} step={5} ariaLabel="Minuty" onChange={(v) => setTime(date?.getHours() ?? 9, v)} />
          </div>
        </div>
      )}
      <div className={cn("flex items-center justify-end gap-2 border-t border-border px-3 py-2", mobile && "safe-bottom px-4 py-3")}>
        <Button variant="ghost" size={mobile ? "lg" : "sm"} className="text-danger-text hover:text-danger-text" onClick={() => update(null)}>Wyczyść</Button>
        <Button size={mobile ? "lg" : "sm"} onClick={() => setOpen(false)}>Gotowe</Button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <button type="button" onClick={() => !disabled && setOpen(true)} disabled={disabled} aria-label={label ?? placeholder} aria-expanded={open} className={triggerClass}>{triggerInner}</button>
        {hidden}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" showCloseButton={false}>
            <div className="sheet-drag-handle" aria-hidden="true" />
            <SheetTitle className="sr-only">{label ?? placeholder}</SheetTitle>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{body(true)}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger disabled={disabled} aria-label={label ?? placeholder} className={triggerClass}>{triggerInner}</PopoverPrimitive.Trigger>
      {hidden}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={6} align="start" className="z-[100] outline-none">
          <PopoverPrimitive.Popup className={cn(POPUP_CLASS, "w-[300px] overflow-hidden")}>{body(false)}</PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function TimeStepper({ value, min, max, step = 1, ariaLabel, onChange }: { value: number; min: number; max: number; step?: number; ariaLabel: string; onChange: (v: number) => void }) {
  const wrap = (v: number) => (v < min ? max : v > max ? min : v);
  const btn = "grid h-[15px] w-5 place-items-center text-n-500 outline-none hover:bg-n-100 hover:text-foreground";
  return (
    <div className="flex items-stretch overflow-hidden rounded-sm border border-input-border bg-card">
      <input
        type="text"
        inputMode="numeric"
        value={pad2(value)}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
        aria-label={ariaLabel}
        className="w-9 bg-transparent text-center font-mono text-sm tabular-nums outline-none focus-visible:bg-n-100 focus-visible:shadow-none"
      />
      <div className="flex flex-col border-l border-input-border">
        <button type="button" onClick={() => onChange(wrap(value + step))} aria-label={`${ariaLabel} +${step}`} className={btn}><IconChevronUp width={11} height={11} /></button>
        <button type="button" onClick={() => onChange(wrap(value - step))} aria-label={`${ariaLabel} −${step}`} className={cn(btn, "border-t border-input-border")}><IconChevronDown width={11} height={11} /></button>
      </div>
    </div>
  );
}
