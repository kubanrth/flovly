"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Coins,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import type { Role } from "@/lib/generated/prisma/enums";
import {
  createTimeEntryAction,
  deleteTimeEntryAction,
  approveTimeEntryAction,
  setMyHourlyRateAction,
  type CreateTimeEntryState,
} from "@/app/(app)/w/[workspaceId]/time/actions";

export interface TimeEntryRow {
  id: string;
  taskId: string | null;
  taskTitle: string | null;
  taskDisplayId: number | null;
  boardName: string | null;
  userId: string;
  userName: string;
  userAvatar: string | null;
  startedAt: string;
  stoppedAt: string;
  durationSeconds: number;
  note: string | null;
  billable: boolean;
  rateSnapshotCents: number | null;
  approvedAt: string | null;
}

export interface TimesheetMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  hourlyRateCents: number | null;
  role: Role;
}

const DAYS_PL = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nie"];

export function TimesheetView({
  workspaceId,
  currentUserId,
  weekStartIso,
  entries,
  members,
  myHourlyRateCents,
  userFilter,
}: {
  workspaceId: string;
  currentUserId: string;
  weekStartIso: string;
  entries: TimeEntryRow[];
  members: TimesheetMember[];
  myHourlyRateCents: number | null;
  userFilter: string;
}) {
  const router = useRouter();
  const weekStart = useMemo(() => new Date(weekStartIso), [weekStartIso]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const changeWeek = (offsetDays: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + offsetDays);
    const iso = next.toISOString().slice(0, 10);
    const q = new URLSearchParams({ week: iso, user: userFilter });
    router.push(`/w/${workspaceId}/time?${q.toString()}`);
  };

  const changeUserFilter = (uid: string) => {
    const iso = weekStart.toISOString().slice(0, 10);
    const q = new URLSearchParams({ week: iso, user: uid });
    router.push(`/w/${workspaceId}/time?${q.toString()}`);
  };

  // Group entries by taskId (or "no-task" bucket) for rows.
  const grouped = useMemo(() => {
    const map = new Map<string, TimeEntryRow[]>();
    for (const e of entries) {
      const key = e.taskId ?? "__no_task__";
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return [...map.entries()].map(([taskId, list]) => ({
      taskId: taskId === "__no_task__" ? null : taskId,
      title: list[0]?.taskTitle ?? "Bez zadania",
      displayId: list[0]?.taskDisplayId ?? null,
      board: list[0]?.boardName ?? null,
      entries: list,
    }));
  }, [entries]);

  // Grand totals per day + week + billable/non.
  const totalPerDay = useMemo(() => {
    const arr = new Array(7).fill(0);
    for (const e of entries) {
      const start = new Date(e.startedAt);
      const idx = Math.floor(
        (start.getTime() - weekStart.getTime()) / (24 * 3600 * 1000),
      );
      if (idx >= 0 && idx < 7) arr[idx] += e.durationSeconds;
    }
    return arr;
  }, [entries, weekStart]);

  const totalWeek = totalPerDay.reduce((a, b) => a + b, 0);
  const totalBillable = entries
    .filter((e) => e.billable)
    .reduce((a, e) => a + e.durationSeconds, 0);
  const totalEarnings = entries.reduce((acc, e) => {
    if (!e.billable || !e.rateSnapshotCents) return acc;
    return acc + (e.durationSeconds / 3600) * e.rateSnapshotCents;
  }, 0);

  const [addOpen, setAddOpen] = useState<{
    date: Date;
    taskId?: string | null;
  } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar: rate + user filter + summary */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <RateEditor initialCents={myHourlyRateCents} />
          <UserFilter
            members={members}
            value={userFilter}
            onChange={changeUserFilter}
            currentUserId={currentUserId}
          />
        </div>
        <div className="flex items-center gap-3 text-[0.82rem]">
          <span className="text-muted-foreground">Suma tygodnia:</span>
          <span className="font-mono font-semibold">{fmtDuration(totalWeek)}</span>
          <span className="text-muted-foreground">
            Billable: {fmtDuration(totalBillable)}
          </span>
          {totalEarnings > 0 && (
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {fmtMoney(totalEarnings)}
            </span>
          )}
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-2">
        <button
          type="button"
          onClick={() => changeWeek(-7)}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Poprzedni tydzień"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2 font-mono text-[0.78rem] uppercase tracking-[0.14em]">
          <CalendarIcon size={12} />
          {fmtDateShort(days[0])} — {fmtDateShort(days[6])}
        </div>
        <button
          type="button"
          onClick={() => changeWeek(7)}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Następny tydzień"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekly grid */}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[880px] border-collapse text-[0.86rem]">
          <thead>
            <tr className="border-b border-border bg-card/70">
              <th className="px-3 py-2 text-left font-semibold">Zadanie</th>
              {days.map((d, i) => (
                <th
                  key={i}
                  className={`px-2 py-2 text-center font-semibold ${isToday(d) ? "bg-primary/10 text-primary" : ""}`}
                >
                  <div className="text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground">
                    {DAYS_PL[i]}
                  </div>
                  <div className="font-mono">{d.getDate()}</div>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Suma</th>
            </tr>
          </thead>
          <tbody>
            {grouped.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-6 py-10 text-center text-muted-foreground"
                >
                  Brak wpisów w tym tygodniu. Kliknij dzień żeby dodać.
                </td>
              </tr>
            )}
            {grouped.map((g) => {
              const perDay = new Array(7).fill(0);
              const entriesPerDay: TimeEntryRow[][] = Array.from(
                { length: 7 },
                () => [],
              );
              for (const e of g.entries) {
                const start = new Date(e.startedAt);
                const idx = Math.floor(
                  (start.getTime() - weekStart.getTime()) /
                    (24 * 3600 * 1000),
                );
                if (idx >= 0 && idx < 7) {
                  perDay[idx] += e.durationSeconds;
                  entriesPerDay[idx].push(e);
                }
              }
              const rowSum = perDay.reduce((a: number, b: number) => a + b, 0);
              return (
                <tr key={g.taskId ?? "no-task"} className="border-b border-border/60">
                  <td className="px-3 py-2">
                    {g.taskId ? (
                      <Link
                        href={`/w/${workspaceId}/t/${g.taskId}`}
                        className="flex min-w-0 flex-col gap-0.5 hover:text-primary"
                      >
                        <span className="truncate font-medium">{g.title}</span>
                        <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
                          #{g.displayId} · {g.board}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Bez zadania</span>
                    )}
                  </td>
                  {perDay.map((sec: number, i: number) => (
                    <td
                      key={i}
                      className={`px-2 py-2 text-center align-top ${isToday(days[i]) ? "bg-primary/5" : ""}`}
                    >
                      {sec > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-[0.82rem] font-semibold">
                            {fmtDuration(sec)}
                          </span>
                          {entriesPerDay[i].map((ent) => (
                            <EntryChip
                              key={ent.id}
                              entry={ent}
                              canModify={ent.userId === currentUserId}
                            />
                          ))}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setAddOpen({ date: days[i], taskId: g.taskId })
                          }
                          className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground/40 transition-colors hover:bg-muted hover:text-primary"
                          aria-label="Dodaj wpis"
                        >
                          <Plus size={12} />
                        </button>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {rowSum > 0 ? fmtDuration(rowSum) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-card/70 font-semibold">
              <td className="px-3 py-2 text-muted-foreground">Suma dnia</td>
              {totalPerDay.map((s: number, i: number) => (
                <td
                  key={i}
                  className={`px-2 py-2 text-center font-mono ${isToday(days[i]) ? "text-primary" : ""}`}
                >
                  {s > 0 ? fmtDuration(s) : "—"}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-mono">
                {fmtDuration(totalWeek)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAddOpen({ date: new Date() })}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 font-sans text-[0.86rem] font-semibold text-white shadow-brand transition-transform hover:-translate-y-[1px]"
        >
          <Plus size={14} /> Dodaj wpis manualny
        </button>
      </div>

      {addOpen && (
        <ManualEntryDialog
          workspaceId={workspaceId}
          initialDate={addOpen.date}
          initialTaskId={addOpen.taskId ?? undefined}
          onClose={() => setAddOpen(null)}
        />
      )}
    </div>
  );
}

function EntryChip({
  entry,
  canModify,
}: {
  entry: TimeEntryRow;
  canModify: boolean;
}) {
  const doDelete = () => {
    if (!confirm("Usunąć wpis?")) return;
    const fd = new FormData();
    fd.set("id", entry.id);
    startTransition(() => void deleteTimeEntryAction(fd));
  };
  return (
    <div
      className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.66rem] ${
        entry.approvedAt
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border bg-background"
      }`}
      title={entry.note ?? undefined}
    >
      <span className="font-mono">
        {fmtTimeShort(new Date(entry.startedAt))}
      </span>
      {!entry.billable && (
        <span className="text-muted-foreground/60" title="Non-billable">
          ⊘
        </span>
      )}
      {entry.approvedAt && <CheckCircle2 size={10} />}
      {canModify && !entry.approvedAt && (
        <button
          type="button"
          onClick={doDelete}
          className="text-muted-foreground/60 hover:text-destructive"
          aria-label="Usuń"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

function RateEditor({ initialCents }: { initialCents: number | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    initialCents !== null ? (initialCents / 100).toFixed(2) : "",
  );
  const submit = () => {
    const fd = new FormData();
    fd.set("hourlyRatePln", value);
    startTransition(() => void setMyHourlyRateAction(fd));
    setEditing(false);
  };
  return (
    <div className="flex items-center gap-2 text-[0.82rem]">
      <Coins size={14} className="text-amber-500" />
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            autoFocus
            placeholder="0.00"
            className="h-8 w-24 rounded-md border border-border bg-background px-2 font-mono text-[0.82rem] outline-none focus:border-primary/60"
          />
          <span className="text-muted-foreground">PLN/h</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md px-2 py-1 hover:bg-muted"
        >
          {initialCents !== null ? (
            <span className="font-mono font-semibold">
              {fmtMoney(initialCents / 100)}/h
            </span>
          ) : (
            <span className="text-muted-foreground">Ustaw stawkę</span>
          )}
        </button>
      )}
    </div>
  );
}

function UserFilter({
  members,
  value,
  onChange,
  currentUserId,
}: {
  members: TimesheetMember[];
  value: string;
  onChange: (uid: string) => void;
  currentUserId: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-border bg-background px-2 text-[0.82rem] outline-none focus:border-primary/60"
    >
      <option value={currentUserId}>Ja</option>
      <option value="all">Wszyscy</option>
      {members
        .filter((m) => m.id !== currentUserId)
        .map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
    </select>
  );
}

function ManualEntryDialog({
  workspaceId,
  initialDate,
  initialTaskId,
  onClose,
}: {
  workspaceId: string;
  initialDate: Date;
  initialTaskId?: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    CreateTimeEntryState,
    FormData
  >(createTimeEntryAction, null);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  const dayIso = initialDate.toISOString().slice(0, 10);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Manualny wpis czasu"
        className="flex w-full max-w-[520px] flex-col gap-4 rounded-t-2xl border border-border bg-card p-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[1.15rem] font-bold">
            Manualny wpis czasu
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>
        <form
          action={(fd) => startTransition(() => formAction(fd))}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="workspaceId" value={workspaceId} />
          {initialTaskId && (
            <input type="hidden" name="taskId" value={initialTaskId} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-eyebrow">Start</span>
              <input
                type="datetime-local"
                name="startedAt"
                defaultValue={`${dayIso}T09:00`}
                required
                className="h-10 rounded-lg border border-border bg-background px-3 text-[0.86rem] outline-none focus:border-primary/60"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-eyebrow">Koniec</span>
              <input
                type="datetime-local"
                name="stoppedAt"
                defaultValue={`${dayIso}T10:00`}
                required
                className="h-10 rounded-lg border border-border bg-background px-3 text-[0.86rem] outline-none focus:border-primary/60"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-eyebrow">Notatka (opcjonalna)</span>
            <input
              name="note"
              maxLength={500}
              placeholder="np. Meeting z klientem"
              className="h-10 rounded-lg border border-border bg-background px-3 text-[0.86rem] outline-none focus:border-primary/60"
            />
          </label>

          <label className="flex items-center gap-2 text-[0.86rem]">
            <input
              type="checkbox"
              name="billable"
              value="true"
              defaultChecked
              className="h-4 w-4"
            />
            Billable (idzie do rozliczenia)
          </label>

          {!state?.ok && state?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-[0.82rem] text-destructive">
              {state.error}
            </p>
          )}

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-lg px-4 text-[0.86rem] text-muted-foreground hover:text-foreground"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 items-center rounded-lg bg-brand-gradient px-4 text-[0.88rem] font-semibold text-white shadow-brand disabled:opacity-60"
            >
              {pending ? "Zapisuję…" : "Zapisz wpis"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ────── helpers ──────
export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function fmtMoney(pln: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(pln);
}

function fmtTimeShort(d: Date): string {
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function fmtDateShort(d: Date): string {
  return `${d.getDate()} ${["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"][d.getMonth()]}`;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

// Suppress unused imports (Circle, approveTimeEntryAction reserved for admin panel in reports).
void Circle;
void approveTimeEntryAction;
