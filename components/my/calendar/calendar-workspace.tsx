"use client";

// D4 Kalendarz osobisty: sidebar źródeł („Widoczne w kalendarzu"), nagłówek
// „Mój kalendarz" z ‹ zakres › + Dzisiaj + segmented Dzień/Tydzień/Miesiąc,
// siatka godzinowa (Dzień/Tydzień) albo istniejąca siatka miesiąca.

import { useMemo, useState, useSyncExternalStore } from "react";
import { useUiPref } from "@/hooks/use-ui-pref";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/ui/segmented";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";
import { WEEKDAYS, addMonths, dayKey, monthGrid, monthTitle } from "@/components/calendar/calendar-math";
import { CalendarMonthGrid, type CalendarEvent } from "./month-grid";
import { CalendarWorkspaceFilter } from "./workspace-filter";
import { SOURCE_DOT, WeekGrid } from "./week-grid";
import { addDays, isoWeek, layoutWeek, rangeLabel, timeLabel, weekDays, type WeekItem, type WeekSource } from "./week-math";

type ViewMode = "day" | "week" | "month";

const SOURCES: { id: WeekSource; label: string }[] = [
  { id: "tasks", label: "Terminy zadań" },
  { id: "reminders", label: "Przypomnienia" },
  { id: "vacations", label: "Urlopy zespołu" },
];

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: "day", label: "Dzień" },
  { value: "week", label: "Tydzień" },
  { value: "month", label: "Miesiąc" },
];

// Wspólny zegar minutowy — jedno źródło prawdy dla linii „teraz" i stopki.
let minute = new Date();
const minuteListeners = new Set<() => void>();
let minuteTimer: ReturnType<typeof setInterval> | null = null;

function subscribeMinute(onChange: () => void) {
  minuteListeners.add(onChange);
  minuteTimer ??= setInterval(() => {
    minute = new Date();
    for (const listener of minuteListeners) listener();
  }, 60_000);
  return () => {
    minuteListeners.delete(onChange);
    if (minuteListeners.size === 0 && minuteTimer) {
      clearInterval(minuteTimer);
      minuteTimer = null;
    }
  };
}
const getMinute = () => minute;

const sourceOf = (ev: CalendarEvent): WeekSource =>
  ev.kind === "vacation" ? "vacations" : ev.kind === "reminder" ? "reminders" : "tasks";

/** Etykieta w siatce godzinowej — makieta pisze „Termin: #253 …", „Przypomnienie: …". */
function weekTitle(ev: CalendarEvent): string {
  if (ev.kind === "vacation") return ev.title;
  if (ev.kind === "reminder") return `Przypomnienie: ${ev.title}`;
  return `Termin: ${ev.displayId ? `#${ev.displayId} ` : ""}${ev.title}`;
}

function hrefOf(ev: CalendarEvent): string | null {
  if (ev.kind === "vacation") return "/vacations";
  if (ev.kind === "reminder") return "/my/reminders";
  return `/w/${ev.workspaceId}/t/${ev.entityId ?? ev.id}`;
}

export function MyCalendarWorkspace({
  events,
  workspaces,
  selectedWorkspace,
}: {
  events: CalendarEvent[];
  workspaces: { id: string; name: string }[];
  selectedWorkspace: string;
}) {
  const [view, setView] = useUiPref<ViewMode>("ui:calendar-view", "week");
  const [hidden, setHidden] = useUiPref<WeekSource[]>("ui:calendar-sources", []);
  const [focus, setFocus] = useState(() => new Date());
  // Zegar tylko po stronie klienta (SSR = null), żeby linia „teraz" i stopka
  // nie różniły się o minutę między serwerem a hydracją.
  const now = useSyncExternalStore(subscribeMinute, getMinute, () => null);

  // localStorage może zwrócić cokolwiek — bez tej osłony zły wpis wywala stronę.
  const off = useMemo(() => (Array.isArray(hidden) ? hidden : []), [hidden]);
  const visible = useMemo(() => events.filter((ev) => !off.includes(sourceOf(ev))), [events, off]);

  const days = useMemo(() => {
    if (view === "month") return monthGrid(focus);
    if (view === "week") return weekDays(focus);
    return [new Date(focus.getFullYear(), focus.getMonth(), focus.getDate())];
  }, [view, focus]);

  const items = useMemo<WeekItem[]>(
    () =>
      visible.map((ev) => ({
        key: ev.id,
        source: sourceOf(ev),
        title: weekTitle(ev),
        startAt: ev.startAt,
        stopAt: ev.stopAt,
        href: hrefOf(ev),
      })),
    [visible],
  );
  const layout = useMemo(() => layoutWeek(items, days), [items, days]);

  const step = (dir: -1 | 1) =>
    setFocus((f) => (view === "month" ? addMonths(f, dir) : addDays(f, dir * (view === "week" ? 7 : 1))));

  const label = view === "month" ? monthTitle(focus) : rangeLabel(days);
  const stepLabel = view === "month" ? "miesiąc" : view === "week" ? "tydzień" : "dzień";
  const { tasks, reminders, vacations } = layout.counts;

  return (
    <div data-ui="calendar-view" className="flex min-h-0 flex-1">
      <aside
        data-ui="calendar-sidebar"
        className="w-60 flex-none overflow-y-auto border-r border-border bg-canvas p-2 max-md:hidden"
      >
        <div className="eyebrow flex h-[30px] items-end px-2">Widoczne w kalendarzu</div>
        {SOURCES.map((source) => {
          const on = !off.includes(source.id);
          return (
            <label
              key={source.id}
              className="flex h-[30px] cursor-pointer items-center gap-2 rounded-md px-2 outline-none hover:bg-n-100 active:bg-n-200"
            >
              <Checkbox
                size="sm"
                checked={on}
                ariaLabel={source.label}
                onCheckedChange={() =>
                  setHidden(on ? [...off, source.id] : off.filter((s) => s !== source.id))
                }
              />
              <span aria-hidden="true" className={cn("size-2 rounded-[2px]", SOURCE_DOT[source.id])} />
              <span className={cn("flex-1 text-xs", !on && "text-muted-foreground")}>{source.label}</span>
            </label>
          );
        })}

        <div className="eyebrow mt-1.5 flex h-[30px] items-end px-2">Przestrzeń</div>
        <div className="px-2 pt-1">
          <CalendarWorkspaceFilter workspaces={workspaces} selected={selectedWorkspace} />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
        <div className="flex flex-none items-center gap-2 border-b border-border px-8 pb-2.5 pt-3.5 max-md:px-4">
          <h1 className="text-lg font-semibold tracking-[-0.2px]">Mój kalendarz</h1>
          <Button
            variant="secondary"
            size="sm"
            iconOnly
            className="ml-2"
            aria-label={`Poprzedni ${stepLabel}`}
            onClick={() => step(-1)}
          >
            <IconChevronLeft width={13} height={13} strokeWidth={1.6} />
          </Button>
          <span className="min-w-[180px] text-center text-base font-semibold">{label}</span>
          <Button variant="secondary" size="sm" iconOnly aria-label={`Następny ${stepLabel}`} onClick={() => step(1)}>
            <IconChevronRight width={13} height={13} strokeWidth={1.6} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setFocus(new Date())}>
            Dzisiaj
          </Button>
          <span className="flex-1" />
          <Segmented aria-label="Zakres kalendarza" options={VIEWS} value={view} onChange={setView} />
        </div>

        {view === "month" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4 max-md:px-4">
            <CalendarMonthGrid events={visible} focus={focus} hideNav />
          </div>
        ) : (
          <WeekGrid days={days} layout={layout} todayKey={dayKey(new Date())} now={now} />
        )}

        <div className="flex h-8 flex-none items-center border-t border-border bg-canvas px-8 max-md:px-4">
          <span className="font-mono text-2xs text-fg-2">
            {view === "month" ? monthTitle(focus).toLowerCase() : `tydzień ${isoWeek(focus)}`} ·{" "}
            {tasks} {plPlural(tasks, "termin", "terminy", "terminów")} · {reminders}{" "}
            {plPlural(reminders, "przypomnienie", "przypomnienia", "przypomnień")} · {vacations}{" "}
            {plPlural(vacations, "urlop", "urlopy", "urlopów")}
          </span>
          <span className="flex-1" />
          <span className="font-mono text-2xs text-fg-3">
            {now ? `teraz: ${WEEKDAYS[(now.getDay() + 6) % 7]!.toLowerCase()} ${timeLabel(now)}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
