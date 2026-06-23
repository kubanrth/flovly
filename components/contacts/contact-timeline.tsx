"use client";

import { useActionState, useState, startTransition } from "react";
import {
  ArrowRight,
  Circle,
  Pencil,
  StickyNote,
  User as UserIcon,
} from "lucide-react";
import {
  createContactNoteAction,
  type ContactNoteState,
} from "@/app/(app)/w/[workspaceId]/contacts/actions";
import {
  RichTextEditor,
  type RichTextDoc,
} from "@/components/task/rich-text-editor";

export interface ContactActivityActor {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface ContactTimelineActivity {
  id: string;
  type: string;
  createdAt: string;
  actor: ContactActivityActor | null;
  body: Record<string, unknown> | null;
}

export interface ContactUserLookup {
  [userId: string]: { name: string | null; email: string };
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

export function ContactTimeline({
  workspaceId,
  contactId,
  activities,
  users,
  canEdit,
}: {
  workspaceId: string;
  contactId: string;
  activities: ContactTimelineActivity[];
  users: ContactUserLookup;
  canEdit: boolean;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="eyebrow">Aktywność</span>
        <h2 className="font-display text-[1.2rem] font-bold leading-[1.15] tracking-[-0.02em]">
          Historia kontaktu
        </h2>
      </div>

      {canEdit && <NoteComposer workspaceId={workspaceId} contactId={contactId} />}

      {activities.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card px-4 py-8 text-center text-[0.86rem] text-muted-foreground">
          Brak aktywności. Dodaj notatkę żeby zapisać co się działo.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {activities.map((a) => (
            <ActivityRow key={a.id} activity={a} users={users} />
          ))}
        </ul>
      )}
    </section>
  );
}

function NoteComposer({
  workspaceId,
  contactId,
}: {
  workspaceId: string;
  contactId: string;
}) {
  const boundAction = createContactNoteAction.bind(null, workspaceId, contactId);
  const [state, formAction, pending] = useActionState<ContactNoteState, FormData>(
    boundAction,
    null,
  );
  const [resetKey, setResetKey] = useState(0);
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
        placeholder="Co się działo — telefon, mail, spotkanie, ustalenia…"
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
          className="inline-flex h-8 items-center rounded-md bg-brand-gradient px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-white shadow-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Dodaję…" : "Dodaj notatkę"}
        </button>
      </div>
    </form>
  );
}

function ActivityRow({
  activity,
  users,
}: {
  activity: ContactTimelineActivity;
  users: ContactUserLookup;
}) {
  const actor = activity.actor;
  const actorLabel = actor ? (actor.name ?? actor.email) : "System";
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
              <img src={actor.avatarUrl} alt="" width={28} height={28} className="h-full w-full object-cover" />
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
        <ActivityBody activity={activity} users={users} />
      </div>
    </li>
  );
}

function ActivityBody({
  activity,
  users,
}: {
  activity: ContactTimelineActivity;
  users: ContactUserLookup;
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
          Kontakt utworzony.
        </p>
      );
    case "field_change": {
      const field = typeof body.field === "string" ? body.field : "?";
      const labels: Record<string, string> = {
        companyName: "Firma",
        name: "Nazwa",
        email: "Email",
        phone: "Telefon",
      };
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-[0.86rem]">
          <Pencil size={12} className="text-muted-foreground" />
          {labels[field] ?? field}:
          <code className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[0.76rem]">
            {typeof body.from === "string" && body.from ? body.from : "—"}
          </code>
          <ArrowRight size={11} className="text-muted-foreground" />
          <code className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[0.76rem]">
            {typeof body.to === "string" && body.to ? body.to : "—"}
          </code>
        </p>
      );
    }
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
    default:
      return (
        <p className="flex items-center gap-1.5 text-[0.86rem] text-muted-foreground">
          <StickyNote size={11} />
          {activity.type}
        </p>
      );
  }
}
