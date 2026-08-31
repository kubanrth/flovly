"use client";

// Redesign v5 (B3): „Nowe zadanie" — dialog 480px (desktop) / full-height
// bottom sheet (<768). Enter = utwórz i zamknij, ⇧Enter = utwórz i dodaj
// kolejne. Termin i Przypisani dopinane po utworzeniu (patch/toggle), bo
// createTaskAction ich nie przyjmuje — bez zmian w akcjach.

import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, type DialogSize } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PersonPicker } from "@/components/ui/combobox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { StatusChip } from "@/components/ui/chip";
import { PriorityIcon, PRIORITY_LABEL, type PriorityLevel } from "@/components/ui/priority-icon";
import { Avatar } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/kbd";
import { IconClose, IconPlus } from "@/components/ui/icons";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import {
  createTaskAction,
  patchTaskAction,
  toggleAssigneeAction,
} from "@/app/(app)/w/[workspaceId]/t/actions";
import type { TaskPriorityValue } from "@/lib/task-priority";
import type { ShellBoard } from "@/components/layout/shell-types";
import { getBoardMetaAction, type BoardMeta } from "./create-task-meta";
import { hueForColor } from "@/components/ui/status-hue";

// ─── shared with import-tasks-dialog ────────────────────────────────────

// Statusy, członkowie i widoki nazwane tablicy — ładowane przy otwarciu.
export function useBoardMeta(workspaceId: string, boardId: string | null, enabled: boolean) {
  const [meta, setMeta] = useState<(BoardMeta & { boardId: string }) | null>(null);
  const loaded = meta?.boardId;
  useEffect(() => {
    if (!enabled || !boardId || loaded === boardId) return;
    let alive = true;
    getBoardMetaAction(workspaceId, boardId)
      .then((m) => { if (alive && m) setMeta({ ...m, boardId }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [enabled, workspaceId, boardId, loaded]);
  return loaded === boardId ? meta : null;
}

// Desktop: Dialog (52px header / body 16×20 / footer). Mobile: pełnoekranowy bottom sheet.
export function ResponsiveDialog({ open, onOpenChange, title, size = "md", dataUi, footer, children, onKeyDown }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  size?: DialogSize;
  dataUi: string;
  footer: ReactNode;
  children: ReactNode;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" data-ui={dataUi} className="h-dvh max-h-dvh" onKeyDown={onKeyDown}>
          <SheetHeader className="min-h-[52px] justify-center"><SheetTitle>{title}</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {/* Wiekszy odstep od dolu niz zwykly `.safe-bottom`: w Safari z widocznym
              dolnym paskiem wciecie bezpiecznego obszaru wynosi 0, a przyciski
              akcji stały wtedy tuz przy krawedzi, pod polprzezroczystym paskiem. */}
          <SheetFooter className="flex-wrap pb-[max(env(safe-area-inset-bottom),1.5rem)]">{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={size} data-ui={dataUi} onKeyDown={onKeyDown}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <DialogBody>{children}</DialogBody>
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Nowe zadanie ───────────────────────────────────────────────────────

const PRIORITY_LEVEL: Record<Exclude<TaskPriorityValue, "NONE">, PriorityLevel> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const PRIORITY_ITEMS = [
  ...(Object.keys(PRIORITY_LEVEL) as (keyof typeof PRIORITY_LEVEL)[]).map((value) => {
    const level = PRIORITY_LEVEL[value];
    return { value: value as TaskPriorityValue, icon: <PriorityIcon level={level} size={13} />, label: `P${level} ${PRIORITY_LABEL[level]}` };
  }),
  { value: "NONE" as TaskPriorityValue, label: "Brak" },
];
const DEFAULT_VIEW = "default";

export function CreateTaskButton({ workspaceId, boardId, viewId }: {
  workspaceId: string;
  boardId: string;
  // F12-K131: nowy task auto-przypisany do tego custom view'a (TaskView).
  viewId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}><IconPlus />Nowe zadanie</Button>
      <CreateTaskDialog workspaceId={workspaceId} boardId={boardId} viewId={viewId} open={open} onOpenChange={setOpen} />
    </>
  );
}

export interface CreateTaskDialogProps {
  workspaceId: string;
  // Brak boardId (np. z top-bar „Utwórz" poza tablicą) → pole „Tablica" z `boards`.
  boardId?: string;
  boards?: ShellBoard[];
  viewId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ workspaceId, boardId, boards = [], viewId, open, onOpenChange }: CreateTaskDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const size = isMobile ? "lg" : "md";
  const titleRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [pickedBoard, setPickedBoard] = useState<string | null>(null);
  const board = boardId ?? pickedBoard;
  const wsId = boards.find((b) => b.id === board)?.workspaceId ?? workspaceId;
  const meta = useBoardMeta(wsId, board, open);

  const [title, setTitle] = useState("");
  const [statusId, setStatusId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriorityValue>("MEDIUM");
  const [stopAt, setStopAt] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [view, setView] = useState<string | null>(viewId ?? null);
  const [error, setError] = useState<string | null>(null);

  const status = statusId && meta?.statuses.some((s) => s.id === statusId) ? statusId : (meta?.statuses[0]?.id ?? null);
  const people = (meta?.members ?? []).map((m) => ({ id: m.id, name: m.name, avatar: m.avatarUrl }));
  const boardItems = boards.length
    ? boards.map((b) => ({ value: b.id, label: `${b.workspaceName} / ${b.name}` }))
    : board && meta ? [{ value: board, label: meta.boardName }] : [];

  const reset = () => {
    setTitle(""); setStatusId(null); setPriority("MEDIUM"); setStopAt(""); setAssignees([]); setView(viewId ?? null); setError(null);
    if (!boardId) setPickedBoard(null);
  };
  const handleOpenChange = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const submit = (keepOpen: boolean) => {
    if (pending || !board) return;
    setError(null);
    const fd = new FormData();
    fd.set("workspaceId", wsId);
    fd.set("boardId", board);
    fd.set("title", title);
    if (status) fd.set("statusColumnId", status);
    fd.set("priority", priority);
    if (view && view !== DEFAULT_VIEW) fd.set("viewId", view);
    startTransition(async () => {
      const res = await createTaskAction(null, fd);
      if (!res?.ok) {
        setError((res && !res.ok && (res.fieldErrors?.title ?? res.error)) || "Nie udało się utworzyć zadania.");
        return;
      }
      const extras: Promise<unknown>[] = [];
      if (stopAt) {
        const p = new FormData(); p.set("id", res.taskId); p.set("stopAt", stopAt);
        extras.push(patchTaskAction(p));
      }
      for (const userId of assignees) {
        const a = new FormData(); a.set("taskId", res.taskId); a.set("userId", userId);
        extras.push(toggleAssigneeAction(a));
      }
      await Promise.all(extras);
      if (keepOpen) {
        setTitle("");
        titleRef.current?.focus();
        router.refresh();
        return;
      }
      reset();
      onOpenChange(false);
      // returnTo → modal close wraca na stronę, z której user tworzył (table/kanban), nie na overview.
      try {
        sessionStorage.setItem("taskModalReturnTo", JSON.stringify({ taskId: res.taskId, path: pathname }));
      } catch {
        // sessionStorage może być wyłączone (private mode safari)
      }
      // scroll: false — body scroll-lock dialogu vs scroll-to-top Next.js (F12-K99).
      router.push(`/w/${wsId}/t/${res.taskId}`, { scroll: false });
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.target !== titleRef.current) return;
    e.preventDefault();
    submit(e.shiftKey);
  };

  const footer = (
    <>
      <span className="text-xs text-fg-3 max-md:hidden">Utwórz i dodaj kolejne <Kbd className="px-1 text-[10px]">⇧Enter</Kbd></span>
      <span className="flex-1" />
      <Button variant="secondary" size={size} onClick={() => handleOpenChange(false)}>Anuluj</Button>
      <Button variant="primary" size={size} loading={pending} disabled={!board || pending} onClick={() => submit(false)}>Utwórz zadanie</Button>
    </>
  );

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange} title="Nowe zadanie" size="md" dataUi="create-task-dialog" footer={footer} onKeyDown={onKeyDown}>
      <div className="flex flex-col gap-3">
        <div>
          <Label htmlFor="ct-title" className="mb-[5px]">Tytuł</Label>
          <Input id="ct-title" ref={titleRef} name="title" size={size} autoFocus maxLength={2000} value={title} onChange={(e) => setTitle(e.target.value)} error={error ?? undefined} />
        </div>
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <Label className="mb-[5px]">Tablica</Label>
            <Select aria-label="Tablica" size={size} placeholder="Wybierz tablicę…" value={board} onValueChange={setPickedBoard} items={boardItems} />
          </div>
          <div className="min-w-0 flex-1">
            <Label className="mb-[5px]">Status</Label>
            <Select aria-label="Status" size={size} placeholder="Status" value={status} onValueChange={setStatusId}
              items={(meta?.statuses ?? []).map((s) => ({ value: s.id, label: <StatusChip label={s.name} hue={hueForColor(s.colorHex)} /> }))} />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <Label className="mb-[5px]">Priorytet</Label>
            <Select aria-label="Priorytet" size={size} value={priority} onValueChange={setPriority} items={PRIORITY_ITEMS} />
          </div>
          <div className={cn("min-w-0 flex-1", isMobile && "[&>button]:h-11")}>
            <Label className="mb-[5px]">Termin</Label>
            <DateTimePicker name="stopAt" label="Termin" placeholder="Wybierz datę" defaultValue={null} onChange={setStopAt} />
          </div>
        </div>
        <div>
          <Label className="mb-[5px]">Przypisani</Label>
          <PersonPicker people={people} value={assignees} onValueChange={setAssignees} className={cn("w-full justify-start gap-1.5 px-2", isMobile && "h-11")}>
            {assignees.map((id) => {
              const p = people.find((x) => x.id === id);
              if (!p) return null;
              const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
              return (
                <span key={id} className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-sm bg-n-100 pr-1 pl-0.5 text-xs">
                  <Avatar name={p.name} src={p.avatar} size={20} className="!size-[18px] !text-[9px]" />
                  {p.name}
                  <span role="button" tabIndex={-1} aria-label={`Usuń ${p.name}`} onPointerDown={stop} onClick={(e) => { stop(e); setAssignees(assignees.filter((x) => x !== id)); }}
                    className="inline-flex size-3.5 items-center justify-center rounded-[2px] text-fg-3 hover:text-foreground">
                    <IconClose width={10} height={10} strokeWidth={1.6} />
                  </span>
                </span>
              );
            })}
            <span className="truncate text-fg-3">Dodaj osobę…</span>
          </PersonPicker>
        </div>
        <div>
          <Label className="mb-[5px]">Dodaj do widoku <span className="font-normal text-fg-3">(opcjonalnie)</span></Label>
          <Select aria-label="Dodaj do widoku" size={size} placeholder="Domyślny — Lista" value={view} onValueChange={setView}
            items={[{ value: DEFAULT_VIEW, label: "Domyślny — Lista" }, ...(meta?.views ?? []).map((v) => ({ value: v.id, label: v.name }))]} />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
