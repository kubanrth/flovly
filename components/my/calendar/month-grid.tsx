"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  WEEKDAYS,
  addMonths,
  dayKey,
  dayTitleLong,
  monthGrid,
  monthTitle,
} from "@/components/calendar/calendar-math";
import { Button } from "@/components/ui/button";
import { CHIP_HUE, type ChipHue } from "@/components/ui/chip";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/icons";
import { hueForColor } from "@/components/ui/status-hue";
import { cn } from "@/lib/utils";

export interface CalendarEvent {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
  boardName: string;
  statusColor: string | null;
  startAt: string | null;
  stopAt: string | null;
  // Kalendarz workspace'u miesza taski + custom WorkspaceEvent.
  // Klik tasku → nav do /t/<id> (Link). Klik eventu → callback (parent
  // otwiera dialog ze szczegółami). Klik urlopu → nav do /vacations.
  // Default = "task" żeby /my/calendar nie musiał ustawiać niczego.
  kind?: "task" | "event" | "vacation" | "reminder";
  // Raw entity id bez prefixu (poprzednie kody używały prefiksu
  // "task:<id>" / "event:<id>" w polu `id`, co rozwalało route'y bo
  // /t/task:<id> nie istnieje). To pole dostaje czysty id encji.
  entityId?: string;
  // #ID zadania — używane w etykietach siatki godzinowej (D4).
  displayId?: number;
}

// Bez `statusColor` kolor bierze się z rodzaju wpisu — te same barwy co
// legenda „Widoczne w kalendarzu": termin niebieski, przypomnienie żółte,
// urlop zielony.
const KIND_HUE: Record<NonNullable<CalendarEvent["kind"]>, ChipHue> = {
  task: "blue",
  event: "purple",
  vacation: "green",
  reminder: "yellow",
};

const BAR: Record<ChipHue, string> = {
  gray: "bg-n-500", orange: "bg-orange-600", red: "bg-danger", yellow: "bg-warning", green: "bg-success", teal: "bg-chip-teal-fg",
  blue: "bg-info", indigo: "bg-chip-indigo-fg", purple: "bg-chip-purple-fg", pink: "bg-chip-pink-fg", brown: "bg-chip-brown-fg", black: "bg-n-400",
};

const hueOf = (ev: CalendarEvent): ChipHue =>
  ev.statusColor ? hueForColor(ev.statusColor) : KIND_HUE[ev.kind ?? "task"];

const MAX_PILLS = 3;

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// For an event with start & stop, return TRUE if given `day` falls in the
// inclusive range. Events with only stopAt (a deadline) render on stop day.
function eventSpansDay(ev: CalendarEvent, day: Date): boolean {
  const startRaw = ev.startAt ? new Date(ev.startAt) : null;
  const stopRaw = ev.stopAt ? new Date(ev.stopAt) : null;
  if (!startRaw && !stopRaw) return false;
  if (startRaw && stopRaw) {
    const start = dayKey(startRaw);
    const stop = dayKey(stopRaw);
    const d = dayKey(day);
    return d >= start && d <= stop;
  }
  return sameDay((stopRaw ?? startRaw)!, day);
}

export function CalendarMonthGrid({
  events,
  onEventClick,
  focus,
  hideNav,
}: {
  events: CalendarEvent[];
  // Parent może obsłużyć klik w event-kind (dialog ze
  // szczegółami WorkspaceEvent'u). Task-kind dalej linkuje przez <Link>.
  onEventClick?: (entityId: string) => void;
  // Sterowanie z zewnątrz (D4: wspólne ‹ zakres › w nagłówku strony).
  focus?: Date;
  hideNav?: boolean;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(today);
  const month = focus ?? cursor;
  const cells = useMemo(() => monthGrid(month), [month]);
  // Expand-day modal state — gdy user klika „+N więcej" na komórce dnia,
  // pokazujemy pełną listę wszystkich wydarzeń tego dnia.
  const [expandedDay, setExpandedDay] = useState<{ date: Date; events: CalendarEvent[] } | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {!hideNav && (
        <div className="flex items-center gap-2">
          <span className="min-w-[150px] text-md font-semibold">{monthTitle(month)}</span>
          <Button variant="secondary" size="sm" iconOnly aria-label="Poprzedni miesiąc" onClick={() => setCursor(addMonths(month, -1))}>
            <IconChevronLeft width={13} height={13} strokeWidth={1.6} />
          </Button>
          <Button variant="secondary" size="sm" iconOnly aria-label="Następny miesiąc" onClick={() => setCursor(addMonths(month, 1))}>
            <IconChevronRight width={13} height={13} strokeWidth={1.6} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>Dzisiaj</Button>
        </div>
      )}

      <div
        data-ui="calendar-grid"
        className="grid grid-cols-7 overflow-hidden rounded-sm border border-border bg-card"
        style={{ gridTemplateRows: `32px repeat(${cells.length / 7}, minmax(88px, 1fr))` }}
      >
        {WEEKDAYS.map((name, i) => (
          <div
            key={name}
            className={cn(
              "eyebrow flex items-center border-b border-border px-2.5",
              i < 6 && "border-r border-table-grid",
              i >= 5 ? "bg-canvas text-fg-3" : "text-fg-2",
            )}
          >
            {name}
          </div>
        ))}

        {cells.map((date, i) => {
          const key = dayKey(date);
          const inMonth = date.getMonth() === month.getMonth();
          const weekend = i % 7 >= 5;
          const isToday = sameDay(date, today);
          const dayEvents = events.filter((e) => eventSpansDay(e, date));
          const shown = dayEvents.slice(0, MAX_PILLS);
          const overflow = dayEvents.length - shown.length;

          return (
            <div
              key={key}
              data-ui="calendar-day"
              data-day={key}
              data-today={isToday || undefined}
              className={cn(
                "flex min-w-0 flex-col gap-[3px] overflow-hidden px-1.5 py-1",
                i % 7 !== 6 && "border-r border-table-grid",
                i < cells.length - 7 && "border-b border-table-grid",
                weekend && "bg-canvas",
                isToday && "bg-selected shadow-[inset_0_0_0_1px_var(--orange-500)]",
              )}
            >
              <span
                className={cn(
                  "self-start text-xs leading-[18px]",
                  !inMonth && "text-n-400",
                  inMonth && weekend && "text-fg-3",
                  inMonth && !weekend && "font-medium",
                  isToday && "font-semibold text-orange-700",
                )}
              >
                {date.getDate()}
              </span>

              {shown.map((ev) => (
                <EventPill key={ev.id} ev={ev} onEventClick={onEventClick} />
              ))}

              {overflow > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandedDay({ date, events: dayEvents })}
                  className="self-start rounded-sm text-2xs font-medium text-orange-700 outline-none hover:text-orange-800 hover:underline active:text-orange-900 focus-visible:shadow-[var(--focus)]"
                >
                  +{overflow} więcej
                </button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={expandedDay !== null} onOpenChange={(open) => !open && setExpandedDay(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="capitalize">{expandedDay ? dayTitleLong(expandedDay.date) : ""}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-1">
            {expandedDay?.events.map((ev) => (
              <EventPill
                key={ev.id}
                ev={ev}
                full
                onEventClick={(id) => {
                  setExpandedDay(null);
                  onEventClick?.(id);
                }}
              />
            ))}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventPill({
  ev,
  full,
  onEventClick,
}: {
  ev: CalendarEvent;
  full?: boolean;
  onEventClick?: (entityId: string) => void;
}) {
  const hue = hueOf(ev);
  // Defensive: strip "task:" / "event:" prefix from legacy ids.
  const rawId = ev.entityId ?? ev.id.replace(/^(task|event|vacation|reminder):/, "");
  const title = `${ev.title}${ev.kind === "vacation" ? "" : ` — ${ev.workspaceName} / ${ev.boardName}`}`;
  const className = cn(
    "flex shrink-0 items-center gap-[5px] overflow-hidden rounded-sm px-1.5 outline-none transition-opacity duration-[120ms] ease-[var(--ease-out)] hover:opacity-80 active:opacity-70 focus-visible:shadow-[var(--focus)] motion-reduce:transition-none",
    CHIP_HUE[hue],
    full ? "h-7" : "h-5",
  );
  const body = (
    <>
      <span aria-hidden="true" className={cn("h-3 w-[3px] shrink-0 rounded-[1px]", BAR[hue])} />
      <span className="truncate text-2xs font-medium">{ev.title}</span>
    </>
  );

  if (ev.kind === "vacation") {
    return (
      <Link href="/vacations" title={title} className={className}>
        {body}
      </Link>
    );
  }
  if (ev.kind === "reminder") {
    return (
      <Link href="/my/reminders" title={title} className={className}>
        {body}
      </Link>
    );
  }
  if (ev.kind === "event") {
    return (
      <button type="button" onClick={() => onEventClick?.(rawId)} title={title} className={className}>
        {body}
      </button>
    );
  }
  return (
    <Link href={`/w/${ev.workspaceId}/t/${rawId}`} title={title} className={className}>
      {body}
    </Link>
  );
}
