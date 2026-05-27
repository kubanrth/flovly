"use client";

import { useActionState, startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Check, X } from "lucide-react";
import type { Role } from "@/lib/generated/prisma/enums";
import {
  createTagAction,
  deleteTaskAction,
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
import { PollSection, type PollData } from "@/components/task/poll-section";
import { SendEmailDialog } from "@/components/task/send-email-dialog";
import { assignTaskToMilestoneAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/milestone-actions";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { RecurrencePicker } from "@/components/task/recurrence-picker";
import { PortalDropdown } from "@/components/ui/portal-dropdown";
import { Bell, Flag } from "lucide-react";

// F12-K36: paleta tagów przeniesiona do `lib/colors.ts` (BRAND_PALETTE).
import { TAG_PALETTE as TAG_COLORS } from "@/lib/colors";

export interface TaskDetailProps {
  workspaceId: string;
  role: Role;
  task: {
    id: string;
    // F12-K57: ludzki ID per-workspace (1, 2, 3...) wyświetlany w UI.
    displayId: number;
    title: string;
    descriptionJson: RichTextDoc | null;
    statusColumnId: string | null;
    milestoneId: string | null;
    startAt: string | null;
    stopAt: string | null;
    reminderAt: string | null;
    reminderOffset: string | null;
    // F11-17: recurrence rule (cron spawns instances daily at 00:05 UTC).
    recurrenceRule: { freq: "daily" | "weekly" | "monthly"; day?: number } | null;
    recurrenceParentId: string | null;
    // F12-K40: time tracking — accumulated seconds + ISO timer state.
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
  // F12-K54: custom kolumny tabeli + ich wartości — wyświetlamy w karcie
  // zadania nad sekcją "Czas pracy". Bidirectional sync ze stroną tabeli
  // (saveTaskCustomValueAction revalidate'uje obie).
  customColumns: {
    id: string;
    name: string;
    type: import("@/lib/table-fields").FieldType;
    options: unknown;
  }[];
  customValues: Record<string, string>;
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

  // F12-K4: Server actions revalidate paths but Supabase Realtime
  // broadcast can fail silently (channel auth, network) — wrap the
  // assignee toggle so the parent route always gets a router.refresh
  // when the action returns. Cheap belt-and-suspenders.
  // (Tag toggle wrapper lives inside TagsSection so it has its own.)
  const toggleAssigneeWithRefresh = async (fd: FormData) => {
    await toggleAssigneeAction(fd);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6 md:gap-10">
      {/* Meta: ID + actions */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
          zadanie · #{task.displayId || "—"}
        </span>
        <div className="flex items-center gap-4">
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
          {canDelete && (
            <form action={deleteTaskAction}>
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 size={12} /> usuń zadanie
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Main form — title, description, status, dates */}
      <form
        action={(fd) => startTransition(() => formAction(fd))}
        className="flex flex-col gap-6"
      >
        <input type="hidden" name="id" value={task.id} />

        <label className="flex flex-col gap-2">
          <span className="eyebrow">Tytuł</span>
          {/* F12-K57: textarea zamiast input żeby długie tytuły zawijały
              się w wiele linii (klient: 'jeśli tytuł dłuższy niż szerokość
              to potrzebujemy zawijanie'). rows=1 + field-sizing-content
              powoduje auto-grow. Max 2000 znaków zamiast 200. */}
          <textarea
            name="title"
            required
            maxLength={2000}
            rows={1}
            readOnly={!canEdit}
            defaultValue={task.title}
            aria-invalid={!!fieldErrors?.title}
            className="resize-none border-b border-border bg-transparent pb-2 font-display text-[1.4rem] leading-[1.15] tracking-[-0.02em] outline-none focus:border-primary aria-[invalid=true]:border-destructive md:text-[1.8rem] [field-sizing:content]"
          />
          {fieldErrors?.title && (
            <span className="font-mono text-[0.68rem] text-destructive">
              {fieldErrors.title}
            </span>
          )}
        </label>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Status</span>
            <StatusPill
              name="statusColumnId"
              statuses={statusColumns}
              defaultValue={task.statusColumnId}
              disabled={!canEdit}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Start</span>
            <DateTimePicker
              name="startAt"
              defaultValue={task.startAt}
              disabled={!canEdit}
              placeholder="Brak daty startu"
              label="Data startu"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Koniec</span>
            <DateTimePicker
              name="stopAt"
              defaultValue={task.stopAt}
              disabled={!canEdit}
              placeholder="Brak daty końca"
              label="Data końca"
            />
          </div>
        </div>

        <ReminderField
          defaultValue={task.reminderOffset ?? "none"}
          reminderAt={task.reminderAt}
          disabled={!canEdit}
        />

        {/* F11-17 (#24): recurring tasks. Template task (rule != null)
            spawns instances via cron daily at 00:05 UTC. Instances
            (recurrenceParentId set) are read-only here — user changes
            the template, not individual instances. */}
        {!task.recurrenceParentId && (
          <RecurrencePicker
            taskId={task.id}
            rule={task.recurrenceRule}
            disabled={!canEdit}
          />
        )}
        {task.recurrenceParentId && (
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
            🔁 instancja zadania cyklicznego — edytuj szablon żeby zmienić regułę
          </p>
        )}

        {!state?.ok && state?.error && (
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
            {state.error}
          </p>
        )}

        {canEdit && (
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
            >
              {pending ? "Zapisuję…" : "Zapisz"}
            </button>
            {flash && (
              <span className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-primary">
                {flash}
              </span>
            )}
          </div>
        )}
      </form>

      {/* F12-K54: custom kolumny tabeli — pokazują tutaj te same wartości
          co w widoku tabeli, edycja w obie strony. Tylko gdy board ma
          jakieś custom columns (inaczej sekcja jest hidden). */}
      {customColumns.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="eyebrow">Pola dodatkowe</span>
          <div className="grid gap-3 rounded-xl border border-border bg-card/50 p-4 sm:grid-cols-2">
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
        </section>
      )}

      {/* F12-K40: time tracking — Rozpocznij/Zatrzymaj/Zakończ. */}
      <TaskTimer
        taskId={task.id}
        accumulatedSeconds={task.timeTrackedSeconds}
        startedAt={task.timerStartedAt}
        completedAt={task.timerCompletedAt}
        canEdit={canEdit}
      />

      {/* Description — own save flow (view/edit modes) */}
      <DescriptionSection
        taskId={task.id}
        initial={task.descriptionJson}
        canEdit={canEdit}
      />

      {/* Milestone — instant select (onChange fires the action).
          F12-K21: controlled value + router.refresh po akcji. Wcześniej
          select miał `defaultValue` (uncontrolled) + React 19 form-reset,
          przez co po server-save select wracał do oryginalnego value
          jeśli intercepted modal route nie zrewalidował się na czas. */}
      <MilestoneSection
        // F12-K21: key bound to milestoneId — gdy server zwraca nową
        // wartość, komponent remountuje się i state startuje od fresh
        // currentMilestoneId. Eliminuje wszelkie potential stale-state
        // sync issues bez wywoływania setState w render body.
        key={`ms-${task.milestoneId ?? "none"}`}
        taskId={task.id}
        currentMilestoneId={task.milestoneId}
        milestones={milestones}
        canEdit={canEdit}
      />

      {/* Assignees */}
      <section className="flex flex-col gap-3">
        <span className="eyebrow">Osoby</span>
        <div className="flex flex-wrap gap-2">
          {allMembers.map((m) => {
            const active = assigneeIds.has(m.id);
            return (
              <form key={m.id} action={toggleAssigneeWithRefresh} className="m-0">
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="userId" value={m.id} />
                <button
                  type="submit"
                  disabled={!canEdit}
                  className="group inline-flex items-center gap-2 rounded-full border border-border px-2 py-1 text-[0.82rem] transition-colors data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-foreground hover:border-primary/60 disabled:cursor-not-allowed"
                  data-active={active ? "true" : "false"}
                  title={m.email}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.62rem] font-bold text-white">
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (m.name ?? m.email).slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <span className="truncate">{m.name ?? m.email.split("@")[0]}</span>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      {/* Tags */}
      <TagsSection
        workspaceId={workspaceId}
        taskId={task.id}
        allTags={allTags}
        tagIds={tagIds}
        canEdit={canEdit}
      />

      {/* Attachments */}
      <AttachmentsSection
        taskId={task.id}
        attachments={attachments}
        canUpload={canUpload}
        canModerate={canModerateAttachments}
      />

      {/* Subtasks (checklist) */}
      <SubtasksSection
        taskId={task.id}
        subtasks={subtasks}
        canManage={canManageSubtasks}
      />

      {/* Poll / głosowanie */}
      <PollSection
        taskId={task.id}
        poll={poll}
        canManage={canManagePoll}
        canVote={canVote}
        currentUserId={currentUserId}
      />

      {/* Comments */}
      <CommentsSection
        taskId={task.id}
        comments={comments}
        canComment={canComment}
        canModerateComments={canModerateComments}
        members={allMembers}
      />

      {/* Activity log */}
      <ActivityLog entries={activity} />
    </div>
  );
}

// F12-K21: milestone picker — controlled select. Lokalny state startuje
// od `currentMilestoneId` (key na poziomie parent'a wymusza remount
// przy zmianie propa, więc state zawsze świeży). Po onChange optymizujemy
// UI od razu, server save w tle, router.refresh() wymusza świeże props
// dla intercepted modal route'u.
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

  // F12-K30: PortalDropdown zamiast natywnego <select>. Sentinel "__none__"
  // bo PortalDropdown traktuje pustego stringa jako 'no selection' (i nie
  // dałoby się go wybrać jako "Brak"). Convert in/out na granicy.
  const NONE = "__none__";
  const handleChange = (next: string) => {
    const persisted = next === NONE ? "" : next;
    setValue(persisted); // optimistic — UI nie czeka na server
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("milestoneId", persisted);
    startTransition(async () => {
      await assignTaskToMilestoneAction(fd);
      router.refresh();
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <span className="eyebrow inline-flex items-center gap-1.5">
        <Flag size={11} />
        Milestone
      </span>
      <div className="flex items-center gap-2">
        <PortalDropdown<string>
          ariaLabel="Wybierz milestone"
          disabled={!canEdit}
          width={280}
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
          triggerClassName="inline-flex h-9 min-w-[260px] items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-[0.86rem] outline-none transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {milestones.length === 0 && (
          <span className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground">
            utwórz milestone w roadmapie
          </span>
        )}
      </div>
    </section>
  );
}

// F12-K30: hidden-input + PortalDropdown żeby reminderOffset dalej trafiał
// do FormData submitu (parent form). Native <select> w form'ie miało
// natywny dropdown, który klient zgłosił jako brzydki UX (mac-native
// styling, dark-mode broken).
function ReminderField({
  defaultValue,
  reminderAt,
  disabled,
}: {
  defaultValue: string;
  reminderAt: string | null;
  disabled: boolean;
}) {
  const [value, setValue] = useState<string>(defaultValue);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="eyebrow inline-flex items-center gap-1.5">
        <Bell size={11} />
        Przypomnienie
      </span>
      <input type="hidden" name="reminderOffset" value={value} />
      <PortalDropdown<string>
        ariaLabel="Wybierz czas przypomnienia"
        disabled={disabled}
        width={240}
        value={value}
        onChange={setValue}
        options={[
          { value: "none", label: "— brak —" },
          { value: "1h", label: "1 godz. przed końcem" },
          { value: "4h", label: "4 godz. przed końcem" },
          { value: "1d", label: "1 dzień przed" },
          { value: "3d", label: "3 dni przed" },
        ]}
      />
      {reminderAt && (
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
          wyśle się{" "}
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
  canEdit,
}: {
  workspaceId: string;
  taskId: string;
  allTags: { id: string; name: string; colorHex: string }[];
  tagIds: Set<string>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [color, setColor] = useState(TAG_COLORS[0]);

  // F12-K4: see comment in TaskDetail — same belt-and-suspenders pattern
  // for tag toggles so the table re-fetches even if Realtime is silent.
  const toggleTagWithRefresh = async (fd: FormData) => {
    await toggleTagAction(fd);
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-3">
      <span className="eyebrow">Tagi</span>
      {allTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {allTags.map((t) => {
            const active = tagIds.has(t.id);
            return (
              <form key={t.id} action={toggleTagWithRefresh} className="m-0">
                <input type="hidden" name="taskId" value={taskId} />
                <input type="hidden" name="tagId" value={t.id} />
                <button
                  type="submit"
                  disabled={!canEdit}
                  data-active={active ? "true" : "false"}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.78rem] font-medium transition-[border-color,opacity] data-[active=false]:opacity-50 hover:opacity-100 disabled:cursor-not-allowed"
                  style={{
                    borderColor: active ? t.colorHex : "var(--border)",
                    background: active ? `${t.colorHex}1A` : "transparent",
                    color: active ? t.colorHex : "var(--foreground)",
                  }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: t.colorHex }} />
                  {t.name}
                </button>
              </form>
            );
          })}
        </div>
      ) : (
        <p className="text-[0.88rem] text-muted-foreground">Brak tagów.</p>
      )}

      {canEdit && (
        creating ? (
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
              className="flex-1 min-w-[140px] rounded-md bg-transparent px-2 py-1 text-[0.82rem] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
            <div className="flex items-center gap-1">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-110"
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
              className="grid h-8 w-8 place-items-center rounded-md bg-brand-gradient text-white transition-opacity hover:opacity-90"
              aria-label="Utwórz tag"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Anuluj"
            >
              <X size={14} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-dashed border-border px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            <Plus size={12} /> Nowy tag
          </button>
        )
      )}
    </section>
  );
}
