"use client";

// B4 karta: tytuł 13/500 + wiersz #ID · priorytet · tagi · podpowiedzi · termin · awatary.
// W trakcie przeciągania miejsce karty zamienia się w pomarańczowy slot docelowy.

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { AvatarStack } from "@/components/ui/avatar";
import { TagChip } from "@/components/ui/chip";
import { IconAttachment, IconComment, IconDoc, IconLink, IconTodo } from "@/components/ui/icons";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { hueForColor } from "@/components/ui/status-hue";
import { PRIORITY_LEVEL } from "@/components/table/priority-picker-cell";
import { isOverdue, memberLabel, type KanbanTask } from "@/components/kanban/kanban-model";

const dayFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });

export interface CardHoverProps {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function CardHints({ task }: { task: KanbanTask }) {
  const items: { key: string; icon: React.ReactNode; text?: string; title: string }[] = [];
  if (task.subtaskCount > 0) items.push({ key: "sub", icon: <IconTodo />, text: `${task.subtaskDoneCount}/${task.subtaskCount}`, title: `${task.subtaskDoneCount} z ${task.subtaskCount} podzadań` });
  if (task.commentCount > 0) items.push({ key: "com", icon: <IconComment />, text: String(task.commentCount), title: `Komentarze: ${task.commentCount}` });
  if (task.attachmentCount > 0) items.push({ key: "att", icon: <IconAttachment />, text: String(task.attachmentCount), title: `Załączniki: ${task.attachmentCount}` });
  if (task.linkedCount > 0) items.push({ key: "lnk", icon: <IconLink />, text: String(task.linkedCount), title: `Powiązane: ${task.linkedCount}` });
  if (task.hasDescription) items.push({ key: "desc", icon: <IconDoc />, title: "Zadanie ma opis" });
  if (items.length === 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-2xs leading-none text-fg-3 [&_svg]:size-[11px]">
      {items.map((i) => (
        <span key={i.key} title={i.title} className="inline-flex items-center gap-0.5">{i.icon}{i.text}</span>
      ))}
    </span>
  );
}

export function KanbanCard({
  task,
  workspaceId,
  dragging,
  mobile,
  hoverProps,
  className,
}: {
  task: KanbanTask;
  workspaceId: string;
  // true tylko dla karty w DragOverlay (kursorowej)
  dragging?: boolean;
  mobile?: boolean;
  hoverProps?: CardHoverProps;
  className?: string;
}) {
  const level = PRIORITY_LEVEL[task.priority];
  const stop = task.stopAt ? new Date(task.stopAt) : null;
  const overdue = isOverdue(task.stopAt);

  return (
    <article
      data-ui="kanban-card"
      data-task-id={task.id}
      {...(hoverProps ?? {})}
      className={cn(
        "relative rounded-lg border border-border bg-card",
        mobile ? "p-3" : "cursor-grab px-3 py-2.5 hover:border-n-300 active:cursor-grabbing",
        dragging && "rotate-2 border-n-300 shadow-e1",
        className,
      )}
    >
      <Link
        href={`/w/${workspaceId}/t/${task.id}`}
        // Bez tego pointerdown na tytule startuje przeciąganie zamiast kliknięcia.
        onPointerDown={(e) => e.stopPropagation()}
        lang="pl"
        className={cn(
          "block font-medium text-foreground hyphens-auto outline-none hover:text-orange-800 active:text-orange-900",
          mobile ? "mb-2 text-base leading-[19px]" : "mb-2 text-sm leading-[18px]",
        )}
      >
        {task.title}
      </Link>
      <div className="flex items-center gap-1.5 overflow-hidden">
        {task.displayId > 0 && <span className="shrink-0 font-mono text-2xs leading-none text-fg-3">#{task.displayId}</span>}
        {level !== null && <PriorityIcon level={level} size={13} className="shrink-0" />}
        {task.tags.slice(0, 2).map((t) => (
          <TagChip key={t.id} label={t.name} hue={hueForColor(t.colorHex)} size={mobile ? "md" : "sm"} className="min-w-0 overflow-hidden" />
        ))}
        <CardHints task={task} />
        {stop && (
          <span className={cn("ml-auto shrink-0 pl-1 text-2xs leading-none", overdue ? "font-medium text-danger-text" : "text-fg-2")}>
            {dayFmt.format(stop)}
          </span>
        )}
        {task.assignees.length > 0 && (
          <AvatarStack
            people={task.assignees.map((a) => ({ name: memberLabel(a), src: a.avatarUrl }))}
            size={mobile ? 24 : 20}
            max={3}
            className={cn("shrink-0", !stop && "ml-auto")}
          />
        )}
      </div>
    </article>
  );
}

// Karta w kolumnie: przeciągalna; w trakcie własnego przeciągania renderuje slot docelowy.
export function SortableKanbanCard({
  task,
  workspaceId,
  disabled,
  hoverProps,
}: {
  task: KanbanTask;
  workspaceId: string;
  disabled?: boolean;
  hoverProps?: CardHoverProps;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled });
  const style = { transform: CSS.Transform.toString(transform), transition };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        data-ui="kanban-drop-slot"
        aria-hidden="true"
        className="h-16 rounded-lg border-[1.5px] border-dashed border-orange-500 bg-orange-50"
      />
    );
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard task={task} workspaceId={workspaceId} hoverProps={hoverProps} />
    </div>
  );
}
