"use client";

// E2 „Czas pracy" — kafle KPI, siatka osoba × Pon–Pt z chipami wpisów i lista
// wpisów wybranego dnia. Cała arytmetyka tygodnia siedzi w ./time-math.ts.

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveTimeEntryAction,
  createTimeEntryAction,
  deleteTimeEntryAction,
  type CreateTimeEntryState,
} from "@/app/(app)/w/[workspaceId]/time/actions";
import { pauseTaskTimerAction } from "@/app/(app)/w/[workspaceId]/t/timer-actions";
import { Avatar, hueFor } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CHIP_HUE, Chip, type ChipHue } from "@/components/ui/chip";
import {
  DataTable,
  DataTd,
  DataTh,
  DataThead,
  DataTr,
} from "@/components/ui/data-table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconCheck, IconChevronLeft, IconChevronRight, IconPause, IconPlay, IconPlus, IconTrash } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { TimeHeader } from "./time-header";
import {
  buildGrid,
  billableSeconds,
  csvRows,
  dayHead,
  dayKey,
  dayLong,
  fmtClock,
  fmtDuration,
  isoWeek,
  parseWeek,
  pct,
  rollUp,
  sumSeconds,
  toCsv,
  visibleDayIndexes,
  weekDays,
  weekRangeLabel,
  type GridChip,
  type TimeEntryRow,
} from "./time-math";

export type { TimeEntryRow };

export interface TimesheetPerson {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** `YYYY-MM-DD` zatwierdzonych dni urlopu w tym tygodniu. */
  leaveDays: string[];
}

export interface RunningTimer {
  taskId: string;
  taskDisplayId: number;
  taskTitle: string;
  ownerId: string | null;
  ownerName: string;
  startedAt: string;
}

/** Nasycony kolor krawędzi chipa — para do tła `CHIP_HUE`. */
const HUE_EDGE: Record<ChipHue, string> = {
  gray: "border-l-n-500", orange: "border-l-orange-600", red: "border-l-danger", yellow: "border-l-warning",
  green: "border-l-success", teal: "border-l-chip-teal-fg", blue: "border-l-info", indigo: "border-l-chip-indigo-fg",
  purple: "border-l-chip-purple-fg", pink: "border-l-chip-pink-fg", brown: "border-l-chip-brown-fg", black: "border-l-n-900",
};

const personPl = (n: number) => plPlural(n, "osoba", "osoby", "osób");

const CSV_BOM = "﻿";
const csvDataUrl = (rows: string[][]) =>
  `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_BOM + toCsv(rows))}`;

export function TimesheetView({
  workspaceId,
  currentUserId,
  canApprove,
  canPauseTimer,
  view,
  weekKey,
  todayKey,
  entries,
  people,
  timer,
  openNewEntry,
}: {
  workspaceId: string;
  currentUserId: string;
  /** Zatwierdzać wpisy może tylko admin przestrzeni. */
  canApprove: boolean;
  /** Pauza timera woła `task.update` — VIEWER nie dostaje przycisku. */
  canPauseTimer: boolean;
  view: "my" | "team";
  weekKey: string;
  todayKey: string;
  entries: TimeEntryRow[];
  people: TimesheetPerson[];
  timer: RunningTimer | null;
  /** `?new=1` z menu „Utwórz → Wpis czasu" otwiera dialog od razu. */
  openNewEntry: boolean;
}) {
  const router = useRouter();

  const days = useMemo(() => weekDays(parseWeek(weekKey, new Date())), [weekKey]);
  const columns = useMemo(() => visibleDayIndexes(entries, days), [entries, days]);
  const rows = useMemo(
    () => buildGrid(entries, days, people.map((p) => p.id)),
    [entries, days, people],
  );

  // Zaznaczony dzień: domyślnie dzisiaj, a poza bieżącym tygodniem — poniedziałek.
  // Klucz spoza tygodnia sam się unieważnia po zmianie tygodnia.
  const [picked, setPicked] = useState<string | null>(null);
  const keys = days.map(dayKey);
  const fallback = keys.includes(todayKey) ? todayKey : keys[0]!;
  const selected = picked && keys.includes(picked) ? picked : fallback;
  const selectedDay = days[keys.indexOf(selected)]!;

  const total = sumSeconds(entries);
  const billable = billableSeconds(entries);
  const topBoard = rollUp(entries, (e) => e.boardId, (e) => e.boardName ?? "—")[0] ?? null;

  const dayEntries = entries
    .filter((e) => dayKey(new Date(e.startedAt)) === selected)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  // „Utwórz → Wpis czasu" nawiguje na ?new=1 bez remountu — korekta stanu przy
  // zmianie propsa (wzorzec z react.dev, bez efektu).
  const [addOpen, setAddOpen] = useState(openNewEntry);
  const [lastNewFlag, setLastNewFlag] = useState(openNewEntry);
  if (openNewEntry !== lastNewFlag) {
    setLastNewFlag(openNewEntry);
    if (openNewEntry) setAddOpen(true);
  }

  const goWeek = (offset: number) => {
    const next = new Date(days[0]!.getFullYear(), days[0]!.getMonth(), days[0]!.getDate() + offset * 7);
    router.push(`/w/${workspaceId}/time?view=${view}&week=${dayKey(next)}`);
  };

  return (
    <div data-ui="time" className="flex min-h-0 flex-1 flex-col bg-card">
      <TimeHeader
        workspaceId={workspaceId}
        tab={view}
        weekKey={weekKey}
        csvHref={csvDataUrl(csvRows(entries))}
        csvName={`czas-pracy-${weekKey}.csv`}
      >
        <WeekNav days={days} onPrev={() => goWeek(-1)} onNext={() => goWeek(1)} />
      </TimeHeader>

      <div className="flex shrink-0 gap-3 px-8 pb-3.5 max-md:flex-col max-md:px-4">
        <Tile label={view === "my" ? "Ty — ten tydzień" : "Zespół — ten tydzień"}>
          <span className="font-mono text-lg font-semibold">{fmtDuration(total)}</span>
        </Tile>
        <Tile label="Zafakturowane">
          <span className="font-mono text-lg font-semibold">{fmtDuration(billable)}</span>
          <span className="text-2xs text-fg-3">{pct(billable, total)}%</span>
        </Tile>
        <Tile label="Najwięcej czasu">
          <span className="truncate text-base font-semibold">{topBoard?.label ?? "—"}</span>
          {topBoard && <span className="font-mono text-2xs text-fg-3">{fmtDuration(topBoard.seconds)}</span>}
        </Tile>
        {timer && <TimerTile timer={timer} canPause={canPauseTimer} />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-5 max-md:px-4">
        <div data-ui="time-grid">
          <DataTable className="table-fixed">
            <DataThead>
              <tr>
                <DataTh width={200}>Osoba</DataTh>
                {columns.map((i) => {
                  const key = keys[i]!;
                  const on = key === selected;
                  return (
                    <DataTh key={key} align="center" className={cn("p-0", on && "bg-selected text-foreground")}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setPicked(key)}
                        className="inline-flex h-8 items-center rounded-sm px-2 text-2xs font-semibold tracking-[.06em] uppercase outline-none hover:text-foreground active:opacity-70"
                      >
                        {dayHead(days[i]!)}
                      </button>
                    </DataTh>
                  );
                })}
                <DataTh width={100} align="right">Suma</DataTh>
              </tr>
            </DataThead>
            <tbody>
              {people.map((person, r) => {
                const row = rows[r]!;
                return (
                  <DataTr key={person.id} className="h-14">
                    <DataTd>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={person.name} src={person.avatarUrl} size={26} />
                        <span className="min-w-0 truncate font-medium">{person.name}</span>
                      </span>
                    </DataTd>
                    {columns.map((i) => {
                      const key = keys[i]!;
                      const onLeave = person.leaveDays.includes(key);
                      const cell = row.cells[i]!;
                      const running = timer && timer.ownerId === person.id && key === todayKey;
                      return (
                        <DataTd
                          key={key}
                          className={cn("p-1.5", key === selected && "bg-today", onLeave && "bg-chip-green-bg p-0 text-center")}
                        >
                          {onLeave ? (
                            <span className="text-[10px] font-semibold text-chip-green-fg">URLOP</span>
                          ) : (
                            <span className="flex flex-col gap-px">
                              {cell.map((chip) => (
                                <EntryChip key={chip.key} chip={chip} />
                              ))}
                              {running && <TimerChip startedAt={timer.startedAt} />}
                            </span>
                          )}
                        </DataTd>
                      );
                    })}
                    <DataTd align="right" className="font-mono text-xs font-semibold">
                      {fmtDuration(row.total)}
                    </DataTd>
                  </DataTr>
                );
              })}
            </tbody>
          </DataTable>
        </div>

        <div className="mt-3.5 flex items-center gap-2">
          <span className="eyebrow">Wpisy — {dayLong(selectedDay)}</span>
          <span className="h-px flex-1 bg-border" />
          <Button
            variant="secondary"
            size="sm"
            className="border-dashed border-n-400 text-muted-foreground"
            onClick={() => setAddOpen(true)}
          >
            <IconPlus />
            Dodaj wpis ręcznie
          </Button>
        </div>

        <div data-ui="time-entries">
          <DataTable wrapperClassName="mt-2">
            <tbody>
              {dayEntries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Brak wpisów w tym dniu.
                  </td>
                </tr>
              )}
              {dayEntries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  canApprove={canApprove}
                  canDelete={entry.userId === currentUserId && !entry.approvedAt}
                />
              ))}
            </tbody>
          </DataTable>
        </div>
      </div>

      <div className="flex h-8 shrink-0 items-center gap-2 border-t border-border bg-canvas px-8 max-md:px-4">
        <span className="truncate font-mono text-2xs text-muted-foreground">
          tydzień {isoWeek(days[0]!)} · {view === "my" ? "tylko Ty" : `zespół ${people.length} ${personPl(people.length)}`} ·{" "}
          {fmtDuration(total)} zalogowane
        </span>
        <span className="flex-1" />
        <span className="hidden font-mono text-2xs text-fg-3 md:inline">
          kolor chipa = tablica · zielone = urlop
        </span>
      </div>

      {addOpen && (
        <ManualEntryDialog
          workspaceId={workspaceId}
          dayKeyValue={selected}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

// ─── nagłówek tygodnia ──────────────────────────────────────────────────────

function WeekNav({ days, onPrev, onNext }: { days: Date[]; onPrev: () => void; onNext: () => void }) {
  return (
    <span className="flex items-center gap-2">
      <Button variant="secondary" size="sm" iconOnly aria-label="Poprzedni tydzień" onClick={onPrev}>
        <IconChevronLeft width={13} height={13} />
      </Button>
      <span className="min-w-[170px] text-center text-base font-semibold">{weekRangeLabel(days)}</span>
      <Button variant="secondary" size="sm" iconOnly aria-label="Następny tydzień" onClick={onNext}>
        <IconChevronRight width={13} height={13} />
      </Button>
    </span>
  );
}

// ─── kafle ──────────────────────────────────────────────────────────────────

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-border bg-canvas px-3.5 py-3">
      <div className="mb-0.5 text-2xs text-fg-3">{label}</div>
      <div className="flex min-w-0 items-baseline gap-1.5">{children}</div>
    </div>
  );
}

function TimerTile({ timer, canPause }: { timer: RunningTimer; canPause: boolean }) {
  const seconds = useTicker(timer.startedAt);
  return (
    <div
      data-ui="time-timer"
      className="min-w-0 flex-1 rounded-lg border border-orange-200 bg-orange-50 px-3.5 py-3"
    >
      <div className="mb-0.5 text-2xs text-orange-800">Timer aktywny</div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-lg font-semibold text-orange-800">{fmtClock(seconds)}</span>
        <span className="min-w-0 flex-1 truncate text-2xs text-orange-800">
          #{timer.taskDisplayId} · {timer.ownerName}
        </span>
        {canPause && (
        <form action={pauseTaskTimerAction} className="contents">
          <input type="hidden" name="id" value={timer.taskId} />
          <button
            type="submit"
            aria-label={`Zatrzymaj timer zadania #${timer.taskDisplayId}`}
            title="Zatrzymaj timer"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm bg-orange-500 text-ink outline-none hover:bg-orange-600 active:bg-orange-700"
          >
            <IconPause width={10} height={10} />
          </button>
        </form>
        )}
      </div>
    </div>
  );
}

/** Sekundy od startu timera, odświeżane co sekundę (0 do czasu hydracji — bez mismatchu SSR). */
function useTicker(startedAt: string): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = new Date(startedAt).getTime();
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return seconds;
}

// ─── chipy w siatce ─────────────────────────────────────────────────────────

const CHIP_BASE =
  "flex h-4 items-center gap-1 overflow-hidden rounded-[3px] border-l-[3px] px-[5px] text-[10px] leading-4 whitespace-nowrap";

function EntryChip({ chip }: { chip: GridChip }) {
  const hue = chip.boardName ? hueFor(chip.boardName) : "gray";
  const text = `${chip.label} · ${fmtDuration(chip.seconds)}`;
  return (
    <span className={cn(CHIP_BASE, CHIP_HUE[hue], HUE_EDGE[hue])} title={`${text}${chip.boardName ? ` — ${chip.boardName}` : ""}`}>
      <span className="truncate">{text}</span>
    </span>
  );
}

function TimerChip({ startedAt }: { startedAt: string }) {
  const seconds = useTicker(startedAt);
  return (
    <span className={cn(CHIP_BASE, "bg-orange-200 text-orange-900 border-l-orange-500")}>
      <IconPlay width={8} height={8} className="shrink-0" />
      <span className="truncate">timer · {fmtClock(seconds).slice(0, -3)}</span>
    </span>
  );
}

// ─── lista wpisów dnia ──────────────────────────────────────────────────────

function EntryRow({
  entry,
  canApprove,
  canDelete,
}: {
  entry: TimeEntryRow;
  canApprove: boolean;
  canDelete: boolean;
}) {
  const approved = entry.approvedAt !== null;

  const submit = (action: (fd: FormData) => Promise<void>, fd: FormData) =>
    startTransition(async () => { await action(fd); });

  const toggleApproval = () => {
    const fd = new FormData();
    fd.set("id", entry.id);
    fd.set("approve", approved ? "false" : "true");
    submit(approveTimeEntryAction, fd);
  };

  const remove = () => {
    if (!window.confirm("Usunąć ten wpis czasu?")) return;
    const fd = new FormData();
    fd.set("id", entry.id);
    submit(deleteTimeEntryAction, fd);
  };

  return (
    <DataTr>
      <DataTd width={40} className="pr-0">
        <Avatar name={entry.userName} size={22} />
      </DataTd>
      <DataTd width={56} className="font-mono text-2xs text-muted-foreground">
        {entry.taskDisplayId !== null ? `#${entry.taskDisplayId}` : "—"}
      </DataTd>
      <DataTd className="max-w-0 truncate text-xs">
        {entry.taskTitle ?? entry.note ?? "bez zadania"}
      </DataTd>
      <DataTd width={150}>
        {entry.boardName && (
          <Chip size="sm" hue={hueFor(entry.boardName)} className="max-w-full overflow-hidden">
            <span className="truncate">{entry.boardName}</span>
          </Chip>
        )}
      </DataTd>
      <DataTd width={84}>
        <span className="flex items-center gap-1.5">
          <Checkbox
            size="sm"
            checked={entry.billable}
            disabled
            ariaLabel="Fakturowane"
            className="data-checked:data-disabled:border-control-on data-checked:data-disabled:bg-control-on data-checked:data-disabled:text-white"
          />
          <span className="text-[10px] text-fg-3" title="Ustawiane przy tworzeniu wpisu">fakt.</span>
        </span>
      </DataTd>
      <DataTd width={80} align="right" className="font-mono text-xs font-semibold">
        {fmtDuration(entry.durationSeconds)}
      </DataTd>
      <DataTd width={72}>
        <span className="flex items-center justify-end gap-0.5">
          {canApprove && (
            <button
              type="button"
              onClick={toggleApproval}
              aria-pressed={approved}
              title={approved ? "Cofnij zatwierdzenie" : "Zatwierdź wpis"}
              aria-label={approved ? "Cofnij zatwierdzenie wpisu" : "Zatwierdź wpis"}
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-sm outline-none hover:bg-n-100 active:bg-n-200",
                approved ? "text-success-text" : "text-n-400 hover:text-foreground",
              )}
            >
              <IconCheck width={14} height={14} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={remove}
              title="Usuń wpis"
              aria-label="Usuń wpis"
              className="inline-flex size-6 items-center justify-center rounded-sm text-n-400 outline-none hover:bg-n-100 hover:text-danger-text active:bg-n-200"
            >
              <IconTrash width={14} height={14} />
            </button>
          )}
        </span>
      </DataTd>
    </DataTr>
  );
}

// ─── dialog ręcznego wpisu ──────────────────────────────────────────────────

function ManualEntryDialog({
  workspaceId,
  dayKeyValue,
  onClose,
}: {
  workspaceId: string;
  dayKeyValue: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<CreateTimeEntryState, FormData>(
    createTimeEntryAction,
    null,
  );

  const [billable, setBillable] = useState(true);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  const error = state && !state.ok ? (state.error ?? state.fieldErrors?.stoppedAt ?? state.fieldErrors?.startedAt) : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm" aria-label="Nowy wpis czasu">
        <form action={(fd) => startTransition(() => formAction(fd))} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Dodaj wpis ręcznie</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="time-start">Start</Label>
                <Input id="time-start" type="datetime-local" name="startedAt" defaultValue={`${dayKeyValue}T09:00`} required />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="time-stop">Koniec</Label>
                <Input id="time-stop" type="datetime-local" name="stoppedAt" defaultValue={`${dayKeyValue}T10:00`} required />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="time-note">Notatka</Label>
              <Input id="time-note" name="note" maxLength={500} placeholder="np. spotkania" />
            </div>
            {/* Hidden input, bo akcja czyta `billable !== "false"` — brak pola = fakturowane. */}
            <input type="hidden" name="billable" value={billable ? "true" : "false"} />
            <span className="flex items-center gap-2 text-xs">
              <Checkbox checked={billable} onCheckedChange={(next) => setBillable(next === true)} ariaLabel="Fakturowane" />
              Fakturowane
            </span>
            {error && (
              <p role="alert" className="rounded-sm bg-chip-red-bg px-2.5 py-1.5 text-xs text-danger-text">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={onClose}>Anuluj</Button>
            <Button type="submit" loading={pending} disabled={pending}>Zapisz wpis</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
