"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import {
  AtSign,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  UserPlus,
  Vote,
  X,
} from "lucide-react";
import {
  useAssignHotkey,
  type AssignMember,
} from "@/components/task/assign-hotkey";
import {
  deleteAllReadNotificationsAction,
  deleteNotificationAction,
  markAllNotificationsReadAction,
  toggleNotificationReadAction,
  updateNotificationNoteAction,
} from "@/app/(app)/inbox/actions";

export interface InboxNotification {
  id: string;
  type: string;
  createdAt: string;
  unread: boolean;
  // User-editowalna adnotacja.
  userNote: string | null;
  // Normalized payload — server picks out only what we render.
  payload: {
    workspaceId?: string;
    taskId?: string;
    taskTitle?: string;
    authorName?: string | null;
    snippet?: string;
    boardName?: string;
    question?: string;
    // Task.assigned typ — actor który przypisał current usera.
    actorName?: string | null;
    // Support.resolved typ.
    ticketId?: string;
    ticketTitle?: string;
    status?: string;
    // Task.status.changed nazwy statusów.
    fromStatusName?: string | null;
    toStatusName?: string | null;
  };
  // Server pre-computes the assigneeIds for the task this
  // notification refers to, so the hotkey popup can mark them as
  // already-assigned. null for non-task notifications.
  assigneeIds: string[] | null;
}

export function InboxHotkeyList({
  members,
  unread,
  read,
}: {
  members: AssignMember[];
  unread: InboxNotification[];
  read: InboxNotification[];
}) {
  const assign = useAssignHotkey({ members, workspaceId: "" });

  const total = unread.length + read.length;

  if (total === 0) {
    return (
      <>
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-display text-[1.1rem] font-semibold">Pusto.</p>
          <p className="mt-2 text-[0.92rem] text-muted-foreground">
            Jak ktoś Cię oznaczy w komentarzu albo przypisze do zadania, trafi to tutaj.
          </p>
        </div>
        {assign.menu}
      </>
    );
  }

  return (
    <>
      {unread.length > 0 && (
        <>
          <div className="flex items-end justify-between gap-4">
            <h2 className="eyebrow text-primary">Nieprzeczytane</h2>
            {unread.length > 0 && (
              <form action={markAllNotificationsReadAction}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                >
                  <Check size={12} /> Oznacz wszystkie jako przeczytane
                </button>
              </form>
            )}
          </div>
          <Bucket items={unread} assign={assign} />
        </>
      )}

      {read.length > 0 && (
        <>
          <div className="flex items-end justify-between gap-4">
            <h2 className="eyebrow text-muted-foreground">Przeczytane</h2>
            {/* F12-K35: bulk-delete przeczytanych. */}
            <button
              type="button"
              onClick={() => {
                if (
                  !confirm(
                    `Usunąć ${read.length} przeczytan${
                      read.length === 1 ? "ą notyfikację" : "ych notyfikacji"
                    }? Tej operacji nie można cofnąć.`,
                  )
                ) {
                  return;
                }
                startTransition(() => {
                  void deleteAllReadNotificationsAction();
                });
              }}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            >
              <Trash2 size={12} /> Usuń przeczytane
            </button>
          </div>
          <Bucket items={read} assign={assign} />
        </>
      )}

      {assign.menu}
    </>
  );
}

function Bucket({
  items,
  assign,
}: {
  items: InboxNotification[];
  assign: ReturnType<typeof useAssignHotkey>;
}) {
  return (
    <ul className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
      {items.map((n) => (
        <li key={n.id} className="border-b border-border last:border-b-0">
          <NotificationRow notification={n} assign={assign} />
        </li>
      ))}
    </ul>
  );
}

function NotificationRow({
  notification,
  assign,
}: {
  notification: InboxNotification;
  assign: ReturnType<typeof useAssignHotkey>;
}) {
  const { payload, type, unread, assigneeIds } = notification;
  const isPoll = type === "poll.created";
  const isAssigned = type === "task.assigned";
  const isSupportResolved = type === "support.resolved";
  const isSupportAssigned = type === "support.assigned";
  const isSupportCreated = type === "support.created";
  const isTaskCreated = type === "task.created";
  const isTaskStatusChanged = type === "task.status.changed";
  const href =
    isSupportResolved || isSupportAssigned || isSupportCreated
      ? payload.workspaceId
        ? `/w/${payload.workspaceId}/support`
        : "/inbox"
      : payload.workspaceId && payload.taskId
        ? `/w/${payload.workspaceId}/t/${payload.taskId}`
        : "/inbox";

  // Only attach hotkey hooks when the notification actually points to a
  // task (and we have its assignee list).
  const hotkeyProps =
    payload.taskId && assigneeIds
      ? assign.rowProps(payload.taskId, assigneeIds)
      : null;

  const body =
    type === "comment.mention" ? (
      <>
        <span className="font-semibold text-foreground">{payload.authorName ?? "Ktoś"}</span>
        {" oznaczył(a) Cię w komentarzu do "}
        <span className="font-semibold text-foreground">{payload.taskTitle ?? "zadania"}</span>.
      </>
    ) : isPoll ? (
      <>
        Na tablicy{" "}
        <span className="font-semibold text-foreground">{payload.boardName ?? "?"}</span>{" "}
        pojawiło się głosowanie w zadaniu{" "}
        <span className="font-semibold text-foreground">{payload.taskTitle ?? "?"}</span>.{" "}
        <span className="text-primary">Przejdź do głosowania →</span>
      </>
    ) : isAssigned ? (
      <>
        <span className="font-semibold text-foreground">{payload.actorName ?? "Ktoś"}</span>
        {" przypisał(a) Cię do zadania "}
        <span className="font-semibold text-foreground">{payload.taskTitle ?? "?"}</span>
        {payload.boardName && (
          <>
            {" na tablicy "}
            <span className="font-semibold text-foreground">{payload.boardName}</span>
          </>
        )}
        .
      </>
    ) : isSupportResolved ? (
      <>
        Twoje zgłoszenie{" "}
        <span className="font-semibold text-foreground">
          {payload.ticketTitle ?? "?"}
        </span>{" "}
        zostało{" "}
        <span className="font-semibold text-emerald-500">
          {payload.status === "RESOLVED" ? "rozwiązane" : "zamknięte"}
        </span>
        {payload.actorName && (
          <>
            {" przez "}
            <span className="font-semibold text-foreground">{payload.actorName}</span>
          </>
        )}
        .
      </>
    ) : isSupportAssigned ? (
      <>
        <span className="font-semibold text-foreground">
          {payload.actorName ?? "Ktoś"}
        </span>
        {" przypisał(a) Cię do zgłoszenia "}
        <span className="font-semibold text-foreground">
          {payload.ticketTitle ?? "?"}
        </span>
        .
      </>
    ) : isSupportCreated ? (
      <>
        Nowe zgłoszenie od{" "}
        <span className="font-semibold text-foreground">
          {payload.actorName ?? "użytkownika"}
        </span>
        :{" "}
        <span className="font-semibold text-foreground">
          {payload.ticketTitle ?? "?"}
        </span>
        .
      </>
    ) : isTaskCreated ? (
      <>
        <span className="font-semibold text-foreground">{payload.actorName ?? "Ktoś"}</span>
        {" stworzył(a) zadanie "}
        <span className="font-semibold text-foreground">{payload.taskTitle ?? "?"}</span>
        {payload.boardName && (
          <>
            {" na tablicy "}
            <span className="font-semibold text-foreground">{payload.boardName}</span>
          </>
        )}
        .
      </>
    ) : isTaskStatusChanged ? (
      <>
        <span className="font-semibold text-foreground">{payload.actorName ?? "Ktoś"}</span>
        {" zmienił(a) status zadania "}
        <span className="font-semibold text-foreground">{payload.taskTitle ?? "?"}</span>
        {payload.fromStatusName || payload.toStatusName ? (
          <>
            {": "}
            <span className="font-mono text-[0.78rem] uppercase tracking-[0.1em] text-muted-foreground">
              {payload.fromStatusName ?? "—"}
            </span>
            {" → "}
            <span className="font-mono text-[0.78rem] uppercase tracking-[0.1em] text-foreground">
              {payload.toStatusName ?? "—"}
            </span>
          </>
        ) : null}
        {payload.boardName && (
          <>
            {" (tablica "}
            <span className="font-semibold text-foreground">{payload.boardName}</span>
            {")"}
          </>
        )}
        .
      </>
    ) : (
      <span className="text-muted-foreground">{type}</span>
    );

  const snippet =
    type === "comment.mention" && payload.snippet
      ? payload.snippet
      : isPoll && payload.question
        ? payload.question
        : null;

  const [editing, setEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState(notification.userNote ?? "");
  const [savedNote, setSavedNote] = useState(notification.userNote);

  const saveNote = () => {
    startTransition(async () => {
      await updateNotificationNoteAction({
        id: notification.id,
        userNote: noteDraft,
      });
      setSavedNote(noteDraft.trim() || null);
      setEditing(false);
    });
  };

  return (
    <div
      data-unread={unread ? "true" : "false"}
      {...(hotkeyProps ?? {})}
      className="group flex items-start gap-3 px-4 py-3 transition-colors data-[unread=true]:bg-primary/[0.04] hover:bg-accent/60"
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
          isPoll
            ? "bg-amber-500/10 text-amber-500"
            : isAssigned || isSupportResolved
              ? "bg-emerald-500/10 text-emerald-500"
              : isSupportAssigned
                ? "bg-blue-500/10 text-blue-500"
                : isSupportCreated
                  ? "bg-rose-500/10 text-rose-500"
                  : "bg-primary/10 text-primary"
        }`}
        aria-hidden
      >
        {isPoll ? (
          <Vote size={14} />
        ) : isAssigned || isSupportAssigned ? (
          <UserPlus size={14} />
        ) : isSupportResolved ? (
          <CheckCircle2 size={14} />
        ) : isSupportCreated ? (
          <CheckCircle2 size={14} />
        ) : (
          <AtSign size={14} />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={href} className="flex flex-col gap-0.5 focus-visible:outline-none">
          <span className="truncate text-[0.92rem] leading-tight text-muted-foreground group-hover:text-foreground">
            {body}
          </span>
          {snippet && (
            <span className="truncate text-[0.86rem] italic text-muted-foreground/90">„{snippet}"</span>
          )}
          <span className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground/80">
            {formatRelative(notification.createdAt)}
          </span>
        </Link>
        {/* F12-K35: user-note display + inline edit. Saved note pokazuje
            się jako 'pinned' badge nad rzędem; klik ołówka otwiera input. */}
        {!editing && savedNote && (
          <div className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[0.84rem] text-foreground">
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
              twoja notatka
            </span>
            <span className="flex-1">{savedNote}</span>
          </div>
        )}
        {editing && (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveNote();
                if (e.key === "Escape") {
                  setNoteDraft(savedNote ?? "");
                  setEditing(false);
                }
              }}
              maxLength={500}
              placeholder="Twoja notatka (priorytet, kontekst…)"
              className="h-8 flex-1 rounded-md border border-primary/40 bg-background px-2 text-[0.84rem] outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={saveNote}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Check size={11} /> Zapisz
            </button>
            <button
              type="button"
              onClick={() => {
                setNoteDraft(savedNote ?? "");
                setEditing(false);
              }}
              aria-label="Anuluj"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* F12-K35: action toolbar — edit-note / toggle read / delete */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={savedNote ? "Edytuj notatkę" : "Dodaj notatkę"}
            title={savedNote ? "Edytuj notatkę" : "Dodaj notatkę"}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Pencil size={12} />
          </button>
        )}
        <form
          action={(fd) =>
            startTransition(() => toggleNotificationReadAction(fd))
          }
          className="m-0"
        >
          <input type="hidden" name="id" value={notification.id} />
          <button
            type="submit"
            aria-label={unread ? "Oznacz jako przeczytane" : "Oznacz jako nieprzeczytane"}
            title={unread ? "Oznacz jako przeczytane" : "Oznacz jako nieprzeczytane"}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {unread ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
        </form>
        <form
          action={(fd) =>
            startTransition(() => deleteNotificationAction(fd))
          }
          onSubmit={(e) => {
            if (!confirm("Usunąć tę notyfikację?")) e.preventDefault();
          }}
          className="m-0"
        >
          <input type="hidden" name="id" value={notification.id} />
          <button
            type="submit"
            aria-label="Usuń"
            title="Usuń"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 size={12} />
          </button>
        </form>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((now - then) / 1000);
  if (diff < 45) return "przed chwilą";
  if (diff < 60 * 60) return `${Math.round(diff / 60)} min temu`;
  if (diff < 60 * 60 * 24) return `${Math.round(diff / 3600)} godz. temu`;
  if (diff < 60 * 60 * 24 * 7) return `${Math.round(diff / 86400)} dni temu`;
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
