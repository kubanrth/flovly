"use client";

// Kalendarz <768px (B7-mobile): mini month grid with status dots, the selected
// day rendered black, that day's tasks as cards below, „Dodaj zadanie na <data>"
// pinned to the bottom.

import Link from "next/link";
import { cn } from "@/lib/utils";
import { taskPl } from "@/lib/pluralize";
import { Avatar } from "@/components/ui/avatar";
import { StatusChip } from "@/components/ui/chip";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";
import { QuickAddTask, barClass, statusHue } from "./calendar-parts";
import {
  WEEKDAY_LETTERS,
  addMonths,
  dayKey,
  dayTitleLong,
  monthGrid,
  monthTitle,
  parseDayKey,
  type TaskPill,
} from "./calendar-math";

export function CalendarMobile({
  workspaceId,
  boardId,
  canCreate,
  focus,
  onFocus,
  selected,
  onSelect,
  byDay,
  onToday,
}: {
  workspaceId: string;
  boardId: string;
  canCreate: boolean;
  focus: Date;
  onFocus: (d: Date) => void;
  selected: string;
  onSelect: (key: string) => void;
  byDay: Map<string, TaskPill[]>;
  onToday: () => void;
}) {
  const days = monthGrid(focus);
  const todayKey = dayKey(new Date());
  const selectedDate = parseDayKey(selected);
  const dayPills = byDay.get(selected) ?? [];

  return (
    <div data-ui="calendar-mobile" className="flex min-h-[calc(100dvh-140px)] flex-col bg-card pb-24">
      <div className="flex items-center gap-2 px-4 pt-2.5">
        <span className="text-lg font-semibold -tracking-[0.2px]">{monthTitle(focus)}</span>
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Poprzedni miesiąc"
            onClick={() => onFocus(addMonths(focus, -1))}
            className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground outline-none hover:bg-n-100 active:bg-n-200 focus-visible:shadow-[var(--focus)]"
          >
            <IconChevronLeft width={13} height={13} strokeWidth={1.6} />
          </button>
          <button
            type="button"
            aria-label="Następny miesiąc"
            onClick={() => onFocus(addMonths(focus, 1))}
            className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground outline-none hover:bg-n-100 active:bg-n-200 focus-visible:shadow-[var(--focus)]"
          >
            <IconChevronRight width={13} height={13} strokeWidth={1.6} />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium text-foreground outline-none hover:bg-n-100 active:bg-n-200 focus-visible:shadow-[var(--focus)]"
          >
            Dzisiaj
          </button>
        </span>
      </div>

      <div className="border-b border-border px-4 pb-1 pt-3">
        <div className="mb-1.5 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-[.05em] text-fg-3">
          {WEEKDAY_LETTERS.map((l, i) => <span key={i}>{l}</span>)}
        </div>
        <div data-ui="calendar-grid" className="grid grid-cols-7 gap-0.5 text-center">
          {days.map((date, i) => {
            const key = dayKey(date);
            const inMonth = date.getMonth() === focus.getMonth();
            const weekend = i % 7 >= 5;
            const isSelected = key === selected;
            const dots = (byDay.get(key) ?? []).slice(0, 2);
            return (
              <button
                key={key}
                type="button"
                data-day={key}
                data-selected={isSelected || undefined}
                aria-pressed={isSelected}
                aria-label={dayTitleLong(date)}
                onClick={() => onSelect(key)}
                className={cn(
                  "relative min-h-8 rounded-md py-1.5 text-xs outline-none focus-visible:shadow-[var(--focus)]",
                  !inMonth && "text-n-400",
                  inMonth && weekend && "text-fg-3",
                  !isSelected && "hover:bg-n-100 active:bg-n-200",
                  !isSelected && key === todayKey && "font-semibold text-orange-700",
                  isSelected && "bg-n-900 font-semibold text-white",
                )}
              >
                {date.getDate()}
                {dots.length > 0 && (
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0.5 flex justify-center gap-0.5">
                    {dots.map((pill) => (
                      <span
                        key={pill.key}
                        className={cn("size-1 rounded-full", isSelected ? "bg-white" : barClass(statusHue(pill.task.statusColor)))}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-4 py-3">
        <p className="eyebrow mb-2">
          {dayTitleLong(selectedDate)} · {dayPills.length} {taskPl(dayPills.length)}
        </p>
        {dayPills.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Brak zadań tego dnia.</p>}
        <div className="flex flex-col gap-2">
          {dayPills.map((pill) => {
            const hue = statusHue(pill.task.statusColor);
            return (
              <Link
                key={pill.key}
                href={`/w/${workspaceId}/t/${pill.task.id}`}
                data-ui="calendar-card"
                className="flex min-h-11 gap-2.5 rounded-lg border border-border bg-card p-3 outline-none hover:bg-row-hover active:bg-n-100 focus-visible:shadow-[var(--focus)]"
              >
                <span aria-hidden="true" className={cn("w-[3px] shrink-0 rounded-[1.5px]", barClass(hue))} />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium leading-[19px] text-foreground">{pill.label}</span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <span className="font-mono text-2xs text-fg-3">#{pill.task.displayId}</span>
                    {pill.task.statusName && <StatusChip label={pill.task.statusName} hue={hue} dot={false} size="sm" />}
                  </span>
                </span>
                {pill.task.assignees[0] && (
                  <Avatar name={pill.task.assignees[0].name} src={pill.task.assignees[0].avatarUrl} size={26} className="shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {canCreate && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card p-3">
          <QuickAddTask workspaceId={workspaceId} boardId={boardId} day={selected} size="lg" />
        </div>
      )}
    </div>
  );
}
