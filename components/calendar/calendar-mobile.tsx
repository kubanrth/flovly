"use client";

// Kalendarz <768px (B7-mobile). Dwa tryby (klient 2026-09-16: „widok kalendarza
// musi być pełniejszy"):
//   • Miesiąc — siatka z kropkami statusów + zadania wybranego dnia pod spodem,
//   • Agenda  — ciągła lista kolejnych dni z zadaniami, bez stukania w każdy
//               dzień osobno; to w niej widać plan na kilka tygodni naraz.
// Wybór trybu zostaje na urządzeniu (`ui:calendar-mobile-mode`).

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { taskPl } from "@/lib/pluralize";
import { useUiPref } from "@/hooks/use-ui-pref";
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

type Mode = "month" | "agenda";

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
  const [mode, setMode] = useUiPref<Mode>("ui:calendar-mobile-mode", "month");
  const days = monthGrid(focus);
  const todayKey = dayKey(new Date());
  const selectedDate = parseDayKey(selected);
  const dayPills = byDay.get(selected) ?? [];

  // Agenda leci od początku oglądanego miesiąca w przód — `dayKey` to
  // `YYYY-MM-DD`, więc porównanie i sortowanie tekstem są tu poprawne.
  const agenda = useMemo(() => {
    const from = dayKey(new Date(focus.getFullYear(), focus.getMonth(), 1));
    return [...byDay.entries()]
      .filter(([key, pills]) => key >= from && pills.length > 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 60);
  }, [byDay, focus]);

  return (
    <div data-ui="calendar-mobile" data-mode={mode} className="flex min-h-[calc(100dvh-140px)] flex-col bg-card pb-24">
      <div className="flex items-center gap-2 px-4 pt-2.5">
        <span className="text-lg font-semibold -tracking-[0.2px]">{monthTitle(focus)}</span>
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Poprzedni miesiąc"
            onClick={() => onFocus(addMonths(focus, -1))}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground outline-none hover:bg-n-100 active:bg-n-200 focus-visible:shadow-[var(--focus)]"
          >
            <IconChevronLeft width={13} height={13} strokeWidth={1.6} />
          </button>
          <button
            type="button"
            aria-label="Następny miesiąc"
            onClick={() => onFocus(addMonths(focus, 1))}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground outline-none hover:bg-n-100 active:bg-n-200 focus-visible:shadow-[var(--focus)]"
          >
            <IconChevronRight width={13} height={13} strokeWidth={1.6} />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="inline-flex h-9 items-center rounded-md border border-border px-2.5 text-xs font-medium text-foreground outline-none hover:bg-n-100 active:bg-n-200 focus-visible:shadow-[var(--focus)]"
          >
            Dzisiaj
          </button>
        </span>
      </div>

      <div data-ui="calendar-mode" role="radiogroup" aria-label="Tryb kalendarza" className="mx-4 mt-2.5 grid grid-cols-2 gap-0.5 rounded-md bg-n-100 p-0.5">
        {(["month", "agenda"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "inline-flex h-9 items-center justify-center rounded-sm text-sm font-medium outline-none",
              mode === m ? "bg-card text-foreground shadow-e1" : "text-n-600 active:bg-n-200",
            )}
          >
            {m === "month" ? "Miesiąc" : "Agenda"}
          </button>
        ))}
      </div>

      {mode === "month" ? (
        <>
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
                const dots = (byDay.get(key) ?? []).slice(0, 3);
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
                      // 40 px wysokości — w 32 px trudno było trafić palcem.
                      "relative min-h-10 rounded-md py-2 text-sm outline-none focus-visible:shadow-[var(--focus)]",
                      !inMonth && "text-n-400",
                      inMonth && weekend && "text-fg-3",
                      !isSelected && "hover:bg-n-100 active:bg-n-200",
                      !isSelected && key === todayKey && "font-semibold text-orange-700",
                      isSelected && "bg-n-900 font-semibold text-white",
                    )}
                  >
                    {date.getDate()}
                    {dots.length > 0 && (
                      <span aria-hidden="true" className="absolute inset-x-0 bottom-1 flex justify-center gap-0.5">
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
              {dayPills.map((pill) => <TaskCard key={pill.key} pill={pill} workspaceId={workspaceId} />)}
            </div>
          </div>
        </>
      ) : (
        <div data-ui="calendar-agenda" className="flex-1 px-4 py-3">
          {agenda.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Brak zadań od {monthTitle(focus).toLowerCase()}.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {agenda.map(([key, pills]) => (
                <section key={key} data-ui="agenda-day" data-day={key}>
                  <p className="mb-2 flex items-center gap-2">
                    <span className={cn("text-sm font-semibold", key === todayKey ? "text-orange-700" : "text-foreground")}>
                      {dayTitleLong(parseDayKey(key))}
                      {key === todayKey && " · dziś"}
                    </span>
                    <span className="font-mono text-2xs text-fg-3">{pills.length} {taskPl(pills.length)}</span>
                  </p>
                  <div className="flex flex-col gap-2">
                    {pills.map((pill) => <TaskCard key={pill.key} pill={pill} workspaceId={workspaceId} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {canCreate && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card p-3">
          <QuickAddTask workspaceId={workspaceId} boardId={boardId} day={mode === "month" ? selected : todayKey} size="lg" />
        </div>
      )}
    </div>
  );
}

function TaskCard({ pill, workspaceId }: { pill: TaskPill; workspaceId: string }) {
  const hue = statusHue(pill.task.statusColor);
  return (
    <Link
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
}
