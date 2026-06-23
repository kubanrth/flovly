"use client";

import { useActionState, startTransition, useState } from "react";
import { Check, Plane, ShieldCheck, X } from "lucide-react";
import {
  approveVacationRequestAction,
  cancelVacationRequestAction,
  createVacationRequestAction,
  rejectVacationRequestAction,
  type VacationFormState,
} from "@/app/(app)/vacations/actions";
import {
  CalendarMonthGrid,
  type CalendarEvent,
} from "@/components/my/calendar/month-grid";
import { DateTimePicker } from "@/components/ui/date-time-picker";

export interface ColleagueUpcoming {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  upcoming: {
    id: string;
    startDate: string;
    endDate: string;
    status: string;
  }[];
}

export interface MyVacationRequest {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  decidedByName: string | null;
  decidedAt: string | null;
}

export interface PendingForAdminItem {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  requester: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case "pending":
      return {
        label: "Oczekuje",
        cls: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      };
    case "approved":
      return {
        label: "Zatwierdzony",
        cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };
    case "rejected":
      return {
        label: "Odrzucony",
        cls: "border-destructive/40 bg-destructive/10 text-destructive",
      };
    case "cancelled":
      return {
        label: "Anulowany",
        cls: "border-border bg-muted/40 text-muted-foreground",
      };
    default:
      return { label: status, cls: "border-border bg-muted/40 text-muted-foreground" };
  }
}

export function VacationWorkspace({
  currentUserId,
  currentUserName,
  isSuperAdmin,
  calendarEvents,
  colleagues,
  myRequests,
  pendingForAdmin,
}: {
  currentUserId: string;
  currentUserName: string;
  isSuperAdmin: boolean;
  // Vacation feed for the calendar block (own pending+approved + teammate approved).
  calendarEvents: CalendarEvent[];
  colleagues: ColleagueUpcoming[];
  myRequests: MyVacationRequest[];
  pendingForAdmin: PendingForAdminItem[];
}) {
  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-col gap-2">
          <span className="eyebrow inline-flex items-center gap-1.5">
            <Plane size={11} /> Urlopy
          </span>
          <h1 className="font-display text-[1.6rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
            Cześć,{" "}
            <span className="text-brand-gradient">{currentUserName.split(" ")[0]}</span>.
          </h1>
          <p className="text-[0.92rem] leading-[1.55] text-muted-foreground">
            Składaj wnioski, sprawdź kto z zespołu ma zaplanowany urlop.
            Wniosek leci do administratora; widoczny dla Ciebie i zespołu po
            zatwierdzeniu.
          </p>
        </div>

        <NewRequestForm />

        {isSuperAdmin && pendingForAdmin.length > 0 && (
          <AdminQueue items={pendingForAdmin} />
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="eyebrow">Kalendarz</span>
              <h2 className="font-display text-[1.2rem] font-bold leading-[1.15] tracking-[-0.02em]">
                Kto i kiedy
              </h2>
            </div>
          </div>
          <CalendarMonthGrid events={calendarEvents} />
        </section>

        <ColleaguesList colleagues={colleagues} currentUserId={currentUserId} />

        <MyRequestsList items={myRequests} />
      </div>
    </main>
  );
}

function NewRequestForm() {
  const [state, formAction, pending] = useActionState<VacationFormState, FormData>(
    createVacationRequestAction,
    null,
  );
  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-6">
      <form
        action={(fd) => startTransition(() => formAction(fd))}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Nowy wniosek</span>
          <h2 className="font-display text-[1.2rem] font-bold leading-[1.15] tracking-[-0.02em]">
            Złóż wniosek o urlop
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Od *</span>
            <DateTimePicker
              name="startDate"
              defaultValue={null}
              dateOnly
              placeholder="Wybierz datę startu"
              label="Data startu urlopu"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Do *</span>
            <DateTimePicker
              name="endDate"
              defaultValue={null}
              dateOnly
              placeholder="Wybierz datę końca"
              label="Data końca urlopu"
            />
          </div>
          <label className="flex flex-col gap-2 md:col-span-1">
            <span className="eyebrow">Powód (opcjonalnie)</span>
            <input
              name="reason"
              type="text"
              maxLength={500}
              placeholder="np. wakacje rodzinne"
              className="h-10 rounded-md border border-border bg-background px-3 text-[0.9rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </label>
        </div>

        {state && !state.ok && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[0.86rem] text-destructive">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[0.86rem] text-emerald-700 dark:text-emerald-300">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient px-5 font-sans text-[0.95rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plane size={15} /> Złóż wniosek o urlop
        </button>
      </form>
    </section>
  );
}

function AdminQueue({ items }: { items: PendingForAdminItem[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow inline-flex items-center gap-1.5 text-primary">
          <ShieldCheck size={11} /> Wnioski oczekujące
        </span>
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
          {items.length}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.6rem] font-bold text-white">
              {it.requester.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.requester.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                (it.requester.name ?? it.requester.email).slice(0, 2).toUpperCase()
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-display text-[0.9rem] font-semibold">
                {it.requester.name ?? it.requester.email}
              </span>
              <span className="truncate font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
                {formatDate(it.startDate)} → {formatDate(it.endDate)}
                {it.reason ? ` · ${it.reason}` : ""}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <form
                action={(fd) =>
                  startTransition(() => approveVacationRequestAction(fd))
                }
                className="m-0"
              >
                <input type="hidden" name="id" value={it.id} />
                <button
                  type="submit"
                  title="Zatwierdź wniosek"
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-500 px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-90"
                >
                  <Check size={12} /> Zatwierdź
                </button>
              </form>
              <form
                action={(fd) =>
                  startTransition(() => rejectVacationRequestAction(fd))
                }
                className="m-0"
              >
                <input type="hidden" name="id" value={it.id} />
                <button
                  type="submit"
                  title="Odrzuć wniosek"
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                >
                  <X size={12} /> Odrzuć
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ColleaguesList({
  colleagues,
  currentUserId,
}: {
  colleagues: ColleagueUpcoming[];
  currentUserId: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const onLeave = colleagues.filter((c) => c.upcoming.length > 0);
  const idle = colleagues.filter((c) => c.upcoming.length === 0);
  const visible = showAll ? colleagues : onLeave;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Zespół</span>
          <h2 className="font-display text-[1.2rem] font-bold leading-[1.15] tracking-[-0.02em]">
            Kto ma zaplanowany urlop (90 dni)
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          {showAll ? `Tylko z urlopem (${onLeave.length})` : `Pokaż wszystkich (${colleagues.length})`}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card px-4 py-6 text-center text-[0.86rem] text-muted-foreground">
          Nikt z zespołu nie ma zaplanowanego urlopu w najbliższych 90 dniach.
        </p>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
          {visible.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.62rem] font-bold text-white">
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatarUrl} alt="" width={36} height={36} className="h-full w-full object-cover" />
                ) : (
                  (c.name ?? c.email).slice(0, 2).toUpperCase()
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-display text-[0.92rem] font-semibold tracking-[-0.01em]">
                  {c.name ?? c.email}
                  {c.id === currentUserId && (
                    <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
                      to Ty
                    </span>
                  )}
                </span>
                {c.upcoming.length === 0 ? (
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/70">
                    brak zaplanowanego urlopu
                  </span>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {c.upcoming.map((u) => {
                      const badge = statusBadge(u.status);
                      return (
                        <li key={u.id}>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] ${badge.cls}`}
                          >
                            {formatDate(u.startDate)} → {formatDate(u.endDate)}
                            <span className="opacity-70">· {badge.label}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!showAll && idle.length > 0 && (
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/70">
          {idle.length} osób bez zaplanowanego urlopu (ukryte)
        </p>
      )}
    </section>
  );
}

function MyRequestsList({ items }: { items: MyVacationRequest[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">Moje wnioski</span>
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
          {items.length}
        </span>
      </div>
      <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
        {items.map((it) => {
          const badge = statusBadge(it.status);
          return (
            <li
              key={it.id}
              className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-display text-[0.9rem] font-semibold tracking-[-0.01em]">
                  {formatDate(it.startDate)} → {formatDate(it.endDate)}
                </span>
                {it.reason && (
                  <span className="truncate text-[0.82rem] text-muted-foreground">
                    {it.reason}
                  </span>
                )}
                {it.decidedByName && it.decidedAt && (
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/70">
                    Decyzja: {it.decidedByName} · {formatDate(it.decidedAt)}
                  </span>
                )}
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] ${badge.cls}`}
              >
                {badge.label}
              </span>
              {it.status === "pending" && (
                <form
                  action={(fd) =>
                    startTransition(() => cancelVacationRequestAction(fd))
                  }
                  className="m-0"
                >
                  <input type="hidden" name="id" value={it.id} />
                  <button
                    type="submit"
                    title="Anuluj wniosek"
                    className="inline-flex h-7 items-center rounded-md border border-border bg-card px-2.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                  >
                    Anuluj
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
