"use client";

// E4 „Urlopy” — kafle limitu/akceptacji/nieobecnych, grafik zespołu,
// wnioski do akceptacji i historia. Logika dat: ./leave.ts.

import { useState, type ReactNode } from "react";
import {
  approveVacationRequestAction,
  cancelVacationRequestAction,
  createVacationRequestAction,
  rejectVacationRequestAction,
  type VacationFormState,
} from "@/app/(app)/vacations/actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip, type ChipHue } from "@/components/ui/chip";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconPlus, IconWarning } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { coversDay, monthSpan, overlaps, toUtcDateOnly, workingDays } from "./leave";

export interface TeamMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface LeaveRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterAvatarUrl: string | null;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  decidedByName: string | null;
  decidedAt: string | null;
}

export interface VacationWorkspaceProps {
  currentUserId: string;
  isSuperAdmin: boolean;
  /** Server „today” (YYYY-MM-DD) — keeps SSR and the client on the same day. */
  today: string;
  /** Displayed month of the team schedule. */
  year: number;
  /** 0-based, like `Date#getMonth`. */
  month: number;
  limit: number;
  used: number;
  team: TeamMember[];
  /** pending + approved leave of the team — schedule, absences, conflicts. */
  active: LeaveRequest[];
  /** Awaiting a decision: every request for a super-admin, own ones otherwise. */
  pending: LeaveRequest[];
  history: LeaveRequest[];
}

const MONTHS_GEN = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const MONTHS_NOM = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];

const requestPl = (n: number) => plPlural(n, "wniosek", "wnioski", "wniosków");
const dayPl = (n: number) => plPlural(n, "dzień roboczy", "dni robocze", "dni roboczych");
const waitPl = (n: number) => plPlural(n, "czeka", "czekają", "czeka");
const approvedPl = (n: number) => plPlural(n, "zatwierdzony", "zatwierdzone", "zatwierdzonych");

function dateParts(iso: string) {
  const d = new Date(iso);
  return { day: d.getUTCDate(), month: d.getUTCMonth() };
}

/** „22–26 września” / „1 września – 3 października” / „10 września”. */
function rangeLabel(startIso: string, endIso: string): string {
  const a = dateParts(startIso);
  const b = dateParts(endIso);
  if (a.month !== b.month) return `${a.day} ${MONTHS_GEN[a.month]} – ${b.day} ${MONTHS_GEN[b.month]}`;
  if (a.day === b.day) return `${a.day} ${MONTHS_GEN[a.month]}`;
  return `${a.day}–${b.day} ${MONTHS_GEN[a.month]}`;
}

function shortDate(iso: string): string {
  const { day, month } = dateParts(iso);
  return `${day} ${MONTHS_GEN[month].slice(0, 3)}`;
}

const STATUS: Record<string, { label: string; hue: ChipHue }> = {
  pending: { label: "Czeka", hue: "yellow" },
  approved: { label: "Zatwierdzony", hue: "green" },
  rejected: { label: "Odrzucony", hue: "red" },
  cancelled: { label: "Anulowany", hue: "gray" },
};

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="eyebrow">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-canvas px-3.5 py-3">
      <div className="mb-0.5 text-2xs text-fg-3">{label}</div>
      {children}
    </div>
  );
}

export function VacationWorkspace({
  currentUserId,
  isSuperAdmin,
  today,
  year,
  month,
  limit,
  used,
  team,
  active,
  pending,
  history,
}: VacationWorkspaceProps) {
  const remaining = Math.max(0, limit - used);
  const absentToday = active.filter((r) => r.status === "approved" && coversDay(r, today));
  const approvedCount = active.filter((r) => r.status === "approved").length;

  return (
    <div
      data-ui="vacations"
      className="flex h-[calc(100dvh-var(--topbar))] flex-col bg-card"
    >
      <div className="flex shrink-0 items-center gap-2.5 px-8 pt-4 max-md:px-4">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Urlopy</h1>
        <span className="mt-1.5 text-xs text-fg-2">
          {MONTHS_NOM[month]} {year}
        </span>
        <span className="flex-1" />
        <NewRequestDialog />
      </div>

      <div className="flex shrink-0 gap-3 px-8 py-3.5 max-md:flex-col max-md:px-4">
        <Tile label={`Twój limit ${year}`}>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-semibold">{remaining} dni</span>
            <span className="text-2xs text-fg-3">z {limit} pozostało</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-[2px] bg-n-100">
            <span
              className="block h-1 bg-control-on"
              style={{ width: `${limit > 0 ? Math.min(100, (used / limit) * 100) : 0}%` }}
            />
          </div>
        </Tile>
        <Tile label="Do akceptacji">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-semibold text-orange-800">{pending.length}</span>
            <span className="text-2xs text-fg-3">
              {requestPl(pending.length)} {waitPl(pending.length)}{" "}
              {isSuperAdmin ? "na Ciebie" : "na decyzję"}
            </span>
          </div>
        </Tile>
        <Tile label="Nieobecni dziś">
          {absentToday.length === 0 ? (
            <div className="mt-0.5 text-sm text-fg-2">nikt — pełny skład</div>
          ) : (
            <ul className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {absentToday.map((r) => (
                <li key={r.id} className="flex items-center gap-1.5">
                  <Avatar name={r.requesterName} src={r.requesterAvatarUrl} size={20} />
                  <span className="text-xs">{r.requesterName}</span>
                </li>
              ))}
            </ul>
          )}
        </Tile>
      </div>

      <TeamSchedule team={team} active={active} year={year} month={month} />

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-2 pb-5 max-md:px-4">
        <SectionHeading>Wnioski do akceptacji</SectionHeading>
        {pending.length === 0 ? (
          <p className="mb-3 rounded-lg border border-dashed border-input-border px-3.5 py-4 text-center text-xs text-fg-2">
            Brak wniosków czekających na decyzję.
          </p>
        ) : (
          <ul className="mb-3 overflow-hidden rounded-lg border border-border">
            {pending.map((r) => (
              <PendingRow
                key={r.id}
                request={r}
                conflict={active.find((o) => o.id !== r.id && o.requesterId !== r.requesterId && overlaps(o, r)) ?? null}
                canDecide={isSuperAdmin}
                isMine={r.requesterId === currentUserId}
              />
            ))}
          </ul>
        )}

        <SectionHeading>Historia</SectionHeading>
        {history.length === 0 ? (
          <p className="rounded-lg border border-dashed border-input-border px-3.5 py-4 text-center text-xs text-fg-2">
            Brak rozpatrzonych wniosków.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border">
            {history.map((r) => {
              const status = STATUS[r.status] ?? STATUS.pending!;
              return (
                <li
                  key={r.id}
                  className="flex h-10 items-center gap-3 border-b border-n-100 px-3.5 last:border-b-0 max-md:h-auto max-md:flex-wrap max-md:py-2"
                >
                  <Avatar name={r.requesterName} src={r.requesterAvatarUrl} size={24} />
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {r.requesterName} · {rangeLabel(r.startDate, r.endDate)} · {workingDays(r)} {dayPl(workingDays(r))}
                  </span>
                  <Chip hue={status.hue} dot size="sm">{status.label}</Chip>
                  {r.decidedByName && r.decidedAt && (
                    <span className="font-mono text-[10px] text-fg-3">
                      akcept.: {r.decidedByName} · {shortDate(r.decidedAt)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-8 max-md:px-4">
        <span className="truncate font-mono text-2xs text-fg-2">
          {pending.length} {requestPl(pending.length)} {waitPl(pending.length)} · {approvedCount}{" "}
          {approvedPl(approvedCount)} · limit zespołu OK
        </span>
      </div>
    </div>
  );
}

// ── Grafik zespołu ──────────────────────────────────────────────────────────

function TeamSchedule({
  team,
  active,
  year,
  month,
}: {
  team: TeamMember[];
  active: LeaveRequest[];
  year: number;
  month: number;
}) {
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const buckets = [
    { label: "1–7", days: 7 },
    { label: "8–14", days: 7 },
    { label: "15–21", days: 7 },
    { label: `22–${days}`, days: days - 21 },
  ];
  const rows = team
    .map((m) => ({
      member: m,
      spans: active
        .filter((r) => r.requesterId === m.id)
        .map((r) => ({ request: r, span: monthSpan(r, year, month) }))
        .flatMap((x) => (x.span ? [{ request: x.request, ...x.span }] : [])),
    }))
    // Osoby z urlopem w tym miesiącu idą pierwsze; grafik ma stałą wysokość,
    // więc bierzemy maks. 8 wierszy — reszta jest w „Historii" i we wnioskach.
    .sort((a, b) => b.spans.length - a.spans.length);
  const visible = rows.slice(0, 8);
  const hidden = rows.length - visible.length;

  return (
    <div className="shrink-0 px-8 pb-2 max-md:px-4">
      <SectionHeading>Grafik zespołu — {MONTHS_NOM[month]}</SectionHeading>
      <div className="overflow-hidden rounded-sm border border-border">
        <div className="flex h-7 border-b border-border bg-table-header">
          <span className="eyebrow flex w-[140px] shrink-0 items-center border-r border-table-grid px-3 text-fg-2">
            Osoba
          </span>
          {buckets.map((b) => (
            <span
              key={b.label}
              style={{ flexGrow: b.days }}
              className="flex basis-0 items-center justify-center border-r border-table-grid font-mono text-[10px] text-fg-2 last:border-r-0"
            >
              {b.label}
            </span>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="px-3 py-3 text-xs text-fg-2">Brak osób w Twoich przestrzeniach.</p>
        ) : (
          visible.map(({ member, spans }) => (
            <div key={member.id} className="flex h-9 border-b border-table-grid last:border-b-0">
              <span className="flex w-[140px] shrink-0 items-center gap-2 border-r border-table-grid px-3">
                <Avatar name={member.name} src={member.avatarUrl} size={22} />
                <span className="truncate text-xs font-medium">{member.name}</span>
              </span>
              <span className="relative flex-1">
                {[7, 14, 21].map((d) => (
                  <span key={d} className="absolute inset-y-0 w-px bg-table-grid" style={{ left: `${(d / days) * 100}%` }} />
                ))}
                {spans.map((s) => (
                  <span
                    key={s.request.id}
                    title={`${s.request.requesterName}: ${rangeLabel(s.request.startDate, s.request.endDate)}`}
                    className={cn(
                      "absolute top-2 flex h-5 items-center justify-center overflow-hidden rounded-sm border px-1 text-[10px] font-medium whitespace-nowrap",
                      s.request.status === "approved"
                        ? "border-success bg-chip-green-bg text-chip-green-fg"
                        : "border-warning bg-chip-yellow-bg text-chip-yellow-fg",
                    )}
                    data-leave-status={s.request.status}
                    style={{
                      left: `${((s.startDay - 1) / days) * 100}%`,
                      width: `${((s.endDay - s.startDay + 1) / days) * 100}%`,
                    }}
                  >
                    {s.startDay === s.endDay ? s.startDay : `${s.startDay}–${s.endDay}`}
                    {" · "}
                    {s.request.status === "approved" ? "zatw." : "czeka"}
                  </span>
                ))}
              </span>
            </div>
          ))
        )}
      </div>
      {hidden > 0 && (
        <p className="mt-1 text-2xs text-fg-3">+{hidden} {hidden === 1 ? "osoba" : "osób"} bez urlopu w tym miesiącu</p>
      )}
    </div>
  );
}

// ── Wniosek czekający na decyzję ────────────────────────────────────────────

function PendingRow({
  request,
  conflict,
  canDecide,
  isMine,
}: {
  request: LeaveRequest;
  conflict: LeaveRequest | null;
  canDecide: boolean;
  isMine: boolean;
}) {
  const days = workingDays(request);
  return (
    <li className="flex min-h-[52px] items-center gap-3 border-b border-n-100 bg-card px-3.5 py-2 last:border-b-0 max-md:flex-wrap">
      <Avatar name={request.requesterName} src={request.requesterAvatarUrl} size={28} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{request.requesterName} — wniosek urlopowy</span>
        <span className="block truncate text-xs text-fg-2">
          {rangeLabel(request.startDate, request.endDate)} · {days} {dayPl(days)}
          {request.reason ? ` · „${request.reason}”` : ""}
          {conflict ? ` · konflikt: ${conflict.requesterName}, ${rangeLabel(conflict.startDate, conflict.endDate)}` : ""}
        </span>
      </span>
      <Chip hue="yellow" dot size="md" className="shrink-0">Czeka</Chip>
      {conflict && (
        <Chip hue="red" size="md" className="shrink-0">
          <IconWarning width={10} height={10} />
          Konflikt
        </Chip>
      )}
      {canDecide && (
        <>
          <form action={approveVacationRequestAction}>
            <input type="hidden" name="id" value={request.id} />
            <Button type="submit" size="sm">Zatwierdź</Button>
          </form>
          <form action={rejectVacationRequestAction}>
            <input type="hidden" name="id" value={request.id} />
            <Button type="submit" variant="secondary" size="sm" className="text-danger-text">Odrzuć</Button>
          </form>
        </>
      )}
      {isMine && (
        <form action={cancelVacationRequestAction}>
          <input type="hidden" name="id" value={request.id} />
          <Button type="submit" variant="ghost" size="sm">Anuluj</Button>
        </form>
      )}
    </li>
  );
}

// ── Złóż wniosek ────────────────────────────────────────────────────────────

function NewRequestDialog() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<VacationFormState>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    for (const field of ["startDate", "endDate"]) {
      const v = formData.get(field);
      if (typeof v === "string" && v) formData.set(field, toUtcDateOnly(v));
    }
    const result = await createVacationRequestAction(null, formData);
    setPending(false);
    setState(result);
    if (result?.ok) setOpen(false);
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <IconPlus />
        Złóż wniosek
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setState(null);
        }}
      >
        <DialogContent size="md">
        <form action={submit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>Złóż wniosek o urlop</DialogTitle>
            <DialogDescription>Wniosek trafia do akceptacji administratora.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-n-700">Od</span>
                <DateTimePicker name="startDate" defaultValue={null} dateOnly placeholder="Wybierz datę startu" label="Data startu urlopu" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-n-700">Do</span>
                <DateTimePicker name="endDate" defaultValue={null} dateOnly placeholder="Wybierz datę końca" label="Data końca urlopu" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vacation-reason">Powód (opcjonalnie)</Label>
              <Input id="vacation-reason" name="reason" maxLength={500} placeholder="np. wyjazd rodzinny" />
            </div>
            {state && !state.ok && (
              <p role="alert" className="rounded-md border border-danger bg-chip-red-bg px-3 py-2 text-xs text-danger-text">
                {state.error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Anuluj</Button>
            <Button type="submit" loading={pending} disabled={pending}>Wyślij wniosek</Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
