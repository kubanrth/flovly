"use client";

// F13 „Zadania podrzedne" — w odroznieniu od checklisty (Podzadania) to
// pelnoprawne zadania: wlasny numer, status, panel. Tworzone stad ladują na
// tej samej tablicy z `parentId` i dziedzicza milestone rodzica.

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { createTaskAction, type CreateTaskState } from "@/app/(app)/w/[workspaceId]/t/actions";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { IconPlus } from "@/components/ui/icons";
import { hueForColor } from "@/components/ui/status-hue";
import { cn } from "@/lib/utils";

export interface ChildTaskItem { id: string; displayId: number; title: string; statusName: string | null; statusColor: string | null }

export function ChildTasksSection({ workspaceId, boardId, taskId, childTasks, canCreate, mobile }: {
  workspaceId: string; boardId: string; taskId: string; childTasks: ChildTaskItem[]; canCreate: boolean; mobile?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [state, formAction, pending] = useActionState<CreateTaskState, FormData>(createTaskAction, null);
  // Po utworzeniu pole zostaje otwarte na kolejne — jak w Kanbanie
  // („adjust state during render", bez efektu).
  const [seen, setSeen] = useState(state);
  if (state !== seen) { setSeen(state); if (state?.ok) setTitle(""); }
  const reset = () => { setAdding(false); setTitle(""); };
  if (childTasks.length === 0 && !canCreate) return null;

  return (
    <section className="flex flex-col" data-ui="task-children">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="eyebrow">Zadania podrzędne</span>
        {childTasks.length > 0 && <span className="font-mono text-2xs text-n-600">{childTasks.length}</span>}
      </div>
      <ul className="flex flex-col">
        {childTasks.map((c) => (
          <li key={c.id} className={cn("flex items-center gap-2", mobile ? "min-h-11" : "h-[30px]")}>
            <span className="w-10 shrink-0 font-mono text-xs text-n-600">#{c.displayId}</span>
            <Link href={`/w/${workspaceId}/t/${c.id}`} className={cn("min-w-0 flex-1 truncate rounded-sm text-foreground no-underline outline-none hover:text-orange-800 hover:underline", mobile ? "text-base" : "text-sm")}>
              {c.title}
            </Link>
            {c.statusName && <StatusChip label={c.statusName} hue={hueForColor(c.statusColor ?? "")} dot={false} size="sm" className="shrink-0" />}
          </li>
        ))}
      </ul>
      {canCreate && (adding ? (
        <form action={(fd) => startTransition(() => formAction(fd))} className={cn("flex items-center gap-2", mobile ? "min-h-11" : "h-[30px]")}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="parentId" value={taskId} />
          <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={2000} autoFocus placeholder="Tytuł zadania podrzędnego" size="sm" aria-label="Tytuł zadania podrzędnego"
            onKeyDown={(e) => { if (e.key === "Escape") reset(); }} className="h-7" error={state && !state.ok ? (state.fieldErrors?.title ?? state.error) : undefined} />
          <Button type="submit" size="sm" loading={pending} disabled={!title.trim()}>Utwórz</Button>
          <Button type="button" variant="ghost" size="sm" onClick={reset}>Anuluj</Button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={cn("flex items-center gap-2 rounded-sm text-fg-3 outline-none hover:text-foreground", mobile ? "min-h-11 gap-2.5 text-base" : "h-[30px] text-sm")}>
          <IconPlus width={mobile ? 18 : 14} height={mobile ? 18 : 14} /> Nowe zadanie podrzędne
        </button>
      ))}
    </section>
  );
}
