"use client";

import { useActionState, useState, startTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconArrowRight, IconInfo, IconNotes, IconPen, IconUser } from "@/components/ui/icons";
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
        <h2 className="text-md font-semibold">Historia kontaktu</h2>
      </div>

      {canEdit && <NoteComposer workspaceId={workspaceId} contactId={contactId} />}

      {activities.length === 0 ? (
        <p className="rounded-lg border border-dashed border-input-border bg-card px-4 py-8 text-center text-xs text-muted-foreground">
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
        <p className="text-xs text-danger-text">{state.error}</p>
      )}
      <div className="flex items-center justify-end">
        <Button type="submit" size="sm" loading={pending}>
          {pending ? "Dodaję…" : "Dodaj notatkę"}
        </Button>
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
          <Avatar name={actorLabel} src={actor.avatarUrl} size={28} />
        ) : (
          <span className="grid size-7 place-items-center rounded-full bg-n-100 text-muted-foreground">
            <IconUser width={12} height={12} />
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-md border border-border bg-card px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-2xs text-muted-foreground">
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
        <p className="flex items-center gap-1.5 text-sm">
          <IconInfo width={12} height={12} className="text-muted-foreground" />
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
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <IconPen width={12} height={12} className="text-muted-foreground" />
          {labels[field] ?? field}:
          <code className="rounded-sm bg-n-100 px-1.5 py-0.5 font-mono text-xs">
            {typeof body.from === "string" && body.from ? body.from : "—"}
          </code>
          <IconArrowRight width={12} height={12} className="text-muted-foreground" />
          <code className="rounded-sm bg-n-100 px-1.5 py-0.5 font-mono text-xs">
            {typeof body.to === "string" && body.to ? body.to : "—"}
          </code>
        </p>
      );
    }
    case "owner_change": {
      const from = typeof body.from === "string" ? users[body.from] : null;
      const to = typeof body.to === "string" ? users[body.to] : null;
      return (
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <IconUser width={12} height={12} className="text-muted-foreground" />
          Opiekun:
          <span className="font-medium">{from ? (from.name ?? from.email) : "—"}</span>
          <IconArrowRight width={12} height={12} className="text-muted-foreground" />
          <span className="font-medium">{to ? (to.name ?? to.email) : "—"}</span>
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
