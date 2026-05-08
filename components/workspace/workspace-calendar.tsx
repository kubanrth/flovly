"use client";

import { startTransition, useState } from "react";
import { Calendar as CalendarIcon, Clock, Pencil, Plus, Trash2, User as UserIcon, X } from "lucide-react";
import {
  createWorkspaceEventAction,
  deleteWorkspaceEventAction,
  updateWorkspaceEventAction,
} from "@/app/(app)/w/[workspaceId]/calendar/actions";
import {
  CalendarMonthGrid,
  type CalendarEvent,
} from "@/components/my/calendar/month-grid";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Checkbox } from "@/components/ui/checkbox";

export interface WorkspaceCalendarTask {
  id: string;
  title: string;
  startAt: string | null;
  stopAt: string | null;
  statusName: string | null;
  statusColor: string | null;
  boardName: string;
}

export interface WorkspaceCalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
  creatorName: string;
}

// F12-K36: paleta z `lib/colors.ts` (BRAND_PALETTE).
import { EVENT_PALETTE as PALETTE } from "@/lib/colors";

export function WorkspaceCalendar({
  workspaceId,
  tasks,
  events,
}: {
  workspaceId: string;
  tasks: WorkspaceCalendarTask[];
  events: WorkspaceCalendarEvent[];
}) {
  const [showEventForm, setShowEventForm] = useState(false);
  // F12-K31: klik w event w gridzie otwiera dialog ze szczegółami zamiast
  // próbować nawigować do /t/event:<id> (wcześniej 404).
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  // Merge tasks + events into a single CalendarEvent list for MonthGrid.
  // F12-K31: id pola dalej używa prefixu (żeby unikać kolizji w
  // wewnętrznym keyu MonthGrid'a), ale entityId zawiera RAW id i
  // MonthGrid linkuje/callbackuje po entityId.
  const merged: CalendarEvent[] = [
    ...tasks.map((t) => ({
      id: `task:${t.id}`,
      entityId: t.id,
      kind: "task" as const,
      title: t.title,
      workspaceId,
      workspaceName: t.boardName,
      boardName: t.boardName,
      statusColor: t.statusColor,
      startAt: t.startAt,
      stopAt: t.stopAt,
    })),
    ...events.map((e) => ({
      id: `event:${e.id}`,
      entityId: e.id,
      kind: "event" as const,
      title: `📅 ${e.title}`,
      workspaceId,
      workspaceName: "Wydarzenie",
      boardName: e.creatorName,
      statusColor: e.color,
      startAt: e.startAt,
      stopAt: e.endAt,
    })),
  ];

  const openEvent = openEventId
    ? events.find((e) => e.id === openEventId) ?? null
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowEventForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-gradient px-3 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
        >
          <Plus size={13} /> {showEventForm ? "Zwiń" : "Nowe wydarzenie"}
        </button>
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
          {tasks.length} zadań · {events.length} wydarzeń
        </span>
      </div>

      {showEventForm && (
        <NewEventForm
          workspaceId={workspaceId}
          onDone={() => setShowEventForm(false)}
        />
      )}

      <CalendarMonthGrid
        events={merged}
        onEventClick={(id) => setOpenEventId(id)}
      />

      {events.length > 0 && (
        <EventsList events={events} onOpen={setOpenEventId} />
      )}

      {openEvent && (
        <EventDetailDialog
          event={openEvent}
          onClose={() => setOpenEventId(null)}
        />
      )}
    </div>
  );
}

// F12-K31 + F12-K55: dialog ze szczegółami wydarzenia.
// View mode (default) → przycisk Edytuj przełącza na inline form
// (title, description, start/end, allDay, color). Submit → updateWorkspaceEventAction
// → revalidate. Tylko creator widzi guziki edit/delete (sprawdzane
// dodatkowo server-side).
function EventDetailDialog({
  event,
  onClose,
}: {
  event: WorkspaceCalendarEvent;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <EditEventForm event={event} onCancel={() => setEditing(false)} onSaved={onClose} />
    );
  }
  const dateRange = formatRange(event.startAt, event.endAt, event.allDay);
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        // Click on backdrop closes; clicks inside content stop propagation.
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm"
    >
      <div
        className="relative flex w-[min(520px,100%)] flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-[0_24px_48px_-12px_rgba(10,10,40,0.35)]"
        style={{ borderTop: `4px solid ${event.color}` }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={14} />
        </button>

        <div className="flex flex-col gap-1.5">
          <span className="eyebrow inline-flex items-center gap-1.5">
            <CalendarIcon size={11} />
            Wydarzenie
          </span>
          <h2 className="font-display text-[1.4rem] font-bold leading-tight tracking-[-0.02em]">
            {event.title}
          </h2>
        </div>

        <div className="flex flex-col gap-2 text-[0.86rem]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={13} className="shrink-0" />
            <span>{dateRange}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <UserIcon size={13} className="shrink-0" />
            <span>{event.creatorName}</span>
          </div>
        </div>

        {event.description && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Opis
            </span>
            <p className="whitespace-pre-wrap text-[0.9rem] leading-relaxed text-foreground">
              {event.description}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            <Pencil size={12} /> Edytuj
          </button>
          <form
            action={(fd) =>
              startTransition(async () => {
                await deleteWorkspaceEventAction(fd);
                onClose();
              })
            }
            onSubmit={(e) => {
              if (!confirm("Usunąć to wydarzenie?")) e.preventDefault();
            }}
            className="m-0"
          >
            <input type="hidden" name="id" value={event.id} />
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
            >
              <Trash2 size={12} /> Usuń
            </button>
          </form>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md bg-brand-gradient px-4 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}

// F12-K55: form edycji istniejącego wydarzenia. Inline w EventDetailDialog
// — toggle widoku z view mode na edit, te same pola co w NewEventForm
// (poniżej, F12-K31), tylko dispatching do updateWorkspaceEventAction.
function EditEventForm({
  event,
  onCancel,
  onSaved,
}: {
  event: WorkspaceCalendarEvent;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [allDay, setAllDay] = useState(event.allDay);
  const [color, setColor] = useState(event.color);
  const [startAt, setStartAt] = useState<string | null>(event.startAt);
  const [endAt, setEndAt] = useState<string | null>(event.endAt);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm"
    >
      <form
        action={(fd) =>
          startTransition(async () => {
            await updateWorkspaceEventAction(fd);
            onSaved();
          })
        }
        className="relative flex w-[min(560px,100%)] flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-[0_24px_48px_-12px_rgba(10,10,40,0.35)]"
        style={{ borderTop: `4px solid ${color}` }}
      >
        <input type="hidden" name="id" value={event.id} />
        <input type="hidden" name="color" value={color} />
        {startAt && <input type="hidden" name="startAt" value={startAt} />}
        {endAt && <input type="hidden" name="endAt" value={endAt} />}
        {allDay && <input type="hidden" name="allDay" value="on" />}

        <button
          type="button"
          onClick={onCancel}
          aria-label="Anuluj"
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={14} />
        </button>

        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Edycja wydarzenia</span>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            Tytuł *
          </span>
          <input
            name="title"
            type="text"
            required
            maxLength={200}
            defaultValue={event.title}
            className="h-9 rounded-md border border-border bg-background px-3 text-[0.92rem] outline-none focus:border-primary"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Start
            </span>
            <DateTimePicker
              name="_startAt_picker"
              defaultValue={event.startAt}
              onChange={setStartAt}
              label="Data startu"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Koniec
            </span>
            <DateTimePicker
              name="_endAt_picker"
              defaultValue={event.endAt}
              onChange={setEndAt}
              label="Data końca"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-[0.86rem]">
          <Checkbox
            ariaLabel="Cały dzień"
            checked={allDay}
            onChange={(e) => setAllDay(e.currentTarget.checked)}
          />
          <span>Cały dzień (ignoruje godziny)</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            Opis
          </span>
          <textarea
            name="description"
            rows={3}
            maxLength={2000}
            defaultValue={event.description ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2 text-[0.9rem] leading-relaxed outline-none focus:border-primary"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            Kolor
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Wybierz kolor ${c}`}
                data-active={color === c ? "true" : "false"}
                className="h-7 w-7 rounded-md ring-2 ring-transparent transition-all data-[active=true]:ring-primary"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Anuluj
          </button>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md bg-brand-gradient px-4 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
          >
            Zapisz zmiany
          </button>
        </div>
      </form>
    </div>
  );
}

function formatRange(startISO: string, endISO: string, allDay: boolean): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const dateOpts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  if (allDay) {
    return sameDay
      ? `${start.toLocaleDateString("pl-PL", dateOpts)} · cały dzień`
      : `${start.toLocaleDateString("pl-PL", dateOpts)} – ${end.toLocaleDateString("pl-PL", dateOpts)} · cały dzień`;
  }
  if (sameDay) {
    return `${start.toLocaleDateString("pl-PL", dateOpts)} · ${start.toLocaleTimeString("pl-PL", timeOpts)} – ${end.toLocaleTimeString("pl-PL", timeOpts)}`;
  }
  return `${start.toLocaleString("pl-PL", { ...dateOpts, ...timeOpts })} – ${end.toLocaleString("pl-PL", { ...dateOpts, ...timeOpts })}`;
}

function NewEventForm({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
  const [color, setColor] = useState(PALETTE[0]);
  const [allDay, setAllDay] = useState(false);
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          await createWorkspaceEventAction(fd);
          onDone();
        })
      }
      className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="color" value={color} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-col gap-1">
          <span className="eyebrow">Tytuł</span>
          <input
            name="title"
            required
            autoFocus
            maxLength={200}
            placeholder="np. Spotkanie z klientem"
            className="h-9 rounded-md border border-border bg-background px-2 text-[0.88rem] outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Start</span>
          <DateTimePicker
            name="startAt"
            defaultValue={null}
            placeholder="Wybierz start"
            label="Start wydarzenia"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Koniec</span>
          <DateTimePicker
            name="endAt"
            defaultValue={null}
            placeholder="Wybierz koniec"
            label="Koniec wydarzenia"
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-[0.84rem] text-muted-foreground">
          <Checkbox
            name="allDay"
            checked={allDay}
            ariaLabel="Cały dzień"
            onChange={(e) => setAllDay(e.target.checked)}
          />
          cały dzień
        </label>
      </div>
      <div className="flex flex-col gap-1">
        <span className="eyebrow">Opis (opcjonalny)</span>
        <textarea
          name="description"
          rows={2}
          maxLength={2000}
          className="resize-none rounded-md border border-border bg-background p-2 text-[0.86rem] outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="eyebrow mr-2">Kolor:</span>
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Kolor ${c}`}
            className="h-5 w-5 rounded-full ring-1 ring-foreground/10 transition-transform hover:scale-110"
            style={{
              background: c,
              outline: color === c ? "2px solid var(--foreground)" : "none",
              outlineOffset: color === c ? 2 : 0,
            }}
          />
        ))}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          Anuluj
        </button>
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90"
        >
          Utwórz wydarzenie
        </button>
      </div>
    </form>
  );
}

function EventsList({
  events,
  onOpen,
}: {
  events: WorkspaceCalendarEvent[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow text-primary">Nadchodzące wydarzenia</h2>
      <ul className="flex flex-col gap-1.5">
        {events.map((e) => (
          <EventRow key={e.id} event={e} onOpen={() => onOpen(e.id)} />
        ))}
      </ul>
    </section>
  );
}

function EventRow({
  event,
  onOpen,
}: {
  event: WorkspaceCalendarEvent;
  onOpen: () => void;
}) {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-primary/40">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white"
        style={{ background: event.color }}
        aria-hidden
      >
        <CalendarIcon size={14} />
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col items-start text-left"
      >
        <span className="truncate font-display text-[0.92rem] font-semibold leading-tight tracking-[-0.01em] transition-colors group-hover:text-primary">
          {event.title}
        </span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
          {event.allDay
            ? `${start.toLocaleDateString("pl-PL")} (cały dzień)`
            : `${start.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })} → ${end.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`}
          {" · "}
          {event.creatorName}
        </span>
      </button>
      <form
        action={(fd) =>
          startTransition(async () => {
            if (!confirm(`Usunąć "${event.title}"?`)) return;
            await deleteWorkspaceEventAction(fd);
          })
        }
        className="m-0"
      >
        <input type="hidden" name="id" value={event.id} />
        <button
          type="submit"
          aria-label="Usuń"
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={13} />
        </button>
      </form>
    </li>
  );
}
