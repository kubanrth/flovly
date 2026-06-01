"use client";

import { useActionState, startTransition, useEffect, useState } from "react";
import { Link as LinkIcon, X } from "lucide-react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import {
  createMilestoneAction,
  linkMilestoneAction,
  unlinkMilestoneAction,
  updateMilestoneAction,
  type CreateMilestoneState,
  type UpdateMilestoneState,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/milestone-actions";
import { RichTextEditor } from "@/components/task/rich-text-editor";
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
  linkedChildren?: LinkedChildMilestone[];
}

type Mode = "create" | "edit";

export function MilestoneDialog({
  workspaceId,
  boardId,
  members,
  mode,
  initial,
  onClose,
  isAggregator,
  workspaceMilestones,
}: {
  workspaceId: string;
  boardId: string;
  members: MilestoneMember[];
  mode: Mode;
  initial: InitialMilestone | null;
  onClose: () => void;
  isAggregator: boolean;
  workspaceMilestones: WorkspaceBoardMilestones[];
}) {
  const isEdit = mode === "edit" && initial != null;

  const [createState, createAction, creating] = useActionState<CreateMilestoneState, FormData>(
    createMilestoneAction,
    null,
  );
  const [updateState, updateAction, updating] = useActionState<UpdateMilestoneState, FormData>(
    updateMilestoneAction,
    null,
  );

  const state = isEdit ? updateState : createState;
  const pending = isEdit ? updating : creating;
  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;

  // Close after a successful submit.
  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  // Default: new milestone spans today → +14 days. Captured once at mount
  // so dialog re-renders don't shift the defaults mid-interaction.
  const [defaults] = useState(() => {
    const now = Date.now();
    return {
      start: new Date(now).toISOString(),
      stop: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });
  const defaultStart = initial?.startAt ?? defaults.start;
  const defaultStop = initial?.stopAt ?? defaults.stop;

  return (
    <BaseDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" />
        <BaseDialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between border-b border-border px-6 py-3">
            <BaseDialog.Title className="eyebrow">
              {isEdit ? "Edytuj milestone" : "Nowy milestone"}
            </BaseDialog.Title>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Zamknij"
            >
              <X size={16} />
            </button>
          </div>

          <form
            action={(fd) => startTransition(() => (isEdit ? updateAction(fd) : createAction(fd)))}
            className="flex max-h-full flex-col gap-5 overflow-y-auto px-6 py-6"
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="boardId" value={boardId} />
            {isEdit && initial && <input type="hidden" name="id" value={initial.id} />}

            <label className="flex flex-col gap-2">
              <span className="eyebrow">Tytuł</span>
              <input
                name="title"
                type="text"
                required
                maxLength={200}
                defaultValue={initial?.title ?? ""}
                autoFocus
                aria-invalid={!!fieldErrors?.title}
                className="border-b border-border bg-transparent pb-2 font-display text-[1.4rem] leading-[1.2] tracking-[-0.02em] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
              />
              {fieldErrors?.title && (
                <span className="font-mono text-[0.68rem] text-destructive">
                  {fieldErrors.title}
                </span>
              )}
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="eyebrow">Start</span>
                <DateTimePicker
                  name="startAt"
                  defaultValue={defaultStart}
                  placeholder="Wybierz start"
                  label="Data startu"
                />
                {fieldErrors?.startAt && (
                  <span className="font-mono text-[0.68rem] text-destructive">
                    {fieldErrors.startAt}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <span className="eyebrow">Koniec</span>
                <DateTimePicker
                  name="stopAt"
                  defaultValue={defaultStop}
                  placeholder="Wybierz koniec"
                  label="Data końca"
                />
                {fieldErrors?.stopAt && (
                  <span className="font-mono text-[0.68rem] text-destructive">
                    {fieldErrors.stopAt}
                  </span>
                )}
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <span className="eyebrow">Assignee</span>
              <select
                name="assigneeId"
                defaultValue={initial?.assignee?.id ?? ""}
                className="h-10 appearance-none border-b border-border bg-transparent pb-1 font-mono text-[0.82rem] uppercase tracking-[0.12em] outline-none focus:border-primary"
              >
                <option value="">— brak —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.email.split("@")[0]}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-2">
              <span className="eyebrow">Opis</span>
              <RichTextEditor
                name="descriptionJson"
                initial={null}
                readOnly={false}
                placeholder="Cel, zakres, kryteria sukcesu…"
              />
            </div>

            {isEdit && isAggregator && initial && (
              <LinkedMilestonesSection
                parentId={initial.id}
                existingLinks={initial.linkedChildren ?? []}
                workspaceMilestones={workspaceMilestones}
              />
            )}

            {!state?.ok && state?.error && (
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
                {state.error}
              </p>
            )}

            <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-end gap-2 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 font-sans text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
              >
                {pending ? "Zapisuję…" : isEdit ? "Zapisz" : "Utwórz"}
              </button>
            </div>
          </form>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

// Aggregator linker inside the edit dialog. Lists existing links + a picker of
// available milestones from other boards. Submit is a server action that
// revalidates the roadmap, so the dialog refreshes when its parent re-renders
// (RoadmapView passes a fresh `initial` keyed by id after revalidate).
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
  // Hide boards that have nothing left to offer (everything already linked).
  const availableBoards = workspaceMilestones
    .map((b) => ({
      ...b,
      milestones: b.milestones.filter((m) => !linkedIds.has(m.id)),
    }))
    .filter((b) => b.milestones.length > 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
        <LinkIcon size={11} /> Linkowane z innych tablic
      </div>

      {existingLinks.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {existingLinks.map((child) => (
            <li
              key={child.linkId}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[0.86rem] font-medium">
                  {child.title}
                </span>
                <span className="truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">
                  {child.boardName}
                </span>
              </div>
              <form
                action={(fd) => {
                  void unlinkMilestoneAction(fd);
                }}
                className="m-0 shrink-0"
              >
                <input type="hidden" name="parentId" value={parentId} />
                <input type="hidden" name="childId" value={child.id} />
                <button
                  type="submit"
                  aria-label={`Odlinkuj ${child.title}`}
                  title="Odlinkuj"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X size={13} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.82rem] text-muted-foreground">
          Brak linkowanych milestonów. Dodaj poniżej żeby zagregować cele z innych tablic.
        </p>
      )}

      {availableBoards.length > 0 ? (
        <form
          action={(fd) => {
            void linkMilestoneAction(fd);
          }}
          className="flex items-center gap-2"
        >
          <input type="hidden" name="parentId" value={parentId} />
          <select
            name="childId"
            required
            defaultValue=""
            className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-[0.86rem] outline-none focus:border-primary"
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
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Dodaj link
          </button>
        </form>
      ) : (
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/70">
          Wszystkie dostępne milestony już zlinkowane.
        </p>
      )}
    </div>
  );
}
