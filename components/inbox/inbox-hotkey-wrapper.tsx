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

// v4: feed chronologiczny grupowany Dziś / Wczoraj / Wcześniej. Wewnątrz każdej
// grupy unread przed read (zachowujemy distinction przez brand dot per row).
function groupChronologically(
  items: InboxNotification[],
): Array<{ key: "today" | "yesterday" | "earlier"; label: string; items: InboxNotification[] }> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  const groups: Record<"today" | "yesterday" | "earlier", InboxNotification[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const n of items) {
    const t = new Date(n.createdAt).getTime();
    if (t >= todayStart) groups.today.push(n);
    else if (t >= yesterdayStart) groups.yesterday.push(n);
    else groups.earlier.push(n);
  }
  return [
    { key: "today", label: "Dziś", items: groups.today },
    { key: "yesterday", label: "Wczoraj", items: groups.yesterday },
    { key: "earlier", label: "Wcześniej", items: groups.earlier },
  ].filter((g) => g.items.length > 0) as Array<{ key: "today" | "yesterday" | "earlier"; label: string; items: InboxNotification[] }>;
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
        <div className="rounded-[22px] border border-dashed border-white/60 bg-white/40 p-10 text-center backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.02]">
          <p className="font-display text-[1.1rem] font-semibold">Pusto.</p>
          <p className="mt-2 text-[0.92rem] text-muted-foreground">
            Jak ktoś Cię oznaczy w komentarzu albo przypisze do zadania, trafi to tutaj.
          </p>
        </div>
        {assign.menu}
      </>
    );
  }

  // Merge wszystko do jednego chronological feedu — distinction unread/read przez brand dot per row.
  const allItems = [...unread, ...read].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const groups = groupChronologically(allItems);

  return (
    <>
      {/* v4: jedna karta rounded-[22px] glass surface z brand-tinted shadow. */}
      <div className="relative overflow-hidden rounded-[22px] border border-white/60 bg-white/55 shadow-[0_30px_70px_-30px_rgba(122,51,236,0.4)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-3 px-4 py-4 md:px-5 md:py-5">
          {groups.map((group, idx) => (
            <section key={group.key} className={idx === 0 ? "" : "mt-2"}>
              <div className="mb-1.5 flex items-center gap-2.5 px-2">
                <span
                  aria-hidden
                  className="h-4 w-[3px] rounded-[2px] bg-brand-gradient"
                />
                <h2 className="text-[0.78rem] font-bold tracking-[-0.01em] text-foreground">
                  {group.label}
                </h2>
                <span className="rounded-full bg-white/40 px-2 py-0.5 font-mono text-[0.66rem] text-muted-foreground dark:bg-white/[0.06]">
                  {group.items.length}
                </span>
              </div>
              <ul className="flex flex-col gap-1">
                {group.items.map((n) => (
                  <li key={n.id}>
                    <NotificationRow notification={n} assign={assign} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* v4 footer: bulk akcja "Oznacz wszystkie jako przeczytane" + bulk delete.
            Mobile: sticky-bottom z safe-area, full-width row. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/50 bg-white/30 px-5 py-3 dark:border-white/[0.06] dark:bg-white/[0.02] max-md:sticky max-md:bottom-0 max-md:z-10 max-md:px-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-md:backdrop-blur-xl">
          <span className="font-mono text-[0.68rem] text-muted-foreground/80">
            {unread.length > 0
              ? `${unread.length} nieprzeczytan${unread.length === 1 ? "a" : "ych"} · ${read.length} przeczytan${read.length === 1 ? "a" : "ych"}`
              : `${read.length} przeczytan${read.length === 1 ? "a" : "ych"}`}
          </span>
          <div className="flex items-center gap-2">
            {unread.length > 0 && (
              <form action={markAllNotificationsReadAction} className="m-0">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/60 bg-white/60 px-3 py-1.5 font-mono text-[0.66rem] font-medium uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary/60 hover:text-primary dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <Check size={11} /> Oznacz wszystkie jako przeczytane
                </button>
              </form>
            )}
            {read.length > 0 && (
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
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-white/60 bg-white/60 px-3 py-1.5 font-mono text-[0.66rem] font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive dark:border-white/10 dark:bg-white/[0.04]"
              >
                <Trash2 size={11} /> Usuń przeczytane
              </button>
            )}
          </div>
        </div>
      </div>

      {assign.menu}
    </>
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
      className="group flex items-start gap-3 rounded-[13px] border border-transparent px-3.5 py-3 transition-all hover:border-white/60 hover:bg-white/60 data-[unread=true]:bg-primary/[0.06] dark:hover:border-white/[0.08] dark:hover:bg-white/[0.04] max-md:gap-3 max-md:px-3 max-md:py-3.5"
    >
      <span
        className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-white max-md:h-10 max-md:w-10 ${
          isPoll
            ? "bg-gradient-to-br from-amber-400 to-rose-500"
            : isAssigned || isSupportResolved
              ? "bg-gradient-to-br from-emerald-400 to-sky-500"
              : isSupportAssigned
                ? "bg-gradient-to-br from-sky-400 to-brand-500"
                : isSupportCreated
                  ? "bg-gradient-to-br from-rose-400 to-brand-500"
                  : "bg-brand-gradient"
        }`}
        aria-hidden
      >
        {isPoll ? (
          <Vote size={15} />
        ) : isAssigned || isSupportAssigned ? (
          <UserPlus size={15} />
        ) : isSupportResolved ? (
          <CheckCircle2 size={15} />
        ) : isSupportCreated ? (
          <CheckCircle2 size={15} />
        ) : (
          <AtSign size={15} />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={href} className="flex flex-col gap-1 focus-visible:outline-none">
          {/* v4 snippet/content: 14px (text-[0.875rem]) */}
          <span className="text-[0.875rem] leading-snug text-muted-foreground group-hover:text-foreground">
            {body}
          </span>
          {snippet && (
            <span className="truncate text-[0.86rem] italic text-muted-foreground/90">„{snippet}"</span>
          )}
          {/* v4 relative time: mono */}
          <span className="font-mono text-[0.7rem] text-muted-foreground/70">
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

      {/* F12-K35: action toolbar — edit-note / toggle read / delete.
          Mobile: always-visible (no hover), wrap below content. */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
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

      {/* v4: status indicator — brand dot dla unread, ukryta dla read. Always visible (nie hover-gated). */}
      {unread && (
        <span
          aria-hidden
          className="mt-2 h-2 w-2 shrink-0 self-start rounded-full bg-brand-gradient shadow-[0_0_10px_rgba(124,92,255,0.5)]"
        />
      )}
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
