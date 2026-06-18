"use client";

// Recurrence rule picker for task detail. Klient zażądał
// "zadanie wchodzi każdego dnia miesiąca". Rule shape:
//   - daily: every day
//   - weekly: every week on `day` (0..6, Sun..Sat)
//   - monthly: every month on `day` (1..31, clamped to month length)
//
// On change, pushes the rule via setTaskRecurrenceAction. Server cron
// `/api/cron/spawn-recurring` runs daily at 00:05 UTC and creates
// instances of templates that match today's rule.
//
// Visual: v4 RRULE builder — radio rows + day picker (weekly) /
// numeric input (monthly) + live RRULE preview pod spodem.

import { startTransition, useState } from "react";
import { Repeat } from "lucide-react";
import { setTaskRecurrenceAction } from "@/app/(app)/w/[workspaceId]/t/recurrence-actions";

type Rule = { freq: "daily" | "weekly" | "monthly"; day?: number };

const WEEKDAYS = ["Niedz.", "Pon.", "Wt.", "Śr.", "Czw.", "Pt.", "Sob."];
// Skróty 1-literowe dla day-pickera weekly (v4 spec: P W Ś C P S N).
const WEEKDAY_LETTERS = ["N", "P", "W", "Ś", "C", "P", "S"];
// Mapowanie indexu (0=Sun..6=Sat) → RRULE BYDAY token.
const RRULE_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

type Freq = "none" | "daily" | "weekly" | "monthly";

export function RecurrencePicker({
  taskId,
  rule,
  disabled,
}: {
  taskId: string;
  rule: Rule | null;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState<Rule | null>(rule);

  const persist = (next: Rule | null) => {
    setDraft(next);
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("rule", next ? JSON.stringify(next) : "");
    startTransition(() => setTaskRecurrenceAction(fd));
  };

  const currentFreq: Freq = draft?.freq ?? "none";

  const summary = draft
    ? draft.freq === "daily"
      ? "Codziennie"
      : draft.freq === "weekly"
        ? `Co tydzień, ${WEEKDAYS[draft.day ?? 1]}`
        : `Co miesiąc, ${draft.day ?? 1}. dnia`
    : "Brak";

  // Live RRULE preview — czysto kosmetyczne, server używa naszego JSON shape'u.
  const rrule = !draft
    ? "RRULE:FREQ=NONE"
    : draft.freq === "daily"
      ? "RRULE:FREQ=DAILY"
      : draft.freq === "weekly"
        ? `RRULE:FREQ=WEEKLY;BYDAY=${RRULE_DAY[draft.day ?? 1]}`
        : `RRULE:FREQ=MONTHLY;BYMONTHDAY=${draft.day ?? 1}`;

  const pickFreq = (v: Freq) => {
    if (v === "none") return persist(null);
    if (v === "daily") return persist({ freq: "daily" });
    if (v === "weekly")
      return persist({ freq: "weekly", day: draft?.day ?? 1 });
    if (v === "monthly")
      return persist({ freq: "monthly", day: draft?.day ?? 1 });
  };

  const FREQ_OPTS: { value: Freq; label: string }[] = [
    { value: "none", label: "Brak" },
    { value: "daily", label: "Codziennie" },
    { value: "weekly", label: "Co tydzień" },
    { value: "monthly", label: "Co miesiąc" },
  ];

  return (
    <div className="popover-glass shadow-aura flex flex-col gap-1 p-2">
      <span className="eyebrow flex items-center gap-1.5 px-1 pb-0.5 text-[0.62rem]">
        <Repeat size={11} />
        Powtarzaj
      </span>

      <div role="radiogroup" aria-label="Częstotliwość powtarzania" className="flex flex-col gap-0.5">
        {FREQ_OPTS.map((opt) => {
          const active = currentFreq === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => pickFreq(opt.value)}
              data-active={active}
              className="flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-muted active:bg-primary/10 data-[active=true]:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span
                aria-hidden="true"
                className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full border-[1.5px] border-border data-[active=true]:border-primary data-[active=true]:border-[4.5px]"
                data-active={active}
              />
              <span
                className={`flex-1 text-[13px] ${
                  active ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                }`}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Weekly: day-picker (P W Ś C P S N) */}
      {currentFreq === "weekly" && (
        <div className="flex flex-wrap gap-1 px-1 pt-1.5">
          {WEEKDAY_LETTERS.map((letter, idx) => {
            const active = (draft?.day ?? 1) === idx;
            return (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                aria-label={WEEKDAYS[idx]}
                aria-pressed={active}
                onClick={() => persist({ freq: "weekly", day: idx })}
                data-active={active}
                className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] bg-muted/50 font-mono text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted active:bg-primary/10 data-[active=true]:bg-brand-gradient data-[active=true]:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}

      {/* Monthly: numeric input 1-31 */}
      {currentFreq === "monthly" && (
        <div className="flex items-center gap-2 px-1 pt-1.5">
          <span className="text-[12px] text-muted-foreground">Dzień</span>
          <input
            type="number"
            min={1}
            max={31}
            disabled={disabled}
            value={draft?.day ?? 1}
            onChange={(e) => {
              const v = Math.max(1, Math.min(31, parseInt(e.target.value || "1", 10) || 1));
              persist({ freq: "monthly", day: v });
            }}
            aria-label="Dzień miesiąca"
            className="h-7 w-14 rounded-[8px] border border-border bg-card/40 px-2 text-center font-mono text-[12.5px] tabular-nums outline-none focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span className="text-[12px] text-muted-foreground">. miesiąca</span>
        </div>
      )}

      {/* Live RRULE preview */}
      <div className="mt-1 truncate px-1 pt-0.5 font-mono text-[10px] tracking-tight text-muted-foreground/80">
        {rrule}
      </div>

      {draft && (
        <span className="px-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">
          {summary} · cron 00:05 UTC
        </span>
      )}
    </div>
  );
}
