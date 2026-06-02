"use client";

import { useActionState, useState, startTransition } from "react";
import {
  ArrowRight,
  Circle,
  CircleCheck,
  CircleX,
  MoveRight,
  Pencil,
  StickyNote,
  User as UserIcon,
} from "lucide-react";
import {
  createDealNoteAction,
  type DealNoteState,
} from "@/app/(app)/w/[workspaceId]/sales/actions";
import { RichTextEditor, type RichTextDoc } from "@/components/task/rich-text-editor";

export interface ActivityActor {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface TimelineActivity {
  id: string;
  type: string;
  createdAt: string;
  actor: ActivityActor | null;
  body: Record<string, unknown> | null;
}

export interface StageLookup {
  [stageId: string]: { name: string; colorHex: string };
}

export interface UserLookup {
  [userId: string]: { name: string | null; email: string };
}

export interface ContactLookup {
  [contactId: string]: { label: string };
}

const PL_MONEY = new Intl.NumberFormat("pl-PL", {
  maximumFractionDigits: 2,
});
function formatMoney(amount: unknown, currency: unknown): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "—";
  return `${PL_MONEY.format(amount)} ${typeof currency === "string" ? currency : ""}`.trim();
}

function formatRelativeDate(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "przed chwilą";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min temu`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} h temu`;
  if (diff < 7 * 86_400_000) return `${Math.round(diff / 86_400_000)} d temu`;
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function DealTimeline({
  workspaceId,
  dealId,
  activities,
  stages,
  users,
  contacts,
}: {
  workspaceId: string;
  dealId: string;
  activities: TimelineActivity[];
  stages: StageLookup;
  users: UserLookup;
  contacts: ContactLookup;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="eyebrow">Timeline</span>
        <h2 className="font-display text-[1.2rem] font-bold leading-[1.15] tracking-[-0.02em]">
          Aktywność
        </h2>
      </div>

      <NoteComposer workspaceId={workspaceId} dealId={dealId} />

      {activities.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card px-4 py-8 text-center text-[0.86rem] text-muted-foreground">
          Jeszcze nic się tu nie wydarzyło. Dodaj notatkę powyżej.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {activities.map((a) => (
            <ActivityRow
              key={a.id}
              activity={a}
              stages={stages}
              users={users}
              contacts={contacts}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NoteComposer({
  workspaceId,
  dealId,
}: {
  workspaceId: string;
  dealId: string;
}) {
  const boundAction = createDealNoteAction.bind(null, workspaceId, dealId);
  const [state, formAction, pending] = useActionState<DealNoteState, FormData>(
    boundAction,
    null,
  );
  const [resetKey, setResetKey] = useState(0);

  // Clear the editor by remounting it (new key) when a note saved successfully —
  // RichTextEditor manages its own state, so external clears need a remount.
  if (state?.ok) {
    setTimeout(() => setResetKey((k) => k + 1), 0);
  }

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
    >
      <RichTextEditor
        key={resetKey}
        name="bodyJson"
        initial={null}
        readOnly={false}
        placeholder="Dopisz notatkę o tym co się działo — telefon, mail, ustalenia…"
      />
      {state && !state.ok && (
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-8 items-center rounded-md bg-brand-gradient px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-white shadow-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Dodaję…" : "Dodaj notatkę"}
        </button>
      </div>
    </form>
  );
}

function ActivityRow({
  activity,
  stages,
  users,
  contacts,
}: {
  activity: TimelineActivity;
  stages: StageLookup;
  users: UserLookup;
  contacts: ContactLookup;
}) {
  const actor = activity.actor;
  const actorLabel = actor ? actor.name ?? actor.email : "System";
  const date = formatRelativeDate(activity.createdAt);

  return (
    <li className="flex gap-3">
      <div className="flex shrink-0 flex-col items-center pt-1">
        {actor ? (
          <span
            title={actorLabel}
            className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.62rem] font-bold text-white"
          >
            {actor.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={actor.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              actorLabel.slice(0, 2).toUpperCase()
            )}
          </span>
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-muted-foreground">
            <UserIcon size={12} />
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-md border border-border bg-card px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
          <span className="text-foreground">{actorLabel}</span>
          <span>·</span>
          <span>{date}</span>
        </div>
        <ActivityBody activity={activity} stages={stages} users={users} contacts={contacts} />
      </div>
    </li>
  );
}

function ActivityBody({
  activity,
  stages,
  users,
  contacts,
}: {
  activity: TimelineActivity;
  stages: StageLookup;
  users: UserLookup;
  contacts: ContactLookup;
}) {
  const body = activity.body ?? {};

  switch (activity.type) {
    case "note":
      return (
        <div className="mt-1">
          <RichTextEditor
            initial={(body as RichTextDoc) ?? null}
            readOnly={true}
            variant="display"
          />
        </div>
      );

    case "created":
      return (
        <p className="flex items-center gap-1.5 text-[0.86rem]">
          <Circle size={11} className="text-muted-foreground" />
          Utworzono deal.
        </p>
      );

    case "stage_change": {
      const from = typeof body.from === "string" ? stages[body.from] : null;
      const to = typeof body.to === "string" ? stages[body.to] : null;
      const isWon = to && /wygrane/i.test(to.name);
      const isLost = to && /przegrane/i.test(to.name);
      const Icon = isWon ? CircleCheck : isLost ? CircleX : MoveRight;
      const iconColor = isWon
        ? "text-emerald-500"
        : isLost
          ? "text-destructive"
          : "text-primary";
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-[0.86rem]">
          <Icon size={12} className={iconColor} />
          Etap:
          <Pill label={from?.name ?? "—"} color={from?.colorHex ?? "#94A3B8"} />
          <ArrowRight size={11} className="text-muted-foreground" />
          <Pill label={to?.name ?? "—"} color={to?.colorHex ?? "#94A3B8"} />
        </p>
      );
    }

    case "value_change": {
      const fromBody = body.from as Record<string, unknown> | null;
      const toBody = body.to as Record<string, unknown> | null;
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-[0.86rem]">
          <Pencil size={12} className="text-muted-foreground" />
          Wartość:
          <code className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[0.76rem]">
            {fromBody ? formatMoney(fromBody.amount, fromBody.currency) : "—"}
          </code>
          <ArrowRight size={11} className="text-muted-foreground" />
          <code className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[0.76rem]">
            {toBody ? formatMoney(toBody.amount, toBody.currency) : "—"}
          </code>
        </p>
      );
    }

    case "title_change":
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-[0.86rem]">
          <Pencil size={12} className="text-muted-foreground" />
          Tytuł:
          <code className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[0.76rem]">
            {typeof body.from === "string" ? body.from : "—"}
          </code>
          <ArrowRight size={11} className="text-muted-foreground" />
          <code className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[0.76rem]">
            {typeof body.to === "string" ? body.to : "—"}
          </code>
        </p>
      );

    case "owner_change": {
      const from = typeof body.from === "string" ? users[body.from] : null;
      const to = typeof body.to === "string" ? users[body.to] : null;
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-[0.86rem]">
          <UserIcon size={12} className="text-muted-foreground" />
          Opiekun:
          <span className="font-medium">{from ? (from.name ?? from.email) : "—"}</span>
          <ArrowRight size={11} className="text-muted-foreground" />
          <span className="font-medium">{to ? (to.name ?? to.email) : "—"}</span>
        </p>
      );
    }

    case "contact_change": {
      const from = typeof body.from === "string" ? contacts[body.from] : null;
      const to = typeof body.to === "string" ? contacts[body.to] : null;
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-[0.86rem]">
          <UserIcon size={12} className="text-muted-foreground" />
          Kontakt:
          <span className="font-medium">{from?.label ?? "—"}</span>
          <ArrowRight size={11} className="text-muted-foreground" />
          <span className="font-medium">{to?.label ?? "—"}</span>
        </p>
      );
    }

    default:
      return (
        <p className="flex items-center gap-1.5 text-[0.86rem] text-muted-foreground">
          <StickyNote size={11} />
          {activity.type}
        </p>
      );
  }
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex h-5 items-center rounded-full px-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em]"
      style={{ color, background: `${color}22` }}
    >
      {label}
    </span>
  );
}
