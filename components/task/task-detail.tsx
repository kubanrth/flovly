"use client";

import {
  useActionState,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Plus,
  Check,
  X,
  Bell,
  Flag,
  Maximize2,
  Pencil,
  Search,
} from "lucide-react";
import type { Role } from "@/lib/generated/prisma/enums";
import {
  createTagAction,
  deleteTaskAction,
  patchTaskAction,
  toggleAssigneeAction,
  toggleTagAction,
  updateTaskAction,
  type UpdateTaskState,
} from "@/app/(app)/w/[workspaceId]/t/actions";
import { type RichTextDoc } from "@/components/task/rich-text-editor";
import { DescriptionSection } from "@/components/task/description-section";
import { TaskTimer } from "@/components/task/task-timer";
import { FieldCell } from "@/components/table/field-cells";
import { parseFieldOptions } from "@/lib/table-fields";
import { CommentsSection, type CommentItem } from "@/components/task/comments-section";
import { ActivityLog, type ActivityEntry } from "@/components/task/activity-log";
import { AttachmentsSection, type AttachmentItem } from "@/components/task/attachments-section";
import { StatusPill } from "@/components/task/status-pill";
import { SubtasksSection, type SubtaskItem } from "@/components/task/subtasks-section";
import { LinkedTasksSection } from "@/components/task/linked-tasks-section";
import { MoveTaskMenu, type MoveTargetBoard } from "@/components/task/move-task-menu";
import { PollSection, type PollData } from "@/components/task/poll-section";
import { SendEmailDialog } from "@/components/task/send-email-dialog";
import { assignTaskToMilestoneAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/milestone-actions";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { RecurrencePicker } from "@/components/task/recurrence-picker";
import { PortalDropdown } from "@/components/ui/portal-dropdown";

// Tag palette moved to lib/colors.ts (BRAND_PALETTE).
import { TAG_PALETTE as TAG_COLORS } from "@/lib/colors";
import type { TaskPriorityValue } from "@/lib/task-priority";
import { PriorityPickerCell } from "@/components/table/priority-picker-cell";

export interface TaskDetailProps {
  workspaceId: string;
  role: Role;
  task: {
    id: string;
    // Human-friendly per-workspace ID (1, 2, 3...).
    displayId: number;
    title: string;
    descriptionJson: RichTextDoc | null;
    statusColumnId: string | null;
    // F12-K75: priorytet zadania (sterowany inline picker'em — bez submit form'a).
    priority: TaskPriorityValue;
    milestoneId: string | null;
    startAt: string | null;
    stopAt: string | null;
    reminderAt: string | null;
    reminderOffset: string | null;
    // Recurrence rule (cron spawns instances daily at 00:05 UTC).
    recurrenceRule: { freq: "daily" | "weekly" | "monthly"; day?: number } | null;
    recurrenceParentId: string | null;
    // Time tracking — accumulated seconds + ISO timer state.
    timeTrackedSeconds: number;
    timerStartedAt: string | null;
    timerCompletedAt: string | null;
  };
  statusColumns: { id: string; name: string; colorHex: string }[];
  milestones: { id: string; title: string; startAt: string; stopAt: string }[];
  allMembers: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  }[];
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
  // saveTaskCustomValueAction revalidates both this card and the table page.
  customColumns: {
    id: string;
    name: string;
    type: import("@/lib/table-fields").FieldType;
    options: unknown;
  }[];
  customValues: Record<string, string>;
  // F12-K63: linked tasks (other tasks referenced from this one or referencing
  // it). Both directions merged so the section reads symmetrically.
  linkedTasks: LinkedTaskItem[];
  // Candidate pool fed to the "Powiąż zadanie" picker. Capped on the server
  // (most-recent N) so very large workspaces stay responsive.
  linkCandidates: LinkCandidate[];
  // F12-K67: lista tablic w workspace do których można przenieść task'a.
  // Excluding current board jest po stronie UI (MoveTaskMenu) bo i tak
  // potrzebujemy aktualnego board.id do generowania linka "wróć".
  boardId: string;
  workspaceBoards: MoveTargetBoard[];
  // F12-K67: opcjonalny kontakt CRM powiązany z task'iem + pool wszystkich
  // kontaktów w workspace do picker'a.
  contactId: string | null;
  workspaceContacts: { id: string; label: string }[];
}

export interface LinkedTaskItem {
  linkId: string;
  task: {
    id: string;
    title: string;
    displayId: number;
    primaryAssignee: {
      id: string;
      name: string | null;
      email: string;
      avatarUrl: string | null;
    } | null;
  };
}

export interface LinkCandidate {
  id: string;
  title: string;
  displayId: number;
}

// Inicjały do avatara (max 2 znaki, uppercase).
function initialsOf(name: string | null, email: string): string {
  const src = name?.trim() || email.split("@")[0] || "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function TaskDetail({
  workspaceId,
  task,
  statusColumns,
  milestones,
  allMembers,
  assigneeIds,
  allTags,
  tagIds,
  canEdit,
  canDelete,
  comments,
  canComment,
  canModerateComments,
  activity,
  attachments,
  canUpload,
  canModerateAttachments,
  subtasks,
  canManageSubtasks,
  poll,
  canManagePoll,
  canVote,
  currentUserId,
  linkedTasks,
  linkCandidates,
  boardId,
  workspaceBoards,
  customColumns,
  customValues,
}: TaskDetailProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<UpdateTaskState, FormData>(
    updateTaskAction,
    null,
  );

  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;
  const flash = state?.ok ? state.message : null;

  // Long task titles wrap to multiple lines — auto-grow the textarea so the
  // whole title is visible without scrolling/clipping. `field-sizing:content`
  // does this natively on new browsers; this JS path is the fallback that
  // works everywhere and also handles paste / programmatic value changes.
  const titleRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    el.addEventListener("input", fit);
    const ro = new ResizeObserver(fit); // re-fit when modal width changes wrap
    ro.observe(el);
    return () => {
      el.removeEventListener("input", fit);
      ro.disconnect();
    };
  }, [task.title]);

  // Belt-and-suspenders router.refresh after assignee toggle — Realtime broadcast can fail silently.
  const toggleAssigneeWithRefresh = async (fd: FormData) => {
    await toggleAssigneeAction(fd);
    router.refresh();
  };

  // Aktywni przypisani jako stack avatarów (max 5 + counter).
  const activeAssignees = allMembers.filter((m) => assigneeIds.has(m.id));
  const activeTags = allTags.filter((t) => tagIds.has(t.id));

  return (
    <div className="flex flex-col gap-6">
      {/* =====================================================================
          HEADER — v4 layout
          Row 1: ID badge (#42) + Status pill + Priority pill + akcje (expand / X)
          Row 2: tytuł zadania (textarea, edytowalny inline) + ikona pencila
          ===================================================================== */}
      <header className="flex flex-col gap-3.5">
        {/* meta row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-md bg-primary/12 px-2 font-mono text-[0.72rem] font-semibold tracking-tight text-primary">
            #{task.displayId || "—"}
          </span>

          {/* status — pill statyczna w nagłówku, edytowalna z prawego sidebar'a */}
          <HeaderStatusPill task={task} statusColumns={statusColumns} />
          {/* priority — pill statyczna w nagłówku, edytowalna z prawego sidebar'a */}
          <HeaderPriorityPill priority={task.priority} />

          {/* prawa strona — akcje (email / move / expand / close obsługuje shell) */}
          <div className="ml-auto flex items-center gap-1.5">
            {canEdit && (
              <SendEmailDialog
                taskId={task.id}
                taskTitle={task.title}
                attachments={attachments.map((a) => ({
                  id: a.id,
                  filename: a.filename,
                  sizeBytes: a.sizeBytes,
                }))}
              />
            )}
            {canEdit && workspaceBoards.length > 1 && (
              <MoveTaskMenu
                taskId={task.id}
                currentBoardId={boardId}
                availableBoards={workspaceBoards}
              />
            )}
            <button
              type="button"
              aria-label="Pełny widok"
              className="grid h-[30px] w-[30px] place-items-center rounded-[9px] border border-border bg-card/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              onClick={() => router.push(`/w/${workspaceId}/t/${task.id}`)}
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        {/* title row */}
        <form
          id="task-update-form"
          action={(fd) => startTransition(() => formAction(fd))}
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="id" value={task.id} />
          <div className="flex items-start gap-2">
            <textarea
              ref={titleRef}
              name="title"
              required
              maxLength={2000}
              rows={1}
              readOnly={!canEdit}
              defaultValue={task.title}
              aria-label="Tytuł zadania"
              aria-invalid={!!fieldErrors?.title}
              // F12-K96: autosave na blur (Save button usunięty w v4 polish).
              // Mirror pattern z StatusPill onCommit fix (F12-K92): trim,
              // skip jeśli pusty albo bez zmiany, wywołaj patchTaskAction.
              onBlur={(e) => {
                if (!canEdit) return;
                const next = e.currentTarget.value.trim();
                if (!next || next === task.title) return;
                const fd = new FormData();
                fd.set("id", task.id);
                fd.set("title", next);
                startTransition(() => patchTaskAction(fd));
              }}
              // Enter (bez Shift) = blur → trigger save (UX z Linear/Notion).
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              className="flex-1 resize-none overflow-hidden rounded-sm border-0 bg-transparent p-0 font-display text-[1.5rem] font-bold leading-[1.2] tracking-[-0.02em] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 aria-[invalid=true]:text-destructive md:text-[1.75rem] [field-sizing:content]"
            />
            {canEdit && (
              <Pencil
                size={15}
                className="mt-2 shrink-0 text-muted-foreground"
                aria-hidden
              />
            )}
          </div>
          {fieldErrors?.title && (
            <span className="font-mono text-[0.68rem] text-destructive">
              {fieldErrors.title}
            </span>
          )}

          {/* recurrence info — istniejące zadanie cykliczne (instancja) */}
          {task.recurrenceParentId && (
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
              🔁 instancja zadania cyklicznego — edytuj szablon żeby zmienić regułę
            </p>
          )}

          {/* flash + error pod tytułem */}
          {!state?.ok && state?.error && (
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
              {state.error}
            </p>
          )}
          {flash && (
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-primary">
              {flash}
            </span>
          )}
        </form>
      </header>

      {/* =====================================================================
          BODY — 2 kolumny: main (1fr) + sticky meta sidebar (280px)
          Mobile (max-md): meta sidebar zwija się pod main column.
          ===================================================================== */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
        {/* ============ MAIN COLUMN ============ */}
        <main className="flex min-w-0 flex-col gap-8">
          {/* Description — Tiptap rich text editor */}
          <Section eyebrow="Opis">
            <DescriptionSection
              taskId={task.id}
              initial={task.descriptionJson}
              canEdit={canEdit}
            />
          </Section>

          {/* Subtasks (checklist + progress bar) */}
          <Section eyebrow={`Podzadania${subtasks.length ? ` · ${subtasks.filter((s) => s.completed).length}/${subtasks.length}` : ""}`}>
            <SubtasksSection
              taskId={task.id}
              subtasks={subtasks}
              canManage={canManageSubtasks}
            />
          </Section>

          {/* Attachments — image previews + file cards + dashed dodaj */}
          <Section eyebrow={`Załączniki${attachments.length ? ` · ${attachments.length}` : ""}`}>
            <AttachmentsSection
              taskId={task.id}
              attachments={attachments}
              canUpload={canUpload}
              canModerate={canModerateAttachments}
            />
          </Section>

          {/* Linked tasks — pokrewne zadania */}
          {(linkedTasks.length > 0 || canEdit) && (
            <Section eyebrow={`Powiązane${linkedTasks.length ? ` · ${linkedTasks.length}` : ""}`}>
              <LinkedTasksSection
                workspaceId={workspaceId}
                taskId={task.id}
                linkedTasks={linkedTasks}
                candidates={linkCandidates}
                canEdit={canEdit}
              />
            </Section>
          )}

          {/* Poll — głosowanie zespołu */}
          {(poll || canManagePoll) && (
            <Section eyebrow="Głosowanie">
              <PollSection
                taskId={task.id}
                poll={poll}
                canManage={canManagePoll}
                canVote={canVote}
                currentUserId={currentUserId}
              />
            </Section>
          )}

          {/* F12-K54: custom kolumny tabeli — sekcja tylko gdy board ma jakieś. */}
          {customColumns.length > 0 && (
            <Section eyebrow="Pola dodatkowe">
              <div className="grid gap-3 sm:grid-cols-2">
                {customColumns.map((col) => (
                  <div key={col.id} className="flex flex-col gap-1.5">
                    <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                      {col.name}
                    </span>
                    <div className="min-h-[34px] rounded-md border border-border bg-background px-2 py-1.5">
                      <FieldCell
                        taskId={task.id}
                        columnId={col.id}
                        type={col.type}
                        raw={customValues[col.id] ?? ""}
                        options={parseFieldOptions(col.options)}
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Comments thread */}
          <Section eyebrow={`Komentarze${comments.length ? ` · ${comments.length}` : ""}`}>
            <CommentsSection
              taskId={task.id}
              comments={comments}
              canComment={canComment}
              canModerateComments={canModerateComments}
              members={allMembers}
            />
          </Section>

          {/* Activity feed — audit timeline */}
          <Section eyebrow="Aktywność">
            <ActivityLog entries={activity} />
          </Section>
        </main>

        {/* ============ META SIDEBAR (sticky 280px) ============ */}
        <aside className="md:sticky md:top-4 md:self-start">
          <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card/40 p-5 shadow-[0_4px_24px_-12px_rgba(0,0,0,0.12)] backdrop-blur-sm">
            {/* STATUS picker inline */}
            <MetaBlock label="Status">
              <StatusPill
                form="task-update-form"
                name="statusColumnId"
                statuses={statusColumns}
                defaultValue={task.statusColumnId}
                disabled={!canEdit}
                onCommit={(newStatusId) => {
                  const fd = new FormData();
                  fd.set("id", task.id);
                  fd.set("statusColumnId", newStatusId);
                  startTransition(() => patchTaskAction(fd));
                }}
              />
            </MetaBlock>

            {/* PRIORITY picker inline (F12-K75 — instant save) */}
            <MetaBlock label="Priorytet">
              <PriorityPickerCell
                taskId={task.id}
                current={task.priority}
                canEdit={canEdit}
              />
            </MetaBlock>

            {/* ASSIGNEES stack — max 5 avatarów + "+ Dodaj" */}
            <MetaBlock label="Przypisane">
              <AssigneesStack
                activeAssignees={activeAssignees}
                allMembers={allMembers}
                assigneeIds={assigneeIds}
                taskId={task.id}
                canEdit={canEdit}
                onToggle={toggleAssigneeWithRefresh}
              />
            </MetaBlock>

            {/* DATES — start / koniec */}
            <div className="grid grid-cols-2 gap-3">
              <MetaBlock label="Start">
                <DateTimePicker
                  form="task-update-form"
                  name="startAt"
                  defaultValue={task.startAt}
                  disabled={!canEdit}
                  placeholder="Brak daty"
                  label="Data startu"
                  onChange={(iso) => {
                    if (!canEdit) return;
                    const fd = new FormData();
                    fd.set("id", task.id);
                    fd.set("startAt", iso ?? "");
                    startTransition(() => patchTaskAction(fd));
                  }}
                />
              </MetaBlock>
              <MetaBlock label="Koniec">
                <DateTimePicker
                  form="task-update-form"
                  name="stopAt"
                  defaultValue={task.stopAt}
                  disabled={!canEdit}
                  placeholder="Brak daty"
                  label="Data końca"
                  onChange={(iso) => {
                    if (!canEdit) return;
                    const fd = new FormData();
                    fd.set("id", task.id);
                    fd.set("stopAt", iso ?? "");
                    startTransition(() => patchTaskAction(fd));
                  }}
                />
              </MetaBlock>
            </div>

            {/* MILESTONE — instant select */}
            <MetaBlock
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Flag size={11} aria-hidden /> Milestone
                </span>
              }
            >
              <MilestoneSection
                // remount on server change — fresh state bez setState-in-render.
                key={`ms-${task.milestoneId ?? "none"}`}
                taskId={task.id}
                currentMilestoneId={task.milestoneId}
                milestones={milestones}
                canEdit={canEdit}
              />
            </MetaBlock>

            {/* TAGS — max 5 + "+ Dodaj tag" */}
            <MetaBlock label="Tagi">
              <TagsSection
                workspaceId={workspaceId}
                taskId={task.id}
                allTags={allTags}
                tagIds={tagIds}
                activeTags={activeTags}
                canEdit={canEdit}
              />
            </MetaBlock>

            {/* REMINDER — wpinka do parent form'a (hidden input) */}
            <MetaBlock
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Bell size={11} aria-hidden /> Przypomnienie
                </span>
              }
            >
              <ReminderField
                defaultValue={task.reminderOffset ?? "none"}
                reminderAt={task.reminderAt}
                disabled={!canEdit}
                taskId={task.id}
              />
            </MetaBlock>

            {/* RECURRENCE — tylko dla template'ów (nie instancji) */}
            {!task.recurrenceParentId && (
              <MetaBlock label="Cykliczność">
                <RecurrencePicker
                  taskId={task.id}
                  rule={task.recurrenceRule}
                  disabled={!canEdit}
                />
              </MetaBlock>
            )}
          </div>
        </aside>
      </div>

      {/* =====================================================================
          FOOTER — TaskTimer (pill, lewa) + Autosave status + Delete (prawa).
          Save button usunięty: zmiany lecą autosave-em (patchTaskAction).
          `pending` z useActionState dalej żyje na potrzeby wskaźnika
          "Zapisuję…" obok timera, ale dedykowany Save CTA jest zbędny.
          Sticky liquid-glass bar — backdrop-blur z hairline shadow.
          ===================================================================== */}
      {/* F12-K86: footer wyrównany do jednej linii baseline. flex-nowrap na
          desktop wymusza single row; min-w-0 na timer wrapperze + shrink/grow
          radzi sobie z długimi nazwami. Autosave indicator middle, Usuń right. */}
      <footer className="sticky bottom-0 z-10 -mx-4 mt-2 flex items-center gap-3 border-t border-border bg-background/80 px-4 py-3 backdrop-blur-md max-md:flex-wrap md:-mx-6 md:flex-nowrap md:px-6">
        {/* Timer pill (zachowuje pełną logikę startedAt/completedAt + duration display) */}
        <div className="flex min-w-0 shrink-0 items-center">
          <TaskTimer
            taskId={task.id}
            accumulatedSeconds={task.timeTrackedSeconds}
            startedAt={task.timerStartedAt}
            completedAt={task.timerCompletedAt}
            canEdit={canEdit}
          />
        </div>

        {/* Autosave status — subtle text-only indicator zamiast Save buttona.
            shrink-0 + truncate żeby nie psuł flex-nowrap. */}
        {canEdit && (
          <span
            aria-live="polite"
            className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/80"
          >
            {pending ? "Zapisuję…" : "Autosave"}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canDelete && (
            <form action={deleteTaskAction} className="m-0">
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 font-sans text-[0.84rem] font-semibold text-destructive transition-colors hover:border-destructive/50 hover:bg-destructive/15 active:scale-[0.97] motion-reduce:active:scale-100"
              >
                <Trash2 size={14} /> Usuń
              </button>
            </form>
          )}
        </div>
      </footer>
    </div>
  );
}

/* =========================================================================
   ATOMOWE PRIMITIVES — wewnętrzne komponenty layoutu
   ========================================================================= */

// Sekcja main column: eyebrow + content + delikatny separator border-b.
function Section({
  eyebrow,
  children,
}: {
  eyebrow: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-b border-border pb-8 last:border-0 last:pb-0">
      <span className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </span>
      <div>{children}</div>
    </section>
  );
}

// Pojedynczy "kafelek" w meta sidebar — label + kontrolka.
function MetaBlock({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

// Header status pill — wyświetla aktualny status (read-only podgląd; edycja w sidebar).
function HeaderStatusPill({
  task,
  statusColumns,
}: {
  task: { statusColumnId: string | null };
  statusColumns: { id: string; name: string; colorHex: string }[];
}) {
  const current = statusColumns.find((s) => s.id === task.statusColumnId);
  if (!current) {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 text-[0.72rem] font-semibold text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        Brak statusu
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[0.72rem] font-semibold"
      style={{
        background: `${current.colorHex}1F`,
        border: `1px solid ${current.colorHex}55`,
        color: current.colorHex,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: current.colorHex }}
      />
      {current.name}
    </span>
  );
}

// Header priority pill — kolorowa pillka według priorytetu.
function HeaderPriorityPill({ priority }: { priority: TaskPriorityValue }) {
  if (priority === "NONE") return null;
  const palette: Record<
    Exclude<TaskPriorityValue, "NONE">,
    { label: string; color: string; bg: string; border: string }
  > = {
    LOW: { label: "P3 · Niski", color: "#34BEF8", bg: "rgba(52,190,248,.14)", border: "rgba(52,190,248,.3)" },
    MEDIUM: { label: "P2 · Średni", color: "#A78BFA", bg: "rgba(167,139,250,.14)", border: "rgba(167,139,250,.3)" },
    HIGH: { label: "P1 · Wysoki", color: "#F59E0B", bg: "rgba(245,158,11,.14)", border: "rgba(245,158,11,.3)" },
    URGENT: { label: "P0 · Pilny", color: "#FB7185", bg: "rgba(244,63,94,.14)", border: "rgba(244,63,94,.3)" },
  };
  const p = palette[priority];
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[0.72rem] font-semibold"
      style={{ background: p.bg, border: `1px solid ${p.border}`, color: p.color }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke={p.color}
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      {p.label}
    </span>
  );
}

// Stack avatarów przypisanych + przycisk "+ Dodaj" otwierający picker'a.
// Picker jest popoverem (PortalDropdown) — toggle per user via form action.
function AssigneesStack({
  activeAssignees,
  allMembers,
  assigneeIds,
  taskId,
  canEdit,
  onToggle,
}: {
  activeAssignees: TaskDetailProps["allMembers"];
  allMembers: TaskDetailProps["allMembers"];
  assigneeIds: Set<string>;
  taskId: string;
  canEdit: boolean;
  onToggle: (fd: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visible = activeAssignees.slice(0, 5);
  const overflow = Math.max(0, activeAssignees.length - 5);
  // React Compiler memoizes — bezpośredni filter na każdy render OK.
  const q = query.trim().toLowerCase();
  const filteredMembers = q
    ? allMembers.filter((m) => {
        const name = (m.name ?? "").toLowerCase();
        const email = m.email.toLowerCase();
        return name.includes(q) || email.includes(q);
      })
    : allMembers;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        {visible.length === 0 && (
          <span className="text-[0.78rem] text-muted-foreground">Brak przypisanych</span>
        )}
        {visible.map((m, i) => (
          <span
            key={m.id}
            className="grid h-7 w-7 place-items-center overflow-hidden rounded-lg border-2 border-card bg-brand-gradient font-display text-[0.62rem] font-bold text-white"
            style={{ marginLeft: i === 0 ? 0 : -7, zIndex: 10 - i }}
            title={m.name ?? m.email}
          >
            {m.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.avatarUrl} alt="" width={28} height={28} className="h-full w-full object-cover" />
            ) : (
              initialsOf(m.name, m.email)
            )}
          </span>
        ))}
        {overflow > 0 && (
          <span
            className="grid h-7 w-7 place-items-center rounded-lg border-2 border-card bg-muted text-[0.62rem] font-bold text-muted-foreground"
            style={{ marginLeft: -7 }}
          >
            +{overflow}
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Dodaj osobę"
            aria-expanded={open}
            className="grid h-7 w-7 place-items-center rounded-lg border-2 border-card bg-muted/60 text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
            style={{ marginLeft: visible.length > 0 || overflow > 0 ? -7 : 0 }}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Picker — rozwijana lista członków (toggle per user) */}
      {open && canEdit && (
        <div className="popover-glass popover-enter flex flex-col gap-1 p-2">
          {/* Search input — filtruje członków po name/email */}
          <label className="mx-1 mt-1 mb-1 flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-2.5 py-1.5">
            <Search size={13} className="text-muted-foreground" aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj osoby…"
              aria-label="Szukaj osoby"
              className="min-w-0 flex-1 bg-transparent text-[0.78rem] text-foreground placeholder:text-muted-foreground/80 outline-none"
            />
          </label>
          {filteredMembers.length === 0 ? (
            <p className="px-2 py-3 text-center text-[0.76rem] text-muted-foreground">
              Brak dopasowań
            </p>
          ) : (
            filteredMembers.map((m) => {
              const active = assigneeIds.has(m.id);
              return (
                <form key={m.id} action={onToggle} className="m-0">
                  <input type="hidden" name="taskId" value={taskId} />
                  <input type="hidden" name="userId" value={m.id} />
                  <button
                    type="submit"
                    data-active={active ? "true" : "false"}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.82rem] transition-colors hover:bg-primary/10 data-[active=true]:bg-primary/12 data-[active=true]:text-foreground"
                    title={m.email}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-md bg-brand-gradient font-display text-[0.6rem] font-bold text-white">
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatarUrl} alt="" width={24} height={24} className="h-full w-full object-cover" />
                      ) : (
                        initialsOf(m.name, m.email)
                      )}
                    </span>
                    <span className="truncate">{m.name ?? m.email.split("@")[0]}</span>
                    {active && <Check size={13} className="ml-auto text-primary" />}
                  </button>
                </form>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   SUB-SECTIONS (zachowane z poprzedniej wersji, lekko przearanżowane)
   ========================================================================= */

// Optimistic UI: setValue runs immediately; router.refresh() pulls fresh props through intercepted modal route.
function MilestoneSection({
  taskId,
  currentMilestoneId,
  milestones,
  canEdit,
}: {
  taskId: string;
  currentMilestoneId: string | null;
  milestones: { id: string; title: string; startAt: string; stopAt: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(currentMilestoneId ?? "");

  // Sentinel — PortalDropdown traktuje "" jako brak selekcji.
  const NONE = "__none__";
  const handleChange = (next: string) => {
    const persisted = next === NONE ? "" : next;
    const previous = value;
    setValue(persisted);
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("milestoneId", persisted);
    startTransition(async () => {
      const result = await assignTaskToMilestoneAction(fd);
      // F12-K69: server zwraca {ok:false,error} gdy daty zadania wychodzą poza
      // zakres milestone'a. Roll back UI + komunikat zamiast cichego no-op.
      if (result && !result.ok) {
        setValue(previous);
        alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <PortalDropdown<string>
      ariaLabel="Wybierz milestone"
      disabled={!canEdit}
      width={240}
      placeholder="— brak —"
      emptyHint="Utwórz milestone w roadmapie"
      value={value === "" ? NONE : value}
      onChange={handleChange}
      options={[
        { value: NONE, label: "— brak —" },
        ...milestones.map((m) => ({
          value: m.id,
          label: m.title,
        })),
      ]}
      triggerClassName="inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background/60 px-3 text-[0.82rem] outline-none transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

// Hidden-input + v4 ReminderPicker — reminderOffset flows into parent form's
// FormData via form="task-update-form" attribute na hidden inputie.
// Custom UI per Flovly v4 spec: relative offsets row (15min / 1h / 1d) +
// "Inne" trigger ujawniający listę pozostałych offsetów. Wartości i kontrakt
// niezmienione — server akceptuje te same kody.
function ReminderField({
  defaultValue,
  reminderAt,
  disabled,
  taskId,
}: {
  defaultValue: string;
  reminderAt: string | null;
  disabled: boolean;
  taskId: string;
}) {
  const [value, setValue] = useState<string>(defaultValue);
  // Quick-pick offsets pokazane jako chip-row (15min nieobsługiwany przez backend,
  // więc mapujemy "15min" → "1h" jako visual placeholder dla "krótko przed").
  // Faktyczne kody backendowe (none/1h/4h/1d/3d) ujawniamy w rozwijanej liście "Inne".
  const QUICK: { value: string; label: string }[] = [
    { value: "1h", label: "1 h" },
    { value: "4h", label: "4 h" },
    { value: "1d", label: "1 dzień" },
    { value: "3d", label: "3 dni" },
    { value: "none", label: "Brak" },
  ];
  return (
    <div className="popover-glass shadow-aura flex flex-col gap-1.5 p-2">
      <input
        type="hidden"
        form="task-update-form"
        name="reminderOffset"
        value={value}
      />
      <span className="eyebrow block px-1 text-[0.62rem]">Przypomnij</span>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Czas przypomnienia">
        {QUICK.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => {
                if (!disabled) {
                  const fd = new FormData();
                  fd.set("id", taskId);
                  fd.set("reminderOffset", opt.value);
                  startTransition(() => patchTaskAction(fd));
                  setValue(opt.value);
                }
              }}
              data-active={active}
              className="inline-flex min-h-[28px] items-center gap-1.5 rounded-[8px] border border-border/60 bg-card/40 px-2.5 py-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-primary/10 data-[active=true]:border-primary/40 data-[active=true]:bg-primary/10 data-[active=true]:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Bell size={12} className="opacity-70" aria-hidden />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
      {reminderAt && (
        <span className="mt-0.5 flex items-center gap-1.5 rounded-[8px] border border-border bg-card/50 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          <Bell size={11} aria-hidden />
          {new Date(reminderAt).toLocaleString("pl-PL", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      )}
    </div>
  );
}

function TagsSection({
  workspaceId,
  taskId,
  allTags,
  tagIds,
  activeTags,
  canEdit,
}: {
  workspaceId: string;
  taskId: string;
  allTags: { id: string; name: string; colorHex: string }[];
  tagIds: Set<string>;
  activeTags: { id: string; name: string; colorHex: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [tagQuery, setTagQuery] = useState("");

  // Same belt-and-suspenders pattern as TaskDetail — table re-fetches even if Realtime is silent.
  const toggleTagWithRefresh = async (fd: FormData) => {
    await toggleTagAction(fd);
    router.refresh();
  };

  const visibleActive = activeTags.slice(0, 5);
  const overflow = Math.max(0, activeTags.length - 5);
  // React Compiler memoizes — bezpośredni filter na każdy render OK.
  const tq = tagQuery.trim().toLowerCase();
  const filteredTags = tq
    ? allTags.filter((t) => t.name.toLowerCase().includes(tq))
    : allTags;

  return (
    <div className="flex flex-col gap-2">
      {/* Aktywne tagi (max 5 + counter) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleActive.length === 0 && !picking && (
          <span className="text-[0.78rem] text-muted-foreground">Brak tagów</span>
        )}
        {visibleActive.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.72rem] font-medium"
            style={{
              borderColor: `${t.colorHex}55`,
              background: `${t.colorHex}1A`,
              color: t.colorHex,
            }}
          >
            {t.name}
          </span>
        ))}
        {overflow > 0 && (
          <span className="rounded-full border border-border bg-card/60 px-2 py-0.5 text-[0.7rem] text-muted-foreground">
            +{overflow}
          </span>
        )}
        {canEdit && !picking && !creating && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            <Plus size={10} /> Dodaj tag
          </button>
        )}
      </div>

      {/* Picker — pełna lista tagów (toggle) + przycisk "Nowy tag" */}
      {picking && canEdit && (
        <div className="popover-glass popover-enter flex flex-col gap-2 p-2.5">
          {/* Search input — filtruje tagi po name */}
          <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-2.5 py-1.5">
            <Search size={13} className="text-muted-foreground" aria-hidden />
            <input
              type="text"
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder="Szukaj tagu…"
              aria-label="Szukaj tagu"
              className="min-w-0 flex-1 bg-transparent text-[0.78rem] text-foreground placeholder:text-muted-foreground/80 outline-none"
            />
          </label>
          {allTags.length === 0 ? (
            <p className="text-[0.78rem] text-muted-foreground">Brak tagów w workspace.</p>
          ) : filteredTags.length === 0 ? (
            <p className="px-1 py-2 text-[0.76rem] text-muted-foreground">Brak dopasowań</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filteredTags.map((t) => {
                const active = tagIds.has(t.id);
                return (
                  <form key={t.id} action={toggleTagWithRefresh} className="m-0">
                    <input type="hidden" name="taskId" value={taskId} />
                    <input type="hidden" name="tagId" value={t.id} />
                    <button
                      type="submit"
                      data-active={active ? "true" : "false"}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.72rem] font-medium transition-[border-color,opacity] data-[active=false]:opacity-50 hover:opacity-100"
                      style={{
                        borderColor: active ? t.colorHex : "var(--border)",
                        background: active ? `${t.colorHex}1A` : "transparent",
                        color: active ? t.colorHex : "var(--foreground)",
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: t.colorHex }}
                      />
                      {t.name}
                    </button>
                  </form>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-primary transition-colors hover:bg-primary/10"
            >
              <Plus size={10} /> Nowy tag
            </button>
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="ml-auto text-[0.7rem] text-muted-foreground hover:text-foreground"
            >
              Gotowe
            </button>
          </div>

          {creating && (
            <form
              action={createTagAction}
              onSubmit={() => {
                setCreating(false);
                setColor(TAG_COLORS[0]);
              }}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2"
            >
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="colorHex" value={color} />
              <input
                name="name"
                type="text"
                required
                maxLength={32}
                placeholder="np. urgent"
                autoFocus
                aria-label="Nazwa nowego tagu"
                className="min-w-[110px] flex-1 rounded-md bg-transparent px-2 py-1 text-[0.78rem] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              />
              <div className="flex items-center gap-1">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="grid h-5 w-5 place-items-center rounded-full transition-transform hover:scale-110"
                    style={{
                      background: c,
                      outline: color === c ? "2px solid var(--foreground)" : "none",
                      outlineOffset: color === c ? 2 : 0,
                    }}
                    aria-label={`kolor ${c}`}
                  />
                ))}
              </div>
              <button
                type="submit"
                className="grid h-7 w-7 place-items-center rounded-md bg-brand-gradient text-white transition-opacity hover:opacity-90"
                aria-label="Utwórz tag"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Anuluj"
              >
                <X size={12} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// F12-K67: dropdown wiążący task'a z kontaktem CRM. Autosave przez
// patchTaskAction po onChange (mirror MilestoneSection / ReminderField pattern).
// workspaceId potrzebny serwerowi do walidacji że kontakt jest z tego workspace'u.
// NOTE: ContactField celowo wyciągnięty z karty zadania w F12-K67 — klient nie
// chciał widzieć picker'a klienta przy każdym tasku. Linkowanie task ↔ kontakt
// robi się teraz po stronie kontaktu (ContactTasksTile) oraz przez Deal.contactId.
// Komponent zostawiony w pliku jako re-eksport gdyby był potrzebny gdzie indziej.
export function ContactField({
  taskId,
  workspaceId: _workspaceId,
  contactId,
  contacts,
  disabled,
}: {
  taskId: string;
  workspaceId: string;
  contactId: string | null;
  contacts: { id: string; label: string }[];
  disabled: boolean;
}) {
  const submit = (next: string) => {
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set("contactId", next);
    startTransition(() => patchTaskAction(fd));
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Kontakt (klient)
      </span>
      <select
        value={contactId ?? ""}
        onChange={(e) => submit(e.target.value)}
        disabled={disabled}
        className="h-9 w-full rounded-lg border border-border bg-background/60 px-3 text-[0.82rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">— brak —</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
