"use client";

import { startTransition, useActionState, useEffect, useState, useRef } from "react";
import { EmojiPicker, insertAtCursor } from "@/components/ui/emoji-picker";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  linkMilestoneAction,
  unlinkMilestoneAction,
  updateMilestoneAction,
  type CreateMilestoneState,
  type UpdateMilestoneState,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/milestone-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { IconClose, IconLink } from "@/components/ui/icons";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { textToDoc } from "@/components/roadmap/roadmap-model";
import type {
  LinkedChildMilestone,
  WorkspaceBoardMilestones,
} from "@/components/roadmap/roadmap-view";

export interface MilestoneMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface InitialMilestone {
  id: string;
  title: string;
  startAt: string;
  stopAt: string;
  assignee: MilestoneMember | null;
  descriptionText?: string;
  linkedChildren?: LinkedChildMilestone[];
}

export interface MilestonePatch {
  title: string;
  startAt: string;
  stopAt: string;
  assignee: MilestoneMember | null;
  descriptionText: string;
}

type Mode = "create" | "edit";

const memberName = (m: MilestoneMember) => m.name ?? m.email.split("@")[0]!;
const dayFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric" });

export function MilestoneDialog({
  workspaceId,
  boardId,
  boardViewId,
  members,
  mode,
  initial,
  milestoneLabel,
  canDelete,
  onClose,
  onSaved,
  onDeleted,
  isAggregator,
  workspaceMilestones,
}: {
  workspaceId: string;
  boardId: string;
  // F12-K134: custom view scope — nowe milestones lądują tylko w tym view.
  boardViewId?: string;
  members: MilestoneMember[];
  mode: Mode;
  initial: InitialMilestone | null;
  /** „M2" — pozycja na roadmapie, w nagłówku dialogu. */
  milestoneLabel?: string;
  canDelete?: boolean;
  onClose: () => void;
  /** Optimistic echo — lista pokazuje zmianę zanim wróci revalidate. */
  onSaved?: (id: string, patch: MilestonePatch) => void;
  onDeleted?: (id: string) => void;
  isAggregator: boolean;
  workspaceMilestones: WorkspaceBoardMilestones[];
}) {
  const isEdit = mode === "edit" && initial != null;

  const [createState, createAction, creating] = useActionState<CreateMilestoneState, FormData>(createMilestoneAction, null);
  const [updateState, updateAction, updating] = useActionState<UpdateMilestoneState, FormData>(updateMilestoneAction, null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const state = isEdit ? updateState : createState;
  const pending = (isEdit ? updating : creating) || deleting;
  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;

  // Default: new milestone spans today → +14 days. Captured once at mount so
  // dialog re-renders don't shift the defaults mid-interaction.
  const [defaults] = useState(() => {
    const now = Date.now();
    return { start: new Date(now).toISOString(), stop: new Date(now + 14 * 86_400_000).toISOString() };
  });
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.descriptionText ?? "");
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [assigneeId, setAssigneeId] = useState(initial?.assignee?.id ?? "");
  const [startAt, setStartAt] = useState(initial?.startAt ?? defaults.start);
  const [stopAt, setStopAt] = useState(initial?.stopAt ?? defaults.stop);

  const patch = (): MilestonePatch => ({
    title,
    startAt,
    stopAt,
    assignee: members.find((m) => m.id === assigneeId) ?? null,
    descriptionText: description,
  });

  // Creating needs the id the action returns, so it waits. Editing does not:
  // waiting for the round trip put the change on screen 0.9–1.4 s after the
  // click, so an edit echoes upwards and closes immediately (below) and only
  // the create path lands here. A rejected save corrects itself when the
  // revalidated `milestones` prop clears the optimistic overlay.
  useEffect(() => {
    if (!state?.ok) return;
    onSaved?.(state.milestoneId, patch());
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- patch() reads the current field state on purpose
  }, [state]);

  const remove = () => {
    if (!initial) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const fd = new FormData();
    fd.set("id", initial.id);
    setDeleting(true);
    startTransition(async () => {
      await deleteMilestoneAction(fd);
      onDeleted?.(initial.id);
      onClose();
    });
  };

  const assigneeItems = [
    { value: "", label: "— brak —" },
    ...members.map((m) => ({
      value: m.id,
      label: memberName(m),
      icon: <Avatar name={memberName(m)} src={m.avatarUrl} size={20} />,
    })),
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-ui="milestone-dialog" size="sm">
        <DialogHeader>
          <DialogTitle>
            {isEdit && initial
              ? `Milestone ${milestoneLabel ? `${milestoneLabel} · ` : ""}${initial.title}`
              : "Nowy milestone"}
          </DialogTitle>
        </DialogHeader>

        <form
          action={(fd) => startTransition(() => (isEdit ? updateAction(fd) : createAction(fd)))}
          onSubmit={(e) => {
            // Editing bypasses the form action: React holds a form-action
            // transition open until the server round trip settles, which put
            // the change on screen ~1.3 s after the click. Submitting by hand
            // lets the optimistic echo commit in the same frame.
            if (!isEdit || !initial || !title.trim()) return;
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSaved?.(initial.id, patch());
            onClose();
            startTransition(async () => {
              await updateMilestoneAction(null, fd);
            });
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="boardId" value={boardId} />
          {boardViewId && <input type="hidden" name="boardViewId" value={boardViewId} />}
          {isEdit && initial && <input type="hidden" name="id" value={initial.id} />}
          <input type="hidden" name="assigneeId" value={assigneeId} />
          <input type="hidden" name="descriptionJson" value={textToDoc(description)} />

          <DialogBody className="flex flex-col gap-3">
            <div>
              <Label htmlFor="milestone-title">Tytuł</Label>
              <Input
                id="milestone-title"
                name="title"
                required
                maxLength={200}
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={fieldErrors?.title}
                className="mt-[5px]"
              />
            </div>

            <div>
              <span className="flex items-center gap-1.5">
                <Label htmlFor="milestone-description">Opis</Label>
                <EmojiPicker onPick={(e) => insertAtCursor(descriptionRef.current, e)} />
              </span>
              <Textarea
                ref={descriptionRef}
                id="milestone-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Cel, zakres, kryteria sukcesu…"
                rows={3}
                className="mt-[5px] min-h-[52px]"
              />
            </div>

            <div className="flex gap-3">
              <div className="min-w-0 flex-1">
                <Label>Start</Label>
                <div className="mt-[5px]">
                  <DateTimePicker
                    name="startAt"
                    defaultValue={startAt}
                    onChange={setStartAt}
                    dateOnly
                    label="Data startu"
                    placeholder="Wybierz start"
                    format={(d) => dayFmt.format(d)}
                  />
                </div>
                {fieldErrors?.startAt && <p className="mt-1 text-xs text-danger-text">{fieldErrors.startAt}</p>}
              </div>
              <div className="min-w-0 flex-1">
                <Label>Koniec</Label>
                <div className="mt-[5px]">
                  <DateTimePicker
                    name="stopAt"
                    defaultValue={stopAt}
                    onChange={setStopAt}
                    dateOnly
                    label="Data końca"
                    placeholder="Wybierz koniec"
                    format={(d) => dayFmt.format(d)}
                  />
                </div>
                {fieldErrors?.stopAt && <p className="mt-1 text-xs text-danger-text">{fieldErrors.stopAt}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="milestone-assignee">Odpowiedzialny</Label>
              <Select
                id="milestone-assignee"
                items={assigneeItems}
                value={assigneeId}
                onValueChange={setAssigneeId}
                aria-label="Odpowiedzialny"
                className="mt-[5px]"
              />
              {fieldErrors?.assigneeId && <p className="mt-1 text-xs text-danger-text">{fieldErrors.assigneeId}</p>}
            </div>

            {isEdit && isAggregator && initial && (
              <LinkedMilestonesSection
                parentId={initial.id}
                existingLinks={initial.linkedChildren ?? []}
                workspaceMilestones={workspaceMilestones}
              />
            )}

            {!state?.ok && state?.error && <p className="text-xs text-danger-text">{state.error}</p>}
          </DialogBody>

          <DialogFooter className="justify-between">
            {isEdit && canDelete ? (
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="-ml-1.5 inline-flex h-7 items-center rounded-md px-1.5 text-xs font-medium text-danger-text outline-none hover:bg-chip-red-bg active:bg-chip-red-bg/70 disabled:text-n-400"
              >
                {confirmDelete ? "Na pewno? Usuń milestone" : "Usuń milestone"}
              </button>
            ) : (
              <span />
            )}
            <span className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>
                Anuluj
              </Button>
              <Button type="submit" loading={pending} disabled={pending}>
                Zapisz
              </Button>
            </span>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Aggregator linker (Board.isAggregator). Lists the sub-board milestones this
// one aggregates + a picker of what's still available. Both sides are server
// actions that revalidate the roadmap.
function LinkedMilestonesSection({
  parentId,
  existingLinks,
  workspaceMilestones,
}: {
  parentId: string;
  existingLinks: LinkedChildMilestone[];
  workspaceMilestones: WorkspaceBoardMilestones[];
}) {
  const linkedIds = new Set(existingLinks.map((l) => l.id));
  const availableBoards = workspaceMilestones
    .map((b) => ({ ...b, milestones: b.milestones.filter((m) => !linkedIds.has(m.id)) }))
    .filter((b) => b.milestones.length > 0);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-canvas p-3">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-n-700">
        <IconLink width={13} height={13} /> Linkowane z innych tablic
      </span>

      {existingLinks.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {existingLinks.map((child) => (
            <li key={child.linkId} className="flex items-center gap-2 rounded-sm border border-border bg-card px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-xs">
                <span className="text-muted-foreground">{child.boardName} · </span>
                {child.title}
              </span>
              <form action={(fd) => void unlinkMilestoneAction(fd)} className="m-0 shrink-0">
                <input type="hidden" name="parentId" value={parentId} />
                <input type="hidden" name="childId" value={child.id} />
                <button
                  type="submit"
                  aria-label={`Odlinkuj ${child.title}`}
                  title="Odlinkuj"
                  className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-n-100 hover:text-danger-text active:bg-n-200"
                >
                  <IconClose width={12} height={12} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Brak linkowanych milestone&apos;ów. Dodaj poniżej, żeby zebrać cele z innych tablic.
        </p>
      )}

      {availableBoards.length > 0 ? (
        <form action={(fd) => void linkMilestoneAction(fd)} className="flex items-center gap-2">
          <input type="hidden" name="parentId" value={parentId} />
          <select
            name="childId"
            required
            defaultValue=""
            aria-label="Milestone z innej tablicy"
            className="h-8 min-w-0 flex-1 rounded-sm border border-input-border bg-card px-2 text-xs text-foreground outline-none hover:border-input-border-hover focus:border-orange-500"
          >
            <option value="" disabled>
              Wybierz milestone z innej tablicy…
            </option>
            {availableBoards.map((b) => (
              <optgroup key={b.boardId} label={b.boardName}>
                {b.milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <Button type="submit" variant="secondary" size="sm">
            Dodaj link
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">Wszystkie dostępne milestone&apos;y są już zlinkowane.</p>
      )}
    </div>
  );
}
