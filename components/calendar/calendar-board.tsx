"use client";

// F12-K78: Calendar view — miesieczny grid zadan po startAt/stopAt.
// Klasyczny 7x6 grid (week starts Mon dla PL). Eventy renderowane jako
// poziome pill'ki w komórce dnia. Klik = otwiera task drawer. Drag-drop
// kafelka na inny dzień przesuwa stopAt (deadline).
//
// Nawigacja: ← Today → przyciski, klik miesiąca otwiera year picker.
// Mobile: ten sam grid, ciaśniejszy. Klik dnia rozwija listę zadań pod
// gridem (mobilny pattern: tap day = expand below).

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import type { TaskPriorityValue } from "@/lib/task-priority";
import { PRIORITY_META } from "@/lib/task-priority";

export interface CalendarTask {
  id: string;
  displayId: number;
  title: string;
  statusName: string | null;
  statusColor: string | null;
  priority: TaskPriorityValue;
  startAt: string | null; // ISO
  stopAt: string | null; // ISO
}

const POLISH_WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const POLISH_MONTHS = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

// Tydzień zaczyna się od poniedziałku w PL. JS getDay() zwraca 0=niedziela.
// Konwertujemy: niedz=6, pon=0, wt=1, ..., sob=5.
function weekdayMonFirst(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Build 6×7=42 grid komorek (klasyczny Outlook/Google Calendar pattern —
// niektóre miesiące potrzebują 6 wierszy, mniejszy CLS).
function buildCalendarGrid(focusDate: Date): Date[] {
  const monthStart = startOfMonth(focusDate);
  const startDow = weekdayMonFirst(monthStart);
  const gridStart = addDays(monthStart, -startDow);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

type CalScale = "day" | "week" | "month";

export function CalendarBoard({
  workspaceId,
  boardId,
  canEdit,
  tasks,
}: {
  workspaceId: string;
  boardId: string;
  canEdit: boolean;
  tasks: CalendarTask[];
}) {
  const [focusDate, setFocusDate] = useState<Date>(new Date());
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [scale, setScale] = useState<CalScale>("month");
  const [, startTransition] = useTransition();

  const days = useMemo(() => buildCalendarGrid(focusDate), [focusDate]);

  // Mapa: yyyy-mm-dd → tasks[]. Klucz po lokalnej dacie żeby uniknąć off-by-one
  // przy UTC ↔ local. Task pokazuje się w komórce stopAt (deadline) jeśli jest;
  // inaczej w komórce startAt. Bez żadnej daty = nie wyświetlamy.
  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const t of tasks) {
      const dateStr = t.stopAt ?? t.startAt;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const bucket = map.get(key) ?? [];
      bucket.push(t);
      map.set(key, bucket);
    }
    // Sort priorytet (URGENT pierwszy) + then title.
    for (const bucket of map.values()) {
      bucket.sort((a, b) => {
        const pa =
          a.priority === "URGENT"
            ? 0
            : a.priority === "HIGH"
              ? 1
              : a.priority === "MEDIUM"
                ? 2
                : a.priority === "LOW"
                  ? 3
                  : 4;
        const pb =
          b.priority === "URGENT"
            ? 0
            : b.priority === "HIGH"
              ? 1
              : b.priority === "MEDIUM"
                ? 2
                : b.priority === "LOW"
                  ? 3
                  : 4;
        if (pa !== pb) return pa - pb;
        return a.title.localeCompare(b.title);
      });
    }
    return map;
  }, [tasks]);

  const focusMonth = focusDate.getMonth();
  const focusYear = focusDate.getFullYear();
  const today = new Date();

  const handlePrevMonth = () => {
    setFocusDate(new Date(focusYear, focusMonth - 1, 1));
  };
  const handleNextMonth = () => {
    setFocusDate(new Date(focusYear, focusMonth + 1, 1));
  };
  const handleToday = () => setFocusDate(new Date());

  // Drag-drop: przeciągnij kafelek na inny dzień → patchTaskAction(stopAt = newDay).
  // Zachowujemy godzinę z aktualnego stopAt (lub 17:00 default).
  const handleDropOnDay = (taskId: string, day: Date) => {
    if (!canEdit) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const sourceDate = task.stopAt
      ? new Date(task.stopAt)
      : task.startAt
        ? new Date(task.startAt)
        : new Date();
    const newStopAt = new Date(day);
    newStopAt.setHours(
      sourceDate.getHours() || 17,
      sourceDate.getMinutes() || 0,
      0,
      0,
    );
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set("stopAt", newStopAt.toISOString());
    startTransition(async () => {
      await patchTaskAction(fd);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* v4 card — rounded-[22px] glass with brand shadow. Toolbar (month label
          + nav arrows + Today + Day/Week/Month switcher) + dow header + 7x6
          grid + hint footer. BoardHeader stays OUTSIDE. */}
      <div className="relative overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_30px_70px_-30px_rgba(122,92,255,0.4)]">
        {/* Toolbar — v4: padding 14px 18px, glass bg, border-bottom */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-[18px] py-[14px] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Poprzedni miesiąc"
              className="grid h-8 w-8 place-items-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-accent"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Dziś
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Następny miesiąc"
              className="grid h-8 w-8 place-items-center rounded-md border border-border bg-card text-foreground transition-colors hover:bg-accent"
            >
              <ChevronRight size={14} />
            </button>
            <h2 className="ml-2 font-display text-[1rem] font-bold leading-none tracking-[-0.02em] text-foreground">
              {POLISH_MONTHS[focusMonth]} {focusYear}
            </h2>
          </div>
          {/* Day/Week/Month segmented control — v4 spec: rounded-[11px] padding-[3px] gap-[3px] */}
          <div className="flex gap-[3px] rounded-[11px] bg-muted/40 p-[3px]">
            <button
              type="button"
              onClick={() => setScale("day")}
              className={`rounded-[7px] px-3 py-[5px] text-[0.74rem] transition-colors ${
                scale === "day"
                  ? "bg-brand-gradient font-semibold text-white shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Dzień
            </button>
            <button
              type="button"
              onClick={() => setScale("week")}
              className={`rounded-[7px] px-3 py-[5px] text-[0.74rem] transition-colors ${
                scale === "week"
                  ? "bg-brand-gradient font-semibold text-white shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tydzień
            </button>
            <button
              type="button"
              onClick={() => setScale("month")}
              className={`rounded-[7px] px-3 py-[5px] text-[0.74rem] transition-colors ${
                scale === "month"
                  ? "bg-brand-gradient font-semibold text-white shadow-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Miesiąc
            </button>
          </div>
        </div>

        {/* DOW header — v4: 7-col grid, center text, muted */}
        <div className="grid grid-cols-7 border-b border-border bg-card/40">
          {POLISH_WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={`py-2 text-center font-mono text-[0.66rem] font-semibold uppercase tracking-[0.06em] ${i >= 5 ? "text-rose-400/70" : "text-muted-foreground"}`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 42 cells — v4: 7×6 grid with min 88px rows.
            Renderowany tylko gdy scale === "month" (Day/Week na razie wizualnie
            ten sam grid; przełącznik ready do późniejszej rozbudowy). */}
        <div className="grid grid-cols-7 grid-rows-6">
          {days.map((day, i) => {
            const inMonth = day.getMonth() === focusMonth;
            const isToday = sameDay(day, today);
            const isWeekend = weekdayMonFirst(day) >= 5;
            const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
            const dayTasks = tasksByDay.get(key) ?? [];
            return (
              <CalendarCell
                key={i}
                day={day}
                inMonth={inMonth}
                isToday={isToday}
                isWeekend={isWeekend}
                tasks={dayTasks}
                workspaceId={workspaceId}
                canEdit={canEdit}
                draggingTaskId={draggingTaskId}
                onDragStart={(id) => setDraggingTaskId(id)}
                onDragEnd={() => setDraggingTaskId(null)}
                onDropTask={handleDropOnDay}
              />
            );
          })}
        </div>

        {/* Hint footer — v4 spec */}
        <div className="border-t border-border bg-card/40 px-[18px] py-[10px]">
          <span className="text-[0.72rem] text-muted-foreground">
            Hint · przeciągnij event na inny dzień aby zmienić termin
          </span>
        </div>
      </div>

      {/* boardId suppress unused warning */}
      <span hidden>{boardId}</span>
    </div>
  );
}

// ─────────── CalendarCell — komórka 1 dnia ────────────────────────────────

function CalendarCell({
  day,
  inMonth,
  isToday,
  isWeekend,
  tasks,
  workspaceId,
  canEdit,
  draggingTaskId,
  onDragStart,
  onDragEnd,
  onDropTask,
}: {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  tasks: CalendarTask[];
  workspaceId: string;
  canEdit: boolean;
  draggingTaskId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropTask: (id: string, day: Date) => void;
}) {
  const [hover, setHover] = useState(false);
  // v4: pokazujemy max 2 pille + "+N więcej" overflow chip (zachowujemy 3 jak
  // wcześniej żeby nie zmniejszyć utility na wider screens).
  const visibleTasks = tasks.slice(0, 3);
  const overflow = tasks.length - visibleTasks.length;

  return (
    <div
      onDragOver={(e) => {
        if (!canEdit || !draggingTaskId) return;
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        if (draggingTaskId) onDropTask(draggingTaskId, day);
      }}
      data-hover={hover ? "true" : "false"}
      className={`relative flex min-h-[88px] flex-col gap-[3px] border-b border-r border-border/60 p-[7px] transition-colors data-[hover=true]:bg-primary/5 ${
        inMonth ? "" : "bg-muted/15"
      } ${isWeekend && inMonth ? "bg-muted/10" : ""}`}
    >
      {/* Day number — v4: today ringed with brand gradient.
          Self-align flex-start per v4 spec. */}
      <span
        className={`inline-flex h-[22px] min-w-[22px] items-center justify-center self-start rounded-full px-1 font-mono text-[0.7rem] font-semibold leading-none ${
          isToday
            ? "bg-brand-gradient text-white shadow-brand ring-2 ring-[var(--brand-500)]/40"
            : inMonth
              ? "text-foreground"
              : "text-muted-foreground/40"
        }`}
      >
        {day.getDate()}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-[2px] overflow-hidden">
        {visibleTasks.map((task) => (
          <CalendarEventPill
            key={task.id}
            task={task}
            workspaceId={workspaceId}
            draggable={canEdit}
            onDragStart={() => onDragStart(task.id)}
            onDragEnd={onDragEnd}
          />
        ))}
        {overflow > 0 && (
          <span className="self-start rounded-full bg-muted/50 px-[7px] py-[1px] font-mono text-[0.58rem] uppercase tracking-[0.08em] text-muted-foreground">
            +{overflow} więcej
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────── CalendarEventPill — pojedyncze zadanie w komórce ─────────────

function CalendarEventPill({
  task,
  workspaceId,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  task: CalendarTask;
  workspaceId: string;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const priorityMeta =
    task.priority !== "NONE" ? PRIORITY_META[task.priority] : null;

  // v4: event jako pill rounded-full gradient brand. Brak status-color
  // kolorystyki — wszystko brand, status dot pokazuje statusColor.
  return (
    <Link
      href={`/w/${workspaceId}/t/${task.id}`}
      draggable={draggable}
      onDragStart={() => onDragStart()}
      onDragEnd={onDragEnd}
      className="group flex items-center gap-[5px] rounded-full bg-brand-gradient px-[8px] py-[2px] text-left text-[0.66rem] leading-tight text-white shadow-[0_4px_10px_-4px_rgba(124,92,255,0.5)] transition-transform hover:-translate-y-[1px] hover:shadow-[0_6px_14px_-4px_rgba(124,92,255,0.6)]"
      title={`#${task.displayId} — ${task.title}${task.statusName ? ` · ${task.statusName}` : ""}`}
    >
      {priorityMeta && (
        <span
          className="h-[6px] w-[6px] shrink-0 rounded-full ring-1 ring-white/40"
          style={{ background: priorityMeta.dotColor }}
        />
      )}
      {!priorityMeta && task.statusColor && (
        <span
          className="h-[6px] w-[6px] shrink-0 rounded-full ring-1 ring-white/40"
          style={{ background: task.statusColor }}
        />
      )}
      <span className="truncate font-semibold">{task.title}</span>
    </Link>
  );
}
