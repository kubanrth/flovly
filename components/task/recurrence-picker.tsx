"use client";

// Recurrence rule picker (klient: "zadanie wchodzi każdego dnia miesiąca").
// Rule shape: daily | weekly (`day` 0..6 Sun..Sat) | monthly (`day` 1..31).
// Cron `/api/cron/spawn-recurring` (00:05 UTC) spawns instances of templates.

import { startTransition, useState } from "react";
import { setTaskRecurrenceAction } from "@/app/(app)/w/[workspaceId]/t/recurrence-actions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type RecurrenceRule = { freq: "daily" | "weekly" | "monthly"; day?: number };
type Freq = "none" | RecurrenceRule["freq"];

const WEEKDAYS = ["Niedz.", "Pon.", "Wt.", "Śr.", "Czw.", "Pt.", "Sob."];
const WEEKDAY_LETTERS = ["N", "P", "W", "Ś", "C", "P", "S"];
const FREQ_OPTS: { value: Freq; label: string }[] = [
  { value: "none", label: "Brak" }, { value: "daily", label: "Codziennie" }, { value: "weekly", label: "Co tydzień" }, { value: "monthly", label: "Co miesiąc" },
];

export function summarizeRule(rule: RecurrenceRule | null): string {
  if (!rule) return "Brak";
  if (rule.freq === "daily") return "Codziennie";
  if (rule.freq === "weekly") return `Co tydzień, ${WEEKDAYS[rule.day ?? 1]}`;
  return `Co miesiąc, ${rule.day ?? 1}. dnia`;
}

// Inline radio list (lives inside the „Cykliczność" popover in the details column).
export function RecurrencePicker({ taskId, rule, disabled }: { taskId: string; rule: RecurrenceRule | null; disabled: boolean }) {
  const [draft, setDraft] = useState<RecurrenceRule | null>(rule);
  const persist = (next: RecurrenceRule | null) => {
    setDraft(next);
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("rule", next ? JSON.stringify(next) : "");
    startTransition(() => setTaskRecurrenceAction(fd));
  };
  const freq: Freq = draft?.freq ?? "none";
  const pick = (v: Freq) => persist(v === "none" ? null : v === "daily" ? { freq: "daily" } : { freq: v, day: draft?.day ?? 1 });

  return (
    <div className="flex w-[220px] flex-col gap-1">
      <div role="radiogroup" aria-label="Częstotliwość powtarzania" className="flex flex-col">
        {FREQ_OPTS.map((opt) => {
          const active = freq === opt.value;
          return (
            <button key={opt.value} type="button" role="radio" aria-checked={active} disabled={disabled} onClick={() => pick(opt.value)}
              className={cn("flex h-8 items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-n-100 disabled:text-n-400", active ? "font-medium text-foreground" : "text-n-600")}>
              <span aria-hidden className={cn("size-3.5 shrink-0 rounded-full border bg-card", active ? "border-[4.5px] border-control-on" : "border-[1.5px] border-n-400")} />
              {opt.label}
            </button>
          );
        })}
      </div>
      {freq === "weekly" && (
        <div className="flex gap-1 px-2 pt-1">
          {WEEKDAY_LETTERS.map((letter, idx) => {
            const active = (draft?.day ?? 1) === idx;
            return (
              <button key={idx} type="button" disabled={disabled} aria-label={WEEKDAYS[idx]} aria-pressed={active} onClick={() => persist({ freq: "weekly", day: idx })}
                className={cn("grid size-6 place-items-center rounded-sm font-mono text-2xs font-semibold outline-none", active ? "bg-control-on text-white" : "bg-n-100 text-n-600 hover:bg-n-200")}>
                {letter}
              </button>
            );
          })}
        </div>
      )}
      {freq === "monthly" && (
        <div className="flex items-center gap-2 px-2 pt-1 text-xs text-n-600">
          Dzień
          <Input type="number" min={1} max={31} size="sm" disabled={disabled} value={draft?.day ?? 1} aria-label="Dzień miesiąca" className="w-14 text-center font-mono"
            onChange={(e) => persist({ freq: "monthly", day: Math.max(1, Math.min(31, parseInt(e.target.value || "1", 10) || 1)) })} />
          miesiąca
        </div>
      )}
      {draft && <span className="px-2 pt-1 font-mono text-[10px] text-fg-3">{summarizeRule(draft)} · cron 00:05 UTC</span>}
    </div>
  );
}
