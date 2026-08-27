"use client";

import { startTransition, useState } from "react";
import { createSubtaskAction, deleteSubtaskAction, toggleSubtaskAction } from "@/app/(app)/w/[workspaceId]/t/subtask-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPlus, IconTrash } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface SubtaskItem { id: string; title: string; completed: boolean }

// B2 Podzadania: eyebrow + mono "2/5" + 4px green progress, 30px rows (44 mobile), inline add.
export function SubtasksSection({ taskId, subtasks, canManage, mobile, barClassName }: { taskId: string; subtasks: SubtaskItem[]; canManage: boolean; mobile?: boolean; barClassName?: string }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const done = subtasks.filter((s) => s.completed).length;
  const pct = subtasks.length === 0 ? 0 : Math.round((done / subtasks.length) * 100);
  const reset = () => { setAdding(false); setTitle(""); };

  return (
    <section className="flex flex-col" data-ui="task-subtasks">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="eyebrow">Podzadania</span>
        {subtasks.length > 0 && (
          <>
            <span className="font-mono text-2xs text-n-600">{done}/{subtasks.length}</span>
            <span role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Postęp podzadań: ${pct}%`} className={cn("h-1 flex-1 overflow-hidden rounded-[2px] bg-n-100", barClassName)}>
              <span className="block h-1 bg-success" style={{ width: `${pct}%` }} />
            </span>
          </>
        )}
      </div>
      <ul className="flex flex-col">
        {subtasks.map((s) => (
          <li key={s.id} className={cn("group flex items-center gap-2", mobile ? "min-h-11 gap-2.5" : "h-[30px]")}>
            <form action={(fd) => startTransition(() => toggleSubtaskAction(fd))} className="m-0 flex">
              <input type="hidden" name="subtaskId" value={s.id} />
              <input type="hidden" name="completed" value={s.completed ? "false" : "true"} />
              <Checkbox checked={s.completed} size={mobile ? "lg" : "sm"} disabled={!canManage} ariaLabel={s.completed ? `Odznacz: ${s.title}` : `Zaznacz: ${s.title}`} onClick={(e) => (e.currentTarget as HTMLElement).closest("form")?.requestSubmit()} />
            </form>
            <span className={cn("min-w-0 flex-1 truncate", mobile ? "text-base" : "text-sm", s.completed && "text-fg-3 line-through")}>{s.title}</span>
            {canManage && (
              <form action={(fd) => startTransition(() => deleteSubtaskAction(fd))} className="m-0">
                <input type="hidden" name="subtaskId" value={s.id} />
                <Button type="submit" variant="ghost" size="sm" iconOnly aria-label={`Usuń podzadanie: ${s.title}`} className={cn("size-6 opacity-0 hover:text-danger-text focus-visible:opacity-100 group-hover:opacity-100", mobile && "opacity-100")}><IconTrash /></Button>
              </form>
            )}
          </li>
        ))}
        {!canManage && subtasks.length === 0 && <li className="text-sm text-fg-3">Brak podzadań.</li>}
      </ul>
      {canManage && (adding ? (
        <form
          action={(fd) => startTransition(async () => { await createSubtaskAction(fd); reset(); })}
          className={cn("flex items-center gap-2", mobile ? "min-h-11" : "h-[30px]")}
        >
          <input type="hidden" name="taskId" value={taskId} />
          <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} autoFocus placeholder="Co trzeba zrobić?" size="sm" aria-label="Tytuł podzadania"
            onKeyDown={(e) => { if (e.key === "Escape") reset(); }} className="h-7" />
          <Button type="submit" size="sm" disabled={!title.trim()}>Dodaj</Button>
          <Button variant="ghost" size="sm" onClick={reset}>Anuluj</Button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={cn("flex items-center gap-2 rounded-sm text-fg-3 outline-none hover:text-foreground", mobile ? "min-h-11 gap-2.5 text-base" : "h-[30px] text-sm")}>
          <IconPlus width={mobile ? 18 : 14} height={mobile ? 18 : 14} /> Dodaj podzadanie
        </button>
      ))}
    </section>
  );
}
