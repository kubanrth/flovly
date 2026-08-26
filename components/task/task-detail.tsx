"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/generated/prisma/enums";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import type { RichTextDoc } from "@/components/task/rich-text-editor";
import { DescriptionSection } from "@/components/task/description-section";
import { SubtasksSection, type SubtaskItem } from "@/components/task/subtasks-section";
import { AttachmentsSection, type AttachmentItem } from "@/components/task/attachments-section";
import { LinkedTasksSection } from "@/components/task/linked-tasks-section";
import { PollSection, type PollData } from "@/components/task/poll-section";
import { CommentComposer, type CommentItem } from "@/components/task/comments-section";
import type { ActivityEntry } from "@/components/task/activity-log";
import { TaskActivity } from "@/components/task/task-activity";
import { TaskHeader, TaskMobileHeader, TaskPageBar, type TaskHeaderProps } from "@/components/task/task-header";
import { StatusChipMenu, PriorityChipMenu } from "@/components/task/status-chip-menu";
import { TaskDetailsCard, TaskDetailsColumn, type TaskDetailsProps } from "@/components/task/task-details-column";
import { readTaskMeta, type TaskMeta } from "@/components/task/task-detail-reads";
import { useTaskShell, type TaskViewMode } from "@/components/task/task-shell-context";
import type { MoveTargetBoard } from "@/components/task/move-task-menu";
import type { TaskPriorityValue } from "@/lib/task-priority";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { AvatarStack } from "@/components/ui/avatar";
import { IconWarning } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface TaskDetailProps {
  workspaceId: string;
  role: Role;
  task: {
    id: string;
    displayId: number; // human per-workspace ID
    title: string;
    descriptionJson: RichTextDoc | null;
    statusColumnId: string | null;
    priority: TaskPriorityValue;
    milestoneId: string | null;
    startAt: string | null;
    stopAt: string | null;
    reminderAt: string | null;
    reminderOffset: string | null;
    recurrenceRule: { freq: "daily" | "weekly" | "monthly"; day?: number } | null;
    recurrenceParentId: string | null;
    timeTrackedSeconds: number;
    timerStartedAt: string | null;
    timerCompletedAt: string | null;
  };
  statusColumns: { id: string; name: string; colorHex: string }[];
  milestones: { id: string; title: string; startAt: string; stopAt: string }[];
  allMembers: { id: string; name: string | null; email: string; avatarUrl: string | null }[];
  assigneeIds: Set<string>;
  allTags: { id: string; name: string; colorHex: string }[];
  tagIds: Set<string>;
  canEdit: boolean;
  canDelete: boolean;
  comments: CommentItem[];
  canComment: boolean;
  canModerateComments: boolean;
  currentUserId: string;
  activity: ActivityEntry[];
  attachments: AttachmentItem[];
  canUpload: boolean;
  canModerateAttachments: boolean;
  subtasks: SubtaskItem[];
  canManageSubtasks: boolean;
  poll: PollData | null;
  canManagePoll: boolean;
  canVote: boolean;
  customColumns: { id: string; name: string; type: import("@/lib/table-fields").FieldType; options: unknown }[];
  customValues: Record<string, string>;
  linkedTasks: LinkedTaskItem[];
  linkCandidates: LinkCandidate[];
  boardId: string;
  workspaceBoards: MoveTargetBoard[];
  contactId: string | null;
  workspaceContacts: { id: string; label: string }[];
  // Redesign extras (read by page.tsx via readTaskMeta; optional so lib/task-fetch stays untouched).
  meta?: TaskMeta | null;
  mode?: TaskViewMode;
}

export interface LinkedTaskItem {
  linkId: string;
  task: { id: string; title: string; displayId: number; primaryAssignee: { id: string; name: string | null; email: string; avatarUrl: string | null } | null };
}
export interface LinkCandidate { id: string; title: string; displayId: number }

// Task view in 3 modes (B2): side panel 600 / modal 960 / full page — plus the mobile full-screen layout.
export function TaskDetail(props: TaskDetailProps) {
  const { workspaceId, task, canEdit, meta, allMembers, currentUserId, activity } = props;
  const shell = useTaskShell();
  const router = useRouter();
  const isMobile = useIsMobile();
  const mode: TaskViewMode = props.mode ?? shell?.mode ?? "page";
  const rootRef = useRef<HTMLDivElement>(null);

  // ── Optimistic-lock conflict (AK73). `seenVersion` = version this card was rendered from; our own
  // mutations bump it too (selfMutations > 0 → adopt silently), anything else = someone else edited.
  const seenVersion = useRef<number | undefined>(meta?.version);
  const selfMutations = useRef(0);
  const [conflict, setConflict] = useState(false);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    const v = meta?.version;
    if (v === undefined || seenVersion.current === undefined || v === seenVersion.current) { seenVersion.current = v; return; }
    if (selfMutations.current > 0) { selfMutations.current = 0; seenVersion.current = v; return; }
    setConflict(true);
  }, [meta?.version]);
  const onMutate = () => { selfMutations.current += 1; };
  const refresh = () => {
    seenVersion.current = meta?.version;
    selfMutations.current = 0;
    setConflict(false);
    setFormKey((k) => k + 1);
    router.refresh();
  };

  // Title: autosave on blur / Enter. Pre-check the server version so a stale card never overwrites (K96 + AK73).
  const saveTitle = (next: string) => {
    if (!canEdit || !next || next === task.title) return;
    startTransition(async () => {
      if (seenVersion.current !== undefined) {
        const fresh = await readTaskMeta(workspaceId, task.id);
        // Our own not-yet-refreshed mutations bumped the version too, so compare
        // against seen + pending; a bigger jump means somebody else edited.
        if (fresh) {
          if (fresh.version !== seenVersion.current + selfMutations.current) { setConflict(true); return; }
          seenVersion.current = fresh.version;
          selfMutations.current = 0;
        }
      }
      onMutate();
      const fd = new FormData();
      fd.set("id", task.id);
      fd.set("title", next);
      await patchTaskAction(fd);
    });
  };

  // `M` = open the assignees picker (mirrors the list-row hotkey).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "m" && e.key !== "M") || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const trigger = rootRef.current?.querySelector<HTMLElement>('[data-field="assignees"] [aria-haspopup], [data-field="assignees"] button');
      if (trigger) { e.preventDefault(); trigger.click(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const me = allMembers.find((m) => m.id === currentUserId);
  const author = { name: me?.name ?? me?.email.split("@")[0] ?? "Ja", avatarUrl: me?.avatarUrl ?? null };
  const lastActor = activity[0]?.actor ? (activity[0].actor.name ?? activity[0].actor.email.split("@")[0]!) : null;
  const board = props.workspaceBoards.find((b) => b.id === props.boardId);
  const assignees = allMembers.filter((m) => props.assigneeIds.has(m.id)).map((m) => ({ name: m.name ?? m.email.split("@")[0]!, src: m.avatarUrl }));

  const headerProps: TaskHeaderProps = {
    mode, workspaceId, boardId: props.boardId, workspaceBoards: props.workspaceBoards, task, statusColumns: props.statusColumns,
    attachments: props.attachments.map((a) => ({ id: a.id, filename: a.filename, sizeBytes: a.sizeBytes })),
    canEdit, canDelete: props.canDelete, onMutate,
  };
  const detailsProps: TaskDetailsProps = {
    mode, workspaceId, task, milestones: props.milestones, allMembers, assigneeIds: props.assigneeIds, allTags: props.allTags, tagIds: props.tagIds,
    canEdit, customColumns: props.customColumns, customValues: props.customValues, meta: meta ?? null, lastActor, onMutate,
  };
  const mentionMembers = allMembers;
  const timeEntries = meta?.timeEntries ?? [];

  const title = (size: "lg" | "xl" | "mobile") => (
    <TitleField key={`title-${formKey}`} value={task.title} canEdit={canEdit} onSave={saveTitle}
      className={size === "xl" ? "max-w-[720px] text-xl" : size === "mobile" ? "text-[19px] leading-[25px]" : "text-lg"} />
  );
  const sections = (mobile: boolean) => (
    <>
      <DescriptionSection key={`desc-${formKey}`} taskId={task.id} initial={task.descriptionJson} canEdit={canEdit} onMutate={onMutate} />
      <SubtasksSection taskId={task.id} subtasks={props.subtasks} canManage={props.canManageSubtasks} mobile={mobile} barClassName={mode === "page" && !mobile ? "max-w-[200px]" : undefined} />
      <AttachmentsSection taskId={task.id} attachments={props.attachments} canUpload={props.canUpload} canModerate={props.canModerateAttachments} />
      {(props.linkedTasks.length > 0 || canEdit) && <LinkedTasksSection workspaceId={workspaceId} taskId={task.id} linkedTasks={props.linkedTasks} candidates={props.linkCandidates} canEdit={canEdit} />}
      {(props.poll || props.canManagePoll) && <PollSection taskId={task.id} poll={props.poll} canManage={props.canManagePoll} canVote={props.canVote} currentUserId={currentUserId} />}
    </>
  );
  const activityBlock = (mobile: boolean) => (
    <TaskActivity comments={props.comments} activity={activity} timeEntries={timeEntries} members={mentionMembers} canModerateComments={props.canModerateComments} mobile={mobile} />
  );
  const banner = conflict && (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-chip-yellow-bg px-3 py-2 text-xs text-chip-yellow-fg" role="status" data-ui="task-conflict">
      <IconWarning width={14} height={14} className="shrink-0" />
      <span className="flex-1">Ktoś zmienił to zadanie, kiedy je edytowałeś — odśwież, żeby zobaczyć zmiany.</span>
      <button type="button" onClick={refresh} className="font-semibold underline outline-none">Odśwież</button>
    </div>
  );

  if (isMobile) {
    return (
      <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-card" data-ui="task-detail" data-mode={mode} data-layout="mobile">
        <TaskMobileHeader {...headerProps} />
        {banner}
        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-3">
          <div className="mb-2.5 flex items-center gap-2">
            <StatusChipMenu taskId={task.id} statusColumns={props.statusColumns} value={task.statusColumnId} canEdit={canEdit} onMutate={onMutate} className="h-7 px-2.5" />
            <PriorityChipMenu taskId={task.id} value={task.priority} canEdit={canEdit} short onMutate={onMutate} className="h-7 px-[9px]" />
            {assignees.length > 0 && <AvatarStack people={assignees} size={26} max={3} className="ml-auto" />}
          </div>
          <div className="mb-3.5">{title("mobile")}</div>
          <div className="flex flex-col gap-4">{sections(true)}</div>
          <TaskDetailsCard {...detailsProps} mobile />
          {activityBlock(true)}
        </div>
        {props.canComment && <div className="shrink-0 border-t border-border bg-card safe-bottom"><CommentComposer taskId={task.id} members={mentionMembers} author={author} mobile /></div>}
      </div>
    );
  }

  if (mode === "page") {
    return (
      <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-card" data-ui="task-detail" data-mode="page">
        <TaskPageBar {...headerProps} workspaceName={board?.workspaceName ?? "Przestrzeń"} boardName={board?.name ?? "Tablica"} />
        {banner}
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto px-10 py-6">
            <div className="mb-2 flex items-center gap-2.5">
              <StatusChipMenu taskId={task.id} statusColumns={props.statusColumns} value={task.statusColumnId} canEdit={canEdit} onMutate={onMutate} />
              <PriorityChipMenu taskId={task.id} value={task.priority} canEdit={canEdit} onMutate={onMutate} />
            </div>
            <div className="mb-5">{title("xl")}</div>
            <div className="flex max-w-[720px] flex-col gap-5">
              {sections(false)}
              {activityBlock(false)}
              {props.canComment && <div className="-mx-3"><CommentComposer taskId={task.id} members={mentionMembers} author={author} /></div>}
            </div>
          </div>
          <TaskDetailsColumn {...detailsProps} />
        </div>
      </div>
    );
  }

  // panel (600, resizable) / modal (960)
  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-card" data-ui="task-detail" data-mode={mode}>
      {banner}
      <TaskHeader {...headerProps} />
      <div className="flex min-h-0 flex-1">
        <div className={cn("min-w-0 flex-1 overflow-y-auto pb-3", mode === "modal" ? "px-5 pt-5" : "px-4 pt-4")}>
          <div className={mode === "modal" ? "mb-4" : "mb-3.5"}>{title("lg")}</div>
          <div className="flex flex-col gap-4">{sections(false)}</div>
          {activityBlock(false)}
        </div>
        <TaskDetailsColumn {...detailsProps} />
      </div>
      {props.canComment && <div className="shrink-0 border-t border-border bg-card"><CommentComposer taskId={task.id} members={mentionMembers} author={author} /></div>}
    </div>
  );
}

// Inline-editable title: textarea that grows with content; blur / Enter saves, Escape restores.
function TitleField({ value, canEdit, onSave, className }: { value: string; canEdit: boolean; onSave: (next: string) => void; className?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; };
    fit();
    el.addEventListener("input", fit);
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => { el.removeEventListener("input", fit); ro.disconnect(); };
  }, [value]);
  return (
    <textarea
      ref={ref}
      name="title"
      rows={1}
      required
      maxLength={2000}
      readOnly={!canEdit}
      defaultValue={value}
      aria-label="Tytuł zadania"
      onBlur={(e) => onSave(e.currentTarget.value.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === "Escape") { e.currentTarget.value = value; e.currentTarget.blur(); }
      }}
      className={cn("-mx-1 block w-[calc(100%+8px)] resize-none overflow-hidden rounded-sm border-0 bg-transparent px-1 py-0 font-semibold leading-[26px] tracking-[-0.2px] text-foreground outline-none [field-sizing:content] hover:bg-n-50 focus-visible:bg-card focus-visible:shadow-[var(--focus)] read-only:hover:bg-transparent", className)}
    />
  );
}
