"use client";

import Link from "next/link";
import type { ReactNode, Ref } from "react";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { PRIORITY_LEVEL } from "@/components/table/priority-picker-cell";
import { hueForColor } from "@/components/ui/status-hue";
import { useToast } from "@/components/ui/toast";
import {
  IconBell,
  IconCheck,
  IconClose,
  IconEye,
  IconEyeOff,
  IconPen,
  IconSupport,
  IconTasks,
  IconTrash,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import {
  deleteNotificationAction,
  toggleNotificationReadAction,
  updateNotificationNoteAction,
} from "@/app/(app)/inbox/actions";
import type { InboxItem } from "./inbox-model";

const LINK =
  "rounded-[2px] font-medium text-link no-underline outline-none hover:text-orange-800 hover:underline active:text-orange-900";
const ICON_BTN =
  "grid size-6 place-items-center rounded-sm text-fg-3 outline-none hover:bg-n-200 hover:text-foreground active:bg-n-300";

// System notifications (no human actor) get a square tile instead of an avatar.
const TILE: Record<string, { hue: string; icon: ReactNode }> = {
  "poll.created": { hue: "bg-chip-purple-bg text-chip-purple-fg", icon: <IconTasks width={14} height={14} /> },
  "support.created": { hue: "bg-chip-blue-bg text-chip-blue-fg", icon: <IconSupport width={14} height={14} /> },
  "support.assigned": { hue: "bg-chip-blue-bg text-chip-blue-fg", icon: <IconSupport width={14} height={14} /> },
  "support.resolved": { hue: "bg-chip-green-bg text-chip-green-fg", icon: <IconCheck width={14} height={14} /> },
};

// „Przesuń termin” presets — patchTaskAction keeps the original time of day.
const SNOOZE: [string, number][] = [["Jutro", 1], ["Za 3 dni", 3], ["Za tydzień", 7]];

function TaskLink({ item }: { item: InboxItem }) {
  if (!item.task) return <span className="font-medium">{item.subject ?? "zadania"}</span>;
  return (
    <Link href={item.href} className={LINK}>
      #{item.task.displayId} {item.task.title}
    </Link>
  );
}

const Who = ({ name }: { name: string | null }) => <strong className="font-semibold">{name ?? "Ktoś"}</strong>;

function Body({ item }: { item: InboxItem }) {
  switch (item.type) {
    case "comment.mention":
      return (
        <>
          <Who name={item.actorName} /> wspomniał(a) Cię w komentarzu do <TaskLink item={item} />
        </>
      );
    case "task.assigned":
      return (
        <>
          <Who name={item.actorName} /> przypisał(a) Cię do <TaskLink item={item} />
        </>
      );
    case "task.created":
      return (
        <>
          <Who name={item.actorName} /> utworzył(a) <TaskLink item={item} />
        </>
      );
    case "task.status.changed":
      return (
        <>
          <Who name={item.actorName} /> przeniósł(-osła) <TaskLink item={item} />
          {item.toStatusName ? (
            <>
              {" "}
              z <span className="font-medium">{item.fromStatusName ?? "—"}</span> do{" "}
              <span className="font-medium">{item.toStatusName}</span>
            </>
          ) : null}
        </>
      );
    case "poll.created":
      return (
        <>
          Nowe głosowanie w <TaskLink item={item} />
        </>
      );
    case "support.created":
      return (
        <>
          Nowe zgłoszenie od <Who name={item.actorName} />:{" "}
          <Link href={item.href} className={LINK}>
            {item.ticketTitle ?? "zgłoszenie"}
          </Link>
        </>
      );
    case "support.assigned":
      return (
        <>
          <Who name={item.actorName} /> przypisał(a) Cię do zgłoszenia{" "}
          <Link href={item.href} className={LINK}>
            {item.ticketTitle ?? "zgłoszenie"}
          </Link>
        </>
      );
    case "support.resolved":
      return (
        <>
          Twoje zgłoszenie{" "}
          <Link href={item.href} className={LINK}>
            {item.ticketTitle ?? "zgłoszenie"}
          </Link>{" "}
          zostało{" "}
          <strong className="font-semibold text-success-text">
            {item.ticketStatus === "RESOLVED" ? "rozwiązane" : "zamknięte"}
          </strong>
        </>
      );
    default:
      return <span className="text-muted-foreground">{item.type}</span>;
  }
}

export function InboxCard({
  item,
  active,
  cardRef,
  hotkeyProps,
}: {
  item: InboxItem;
  active: boolean;
  cardRef?: Ref<HTMLElement>;
  hotkeyProps?: { onMouseEnter: () => void; onMouseLeave: () => void };
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.userNote ?? "");
  const tile = item.actorName ? null : (TILE[item.type] ?? { hue: "bg-chip-gray-bg text-chip-gray-fg", icon: <IconBell width={14} height={14} /> });

  const saveNote = () => {
    startTransition(async () => {
      const res = await updateNotificationNoteAction({ id: item.id, userNote: draft });
      if (!res.ok) toast.add({ title: "Nie zapisano notatki", description: res.error });
      setEditing(false);
    });
  };

  const snooze = (days: number) => {
    const task = item.task;
    if (!task?.dueAt) return;
    const next = new Date(task.dueAt);
    next.setDate(next.getDate() + days);
    const fd = new FormData();
    fd.set("id", task.id);
    fd.set("stopAt", next.toISOString());
    startTransition(async () => {
      try {
        await patchTaskAction(fd);
        router.refresh();
      } catch (e) {
        toast.add({ title: "Nie przesunięto terminu", description: e instanceof Error ? e.message : undefined });
      }
    });
  };

  return (
    <article
      ref={cardRef}
      data-ui="inbox-card"
      data-unread={item.unread ? "true" : "false"}
      tabIndex={-1}
      aria-current={active ? "true" : undefined}
      {...hotkeyProps}
      className={cn(
        "group relative flex gap-2.5 rounded-lg border p-3 outline-none",
        item.unread
          ? "border-border bg-selected shadow-[inset_2px_0_0_var(--orange-500)]"
          : "border-n-100 bg-card hover:border-border",
      )}
    >
      {tile ? (
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", tile.hue)} aria-hidden>
          {tile.icon}
        </span>
      ) : (
        <Avatar name={item.actorName!} size={28} className={cn("shrink-0", !item.unread && "opacity-70")} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <p className={cn("text-sm leading-[19px]", !item.unread && "text-n-700")}>
          <Body item={item} />
        </p>

        {item.quote && (
          <p className="mt-1 border-l-2 border-border pl-2 text-xs leading-[18px] text-muted-foreground">{item.quote}</p>
        )}

        {item.type === "task.assigned" && item.task && (item.task.statusName || PRIORITY_LEVEL[item.task.priority] !== null) && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {item.task.statusName && (
              <Chip hue={hueForColor(item.task.statusColor ?? "")} dot size="md">
                {item.task.statusName}
              </Chip>
            )}
            {PRIORITY_LEVEL[item.task.priority] !== null && (
              <PriorityIcon level={PRIORITY_LEVEL[item.task.priority]!} size={13} />
            )}
          </div>
        )}

        {item.userNote && !editing && (
          <p className="mt-1.5 flex items-start gap-1.5 rounded-sm bg-chip-yellow-bg px-2 py-1 text-xs text-chip-yellow-fg">
            <span className="eyebrow shrink-0 text-chip-yellow-fg">Notatka</span>
            <span className="min-w-0 flex-1">{item.userNote}</span>
          </p>
        )}

        {editing && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Input
              autoFocus
              size="sm"
              value={draft}
              maxLength={500}
              placeholder="Twoja notatka (priorytet, kontekst…)"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveNote();
                if (e.key === "Escape") {
                  setDraft(item.userNote ?? "");
                  setEditing(false);
                }
              }}
              className="flex-1"
            />
            <Button size="sm" onClick={saveNote}>
              Zapisz
            </Button>
            <Button size="sm" variant="ghost" iconOnly aria-label="Anuluj" onClick={() => setEditing(false)}>
              <IconClose />
            </Button>
          </div>
        )}

        <div className="mt-1.5 flex items-center gap-2">
          {item.task && (
            <Button variant="secondary" size="sm" className="h-6 px-[9px] text-2xs" render={<Link href={item.href} />}>
              Otwórz zadanie
            </Button>
          )}
          {item.task?.dueAt && (
            <Menu>
              <MenuTrigger render={<Button variant="secondary" size="sm" className="h-6 px-[9px] text-2xs" />}>
                Przesuń termin
              </MenuTrigger>
              <MenuContent className="min-w-[168px]">
                {SNOOZE.map(([label, days]) => (
                  <MenuItem key={label} onClick={() => snooze(days)}>
                    {label}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          )}
          {item.task?.dueText && (
            <span className="text-2xs text-danger-text">termin: {item.task.dueText}</span>
          )}
          <span className="ml-auto shrink-0 font-mono text-[10px] leading-4 text-fg-3">
            {item.when}
            {item.context ? ` · ${item.context}` : ""}
          </span>
        </div>
      </div>

      {/* Overlay, not a flex child: the mockup has no action column, so keeping them
          out of flow leaves the timestamp flush right exactly like D1. */}
      <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-sm bg-inherit pl-1 opacity-0 transition-opacity duration-100 ease-out focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={item.userNote ? "Edytuj notatkę" : "Dodaj notatkę"}
            className={ICON_BTN}
          >
            <IconPen width={13} height={13} />
          </button>
        )}
        <form action={(fd) => startTransition(() => void toggleNotificationReadAction(fd))} className="m-0">
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            aria-label={item.unread ? "Oznacz jako przeczytane" : "Oznacz jako nieprzeczytane"}
            className={ICON_BTN}
          >
            {item.unread ? <IconEye width={13} height={13} /> : <IconEyeOff width={13} height={13} />}
          </button>
        </form>
        <form
          action={(fd) => startTransition(() => void deleteNotificationAction(fd))}
          onSubmit={(e) => {
            if (!confirm("Usunąć to powiadomienie?")) e.preventDefault();
          }}
          className="m-0"
        >
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            aria-label="Usuń powiadomienie"
            className={cn(ICON_BTN, "hover:bg-chip-red-bg hover:text-danger-text")}
          >
            <IconTrash width={13} height={13} />
          </button>
        </form>
      </div>

      {item.unread && <span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-orange-500" />}
    </article>
  );
}
