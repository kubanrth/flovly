"use client";

// D4 — siatka godzinowa Dzień/Tydzień: kolumna godzin 56px (08:00–17:00),
// wiersz „cały dzień" (urlopy), pigułki terminów/przypomnień i linia „teraz".

import type { CSSProperties } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { WEEKDAYS, dayKey } from "@/components/calendar/calendar-math";
import {
  GRID_PX,
  HOUR_LABELS,
  SLOT_PX,
  nowOffset,
  type AllDayBlock,
  type TimedBlock,
  type WeekLayout,
  type WeekSource,
} from "./week-math";

// Legenda z sidebara: termin = niebieski, przypomnienie = żółte, urlop = zielony.
export const SOURCE_DOT: Record<WeekSource, string> = {
  tasks: "bg-info",
  reminders: "bg-warning",
  vacations: "bg-success",
};

const SOURCE_PILL: Record<WeekSource, string> = {
  tasks: "bg-chip-blue-bg text-chip-blue-fg border-l-info",
  reminders: "bg-chip-yellow-bg text-chip-yellow-fg border-l-warning",
  vacations: "bg-chip-green-bg text-chip-green-fg border-l-success",
};

const pillBase =
  "flex items-center overflow-hidden rounded-sm border-l-[3px] px-1.5 outline-none";
const pillMotion =
  "transition-opacity duration-[120ms] ease-[var(--ease-out)] hover:opacity-80 active:opacity-70 focus-visible:shadow-[var(--focus)] motion-reduce:transition-none";

/** Gridlines co 48px — ostatni piksel wiersza to linia `--n-100`. */
const HOUR_LINES = {
  backgroundImage: `repeating-linear-gradient(180deg,transparent 0 ${SLOT_PX - 1}px,var(--n-100) ${SLOT_PX - 1}px ${SLOT_PX}px)`,
};


export function WeekGrid({
  days,
  layout,
  todayKey,
  now,
}: {
  days: Date[];
  layout: WeekLayout;
  todayKey: string;
  now: Date | null;
}) {
  return (
    <div data-ui="calendar-week" className="flex min-h-0 flex-1 flex-col">
      {/* Nagłówki dni */}
      <div className="flex flex-none border-b border-border">
        <span className="w-14 flex-none border-r border-table-grid" />
        {days.map((day, i) => {
          const key = dayKey(day);
          const isToday = key === todayKey;
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          return (
            <div
              key={key}
              className={cn(
                "min-w-0 flex-1 px-2 py-1.5",
                i < days.length - 1 && "border-r border-table-grid",
                isToday && "bg-selected",
                !isToday && weekend && "bg-canvas",
              )}
            >
              <span className={cn("eyebrow", isToday ? "text-orange-800" : weekend ? "text-fg-3" : "text-fg-2")}>
                {WEEKDAYS[(day.getDay() + 6) % 7]}
              </span>
              {isToday ? (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-orange-500 text-xs font-bold text-ink">
                  {day.getDate()}
                </span>
              ) : (
                <span className={cn("ml-1 text-sm", weekend ? "text-fg-3" : "font-medium")}>{day.getDate()}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Wiersz „cały dzień" — urlopy */}
      <div data-ui="calendar-allday" className="flex flex-none border-b border-border bg-canvas">
        <span className="flex w-14 flex-none items-center justify-center border-r border-table-grid font-mono text-[9px] text-fg-3">
          cały dzień
        </span>
        {days.map((day, i) => {
          const key = dayKey(day);
          const isToday = key === todayKey;
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          return (
            <div
              key={key}
              className={cn(
                "flex min-h-[26px] min-w-0 flex-1 flex-col gap-[2px] px-1 py-[3px]",
                i < days.length - 1 && "border-r border-table-grid",
                isToday && "bg-selected",
                !isToday && weekend && "bg-canvas",
              )}
            >
              {(layout.allDay.get(key) ?? []).map((block) => (
                <AllDayPill key={block.key} block={block} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Siatka godzin */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div data-ui="calendar-grid" className="flex" style={{ height: GRID_PX }}>
          <div className="w-14 flex-none border-r border-table-grid">
            {HOUR_LABELS.map((label) => (
              <div key={label} className="relative" style={{ height: SLOT_PX }}>
                <span className="absolute -top-[7px] right-1.5 font-mono text-[9px] text-fg-3">{label}</span>
              </div>
            ))}
          </div>

          {days.map((day, i) => {
            const key = dayKey(day);
            const isToday = key === todayKey;
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            const line = now ? nowOffset(now, day) : null;
            return (
              <div
                key={key}
                data-day={key}
                data-today={isToday || undefined}
                className={cn(
                  "relative min-w-0 flex-1",
                  i < days.length - 1 && "border-r border-table-grid",
                  isToday ? "bg-today" : weekend ? "bg-canvas" : undefined,
                )}
                style={weekend && !isToday ? undefined : HOUR_LINES}
              >
                {line !== null && (
                  <>
                    <span
                      data-ui="calendar-now"
                      aria-hidden="true"
                      className="absolute left-0 right-0 z-[5] h-0.5 bg-orange-500"
                      style={{ top: line }}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute left-0.5 z-[5] size-2 rounded-full bg-orange-500"
                      style={{ top: line - 3 }}
                    />
                  </>
                )}
                {(layout.timed.get(key) ?? []).map((block) => (
                  <TimedPill key={block.key} block={block} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AllDayPill({ block }: { block: AllDayBlock }) {
  const className = cn(pillBase, SOURCE_PILL[block.source], "h-5 shrink-0", block.href && pillMotion);
  const label = <span className="truncate text-2xs font-medium">{block.label}</span>;
  return block.href ? (
    <Link href={block.href} title={block.label} className={className}>
      {label}
    </Link>
  ) : (
    <span title={block.label} className={className}>
      {label}
    </span>
  );
}

function TimedPill({ block }: { block: TimedBlock }) {
  const text = `${block.timeLabel} ${block.title}`;
  const className = cn(pillBase, SOURCE_PILL[block.source], "absolute left-[3px] right-[3px]", block.href && pillMotion);
  const style = { top: block.top, height: block.height };
  const label = <span className="truncate text-[10px] font-medium">{text}</span>;
  return block.href ? (
    <Link href={block.href} title={text} className={className} style={style}>
      {label}
    </Link>
  ) : (
    <span title={text} className={className} style={style}>
      {label}
    </span>
  );
}
