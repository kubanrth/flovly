"use client";

import { useActionState, useState, startTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { hueForColor } from "@/components/ui/status-hue";
import {
  IconArrowRight,
  IconCheckCircle,
  IconClose,
  IconMove,
  IconNotes,
  IconPen,
  IconUser,
} from "@/components/ui/icons";
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
    <section className="flex flex-col gap-3">
      <h2 className="text-md font-semibold">Aktywność</h2>

      <NoteComposer workspaceId={workspaceId} dealId={dealId} />

      {activities.length === 0 ? (
        <p className="rounded-lg border border-dashed border-input-border px-4 py-8 text-center text-sm text-muted-foreground">
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
        <p role="alert" className="text-xs text-danger-text">{state.error}</p>
      )}
      <div className="flex items-center justify-end">
        <Button type="submit" size="sm" loading={pending} disabled={pending}>
          {pending ? "Dodaję…" : "Dodaj notatkę"}
        </Button>
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
          <Avatar name={actorLabel} src={actor.avatarUrl} size={26} />
        ) : (
          <span className="grid size-[26px] place-items-center rounded-full bg-n-100 text-muted-foreground">
            <IconUser width={13} height={13} />
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2">
        <div className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{actorLabel}</span>
          <span aria-hidden>·</span>
          <span className="font-mono text-2xs">{date}</span>
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
        <p className="flex items-center gap-1.5 text-sm">
          <IconCheckCircle width={13} height={13} className="text-muted-foreground" />
          Utworzono deal.
        </p>
      );

    case "stage_change": {
      const from = typeof body.from === "string" ? stages[body.from] : null;
      const to = typeof body.to === "string" ? stages[body.to] : null;
      const isWon = to && /wygrane/i.test(to.name);
      const isLost = to && /przegrane/i.test(to.name);
      const Icon = isWon ? IconCheckCircle : isLost ? IconClose : IconMove;
      const iconColor = isWon ? "text-success-text" : isLost ? "text-danger-text" : "text-orange-700";
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <Icon width={13} height={13} className={iconColor} />
          Etap:
          <Chip hue={hueForColor(from?.colorHex)} size="sm">{from?.name ?? "—"}</Chip>
          <IconArrowRight width={12} height={12} className="text-muted-foreground" />
          <Chip hue={hueForColor(to?.colorHex)} size="sm">{to?.name ?? "—"}</Chip>
        </p>
      );
    }

    case "value_change": {
      const fromBody = body.from as Record<string, unknown> | null;
      const toBody = body.to as Record<string, unknown> | null;
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <IconPen width={13} height={13} className="text-muted-foreground" />
          Wartość:
          <code className="rounded-sm bg-n-100 px-1.5 py-0.5 font-mono text-2xs">
            {fromBody ? formatMoney(fromBody.amount, fromBody.currency) : "—"}
          </code>
          <IconArrowRight width={12} height={12} className="text-muted-foreground" />
          <code className="rounded-sm bg-n-100 px-1.5 py-0.5 font-mono text-2xs">
            {toBody ? formatMoney(toBody.amount, toBody.currency) : "—"}
          </code>
        </p>
      );
    }

    case "title_change":
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <IconPen width={13} height={13} className="text-muted-foreground" />
          Tytuł:
          <code className="rounded-sm bg-n-100 px-1.5 py-0.5 font-mono text-2xs">
            {typeof body.from === "string" ? body.from : "—"}
          </code>
          <IconArrowRight width={12} height={12} className="text-muted-foreground" />
          <code className="rounded-sm bg-n-100 px-1.5 py-0.5 font-mono text-2xs">
            {typeof body.to === "string" ? body.to : "—"}
          </code>
        </p>
      );

    case "owner_change": {
      const from = typeof body.from === "string" ? users[body.from] : null;
      const to = typeof body.to === "string" ? users[body.to] : null;
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <IconUser width={13} height={13} className="text-muted-foreground" />
          Opiekun:
          <span className="font-medium">{from ? (from.name ?? from.email) : "—"}</span>
          <IconArrowRight width={12} height={12} className="text-muted-foreground" />
          <span className="font-medium">{to ? (to.name ?? to.email) : "—"}</span>
        </p>
      );
    }

    case "contact_change": {
      const from = typeof body.from === "string" ? contacts[body.from] : null;
      const to = typeof body.to === "string" ? contacts[body.to] : null;
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <IconUser width={13} height={13} className="text-muted-foreground" />
          Kontakt:
          <span className="font-medium">{from?.label ?? "—"}</span>
          <IconArrowRight width={12} height={12} className="text-muted-foreground" />
          <span className="font-medium">{to?.label ?? "—"}</span>
        </p>
      );
    }

    default:
      return (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <IconNotes width={12} height={12} />
          {activity.type}
        </p>
      );
  }
}

