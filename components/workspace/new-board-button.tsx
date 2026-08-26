"use client";

// C1: „Nowa tablica” — the primary header button and the dashed grid tile both
// open the same dialog (name, opis, widoki). Calls `createBoardAction` unchanged.

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBoardAction, type CreateBoardState } from "@/app/(app)/w/[workspaceId]/b/actions";
import { Button } from "@/components/ui/button";
import { CheckMark } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconPlus } from "@/components/ui/icons";
import { VIEW_ICON, VIEW_LABEL, type ViewName } from "@/components/view/view-switcher";

// Prisma ViewType values the create action seeds.
const DIALOG_VIEWS: { value: string; name: ViewName }[] = [
  { value: "TABLE", name: "table" },
  { value: "KANBAN", name: "kanban" },
  { value: "GANTT", name: "gantt" },
  { value: "ROADMAP", name: "roadmap" },
  { value: "CALENDAR", name: "calendar" },
  { value: "WHITEBOARD", name: "whiteboard" },
  { value: "TASKLINE", name: "taskline" },
];

export function NewBoardButton({
  workspaceId,
  enabledViews,
  variant = "primary",
  autoOpen = false,
}: {
  workspaceId: string;
  /** Workspace-level enabled view types (uppercase) — the board can only pick a subset. */
  enabledViews: string[];
  variant?: "primary" | "tile";
  /** `?new=board` from the sidebar / Utwórz menu. */
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(autoOpen);
  const [state, formAction, pending] = useActionState<CreateBoardState, FormData>(createBoardAction, null);

  useEffect(() => {
    if (!state?.ok) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
    router.push(`/w/${workspaceId}/b/${state.boardId}/table`);
    router.refresh();
  }, [state, router, workspaceId]);

  const close = (next: boolean) => {
    setOpen(next);
    // Drop `?new=board` so a back/forward does not reopen the dialog.
    if (!next && autoOpen) router.replace(`/w/${workspaceId}`);
  };

  const options = DIALOG_VIEWS.filter((v) => enabledViews.includes(v.value));

  return (
    <>
      {variant === "primary" ? (
        <Button onClick={() => setOpen(true)}>
          <IconPlus />
          Nowa tablica
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[150px] w-full flex-col items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-n-400 p-4 text-sm font-medium text-muted-foreground outline-none hover:border-orange-500 hover:text-orange-700 focus-visible:border-orange-500 focus-visible:shadow-[var(--focus)] active:border-orange-600 active:text-orange-800"
        >
          <IconPlus width={18} height={18} />
          Nowa tablica
        </button>
      )}

      <Dialog open={open} onOpenChange={close}>
        <DialogContent size="lg" data-ui="create-board-dialog" initialFocus={nameRef}>
          <DialogHeader>
            <DialogTitle>Nowa tablica</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              fd.set("workspaceId", workspaceId);
              startTransition(() => formAction(fd));
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-board-name">Nazwa</Label>
                <Input
                  ref={nameRef}
                  id="new-board-name"
                  name="name"
                  required
                  maxLength={80}
                  placeholder="np. Backlog, Kampania Q3"
                  error={state && !state.ok ? state.fieldErrors?.name : undefined}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-board-description">Opis</Label>
                <Textarea
                  id="new-board-description"
                  name="description"
                  rows={2}
                  maxLength={280}
                  placeholder="Opcjonalny — co ta tablica śledzi?"
                  error={state && !state.ok ? state.fieldErrors?.description : undefined}
                />
              </div>
              {options.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="eyebrow">Widoki tablicy</span>
                  <div className="grid grid-cols-3 gap-1.5 max-md:grid-cols-2">
                    {options.map((v) => (
                      // Native checkbox: the Checkbox primitive's hidden input drops `value`,
                      // and the action reads `formData.getAll("enabledViews")`.
                      <label
                        key={v.value}
                        className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 text-sm text-n-700 hover:bg-n-100 has-[:focus-visible]:border-orange-500 has-[:focus-visible]:shadow-[var(--focus)]"
                      >
                        <input type="checkbox" name="enabledViews" value={v.value} defaultChecked className="peer sr-only" />
                        <span
                          aria-hidden
                          className="grid size-4 shrink-0 place-items-center rounded-sm border-[1.5px] border-n-400 text-white peer-checked:border-control-on peer-checked:bg-control-on [&_svg]:size-2.5 [&_svg]:opacity-0 peer-checked:[&_svg]:opacity-100"
                        >
                          <CheckMark size={10} />
                        </span>
                        <span className="text-n-500 [&_svg]:size-3.5">{VIEW_ICON[v.name]}</span>
                        <span className="truncate">{VIEW_LABEL[v.name]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {state && !state.ok && state.error && <p className="text-xs text-danger-text">{state.error}</p>}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => close(false)}>
                Anuluj
              </Button>
              <Button type="submit" loading={pending} disabled={pending}>
                Utwórz tablicę
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
