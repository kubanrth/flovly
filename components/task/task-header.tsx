"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/dropdown-menu";
import { IconChevronLeft, IconClose, IconCopy, IconExpand, IconMore, IconTrash } from "@/components/ui/icons";
import { SendEmailDialog } from "@/components/task/send-email-dialog";
import { MoveTaskMenu, type MoveTargetBoard } from "@/components/task/move-task-menu";
import { StatusChipMenu, PriorityChipMenu, type StatusOption } from "@/components/task/status-chip-menu";
import { useTaskShell, type TaskViewMode } from "@/components/task/task-shell-context";
import type { TaskPriorityValue } from "@/lib/task-priority";
import { cn } from "@/lib/utils";

export interface TaskHeaderProps {
  mode: TaskViewMode;
  workspaceId: string;
  boardId: string;
  workspaceBoards: MoveTargetBoard[];
  task: { id: string; displayId: number; title: string; statusColumnId: string | null; priority: TaskPriorityValue };
  statusColumns: StatusOption[];
  attachments: { id: string; filename: string; sizeBytes: number }[];
  canEdit: boolean;
  canDelete: boolean;
  onMutate?: () => void;
}

// Header actions: Wyślij mailem · Przenieś · ⤢ · ⋯ (Kopiuj link, Usuń) · ✕. Icon-only in the 600 panel (B2).
export function TaskActions({ mode, workspaceId, boardId, workspaceBoards, task, attachments, canEdit, canDelete, iconOnly }: TaskHeaderProps & { iconOnly?: boolean }) {
  const shell = useTaskShell();
  const [copied, setCopied] = useState(false);
  const compact = iconOnly ?? mode === "panel";
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/w/${workspaceId}/t/${task.id}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  const remove = () => {
    const fd = new FormData();
    fd.set("id", task.id);
    fd.set("workspaceId", workspaceId);
    startTransition(() => deleteTaskAction(fd));
  };
  return (
    <div className="flex shrink-0 items-center gap-1" data-ui="task-actions">
      {copied && <span className="mr-1 text-2xs text-fg-3" aria-live="polite">Skopiowano</span>}
      {canEdit && <SendEmailDialog taskId={task.id} taskTitle={task.title} attachments={attachments} iconOnly={compact} />}
      {canEdit && workspaceBoards.length > 1 && <MoveTaskMenu taskId={task.id} currentBoardId={boardId} availableBoards={workspaceBoards} iconOnly={compact} />}
      {mode !== "page" && (
        // window.location (not router.push): escapes the intercepting modal route so the real page.tsx resolves (F12-K119).
        <Button variant="ghost" size="sm" iconOnly aria-label="Pełny widok" title="Pełny widok" onClick={() => window.location.assign(`/w/${workspaceId}/t/${task.id}`)}><IconExpand /></Button>
      )}
      <Menu>
        <MenuTrigger render={<Button variant="ghost" size="sm" iconOnly aria-label="Więcej" title="Więcej" />}><IconMore /></MenuTrigger>
        <MenuContent align="end">
          <MenuItem icon={<IconCopy />} onClick={copyLink}>Kopiuj link</MenuItem>
          {canDelete && <><MenuSeparator /><MenuItem destructive icon={<IconTrash />} onClick={remove}>Usuń</MenuItem></>}
        </MenuContent>
      </Menu>
      {shell && <Button variant="ghost" size="sm" iconOnly aria-label="Zamknij" title="Zamknij" onClick={shell.close}><IconClose /></Button>}
    </div>
  );
}

// Panel 44px / modal 48px header: #ID mono · status chip · priority chip · spacer · actions.
export function TaskHeader(props: TaskHeaderProps) {
  const { mode, task, statusColumns, canEdit, onMutate } = props;
  return (
    <div className={cn("flex shrink-0 items-center gap-2 border-b border-border", mode === "modal" ? "h-12 px-4" : "h-11 px-3")} data-ui="task-header">
      <span className="font-mono text-xs text-n-600">#{task.displayId || "—"}</span>
      <StatusChipMenu taskId={task.id} statusColumns={statusColumns} value={task.statusColumnId} canEdit={canEdit} onMutate={onMutate} />
      <PriorityChipMenu taskId={task.id} value={task.priority} canEdit={canEdit} onMutate={onMutate} />
      <span className="flex-1" />
      <TaskActions {...props} />
    </div>
  );
}

// Full page 44px bar: Przestrzeń / Tablica / #ID + actions.
export function TaskPageBar(props: TaskHeaderProps & { workspaceName: string; boardName: string }) {
  const { workspaceId, boardId, workspaceName, boardName, task } = props;
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-8" data-ui="task-page-bar">
      <Breadcrumb items={[
        { label: workspaceName, href: `/w/${workspaceId}` },
        { label: boardName, href: `/w/${workspaceId}/b/${boardId}/table` },
        { label: <span className="font-mono text-xs">#{task.displayId || "—"}</span> },
      ]} />
      <span className="flex-1" />
      <TaskActions {...props} iconOnly={false} />
    </div>
  );
}

// Mobile 48px header: ← · #ID · spacer · mail · move · ⋯ · ✕
export function TaskMobileHeader(props: TaskHeaderProps) {
  const shell = useTaskShell();
  const router = useRouter();
  const { task } = props;
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-2" data-ui="task-header">
      <Button variant="ghost" size="lg" iconOnly aria-label="Wstecz" onClick={() => (shell ? shell.close() : router.back())} className="size-11"><IconChevronLeft /></Button>
      <span className="font-mono text-sm text-n-600">#{task.displayId || "—"}</span>
      <span className="flex-1" />
      <TaskActions {...props} iconOnly />
    </div>
  );
}
