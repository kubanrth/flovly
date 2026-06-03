"use client";

import { startTransition, useState } from "react";
import { CheckSquare, Square, Trash2, Plus } from "lucide-react";
import {
  createSubtaskAction,
  deleteSubtaskAction,
  toggleSubtaskAction,
} from "@/app/(app)/w/[workspaceId]/t/subtask-actions";
import { subtaskPl } from "@/lib/pluralize";

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export function SubtasksSection({
  taskId,
  subtasks,
  canManage,
}: {
  taskId: string;
  subtasks: SubtaskItem[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const doneCount = subtasks.filter((s) => s.completed).length;
  // Progress bar aiming for 100%. 0 subtasks = 0% (hidden).
  const pct = subtasks.length === 0 ? 0 : Math.round((doneCount / subtasks.length) * 100);
  const complete = subtasks.length > 0 && doneCount === subtasks.length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <span className="eyebrow">Podzadania</span>
          {subtasks.length > 0 && (
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
              {doneCount} z {subtasks.length} · {subtasks.length}{" "}
              {subtaskPl(subtasks.length)}
            </span>
          )}
        </div>
      </div>

      {subtasks.length > 0 && (
        <div className="flex items-center gap-3">
          <div
            className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Postęp podzadań: ${pct}%`}
          >
            <div
              className="h-full rounded-full bg-brand-gradient transition-[width] duration-500 data-[complete=true]:bg-gradient-to-r data-[complete=true]:from-emerald-400 data-[complete=true]:to-emerald-500"
              data-complete={complete ? "true" : "false"}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            data-complete={complete ? "true" : "false"}
            className="shrink-0 font-mono text-[0.66rem] font-semibold tracking-[0.12em] text-muted-foreground data-[complete=true]:text-emerald-500"
          >
            {pct}%
          </span>
        </div>
      )}

      {subtasks.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl border border-border bg-card p-1">
          {subtasks.map((s) => (
            <li
              key={s.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60"
            >
              <form
                action={(fd) => startTransition(() => toggleSubtaskAction(fd))}
                className="m-0 flex shrink-0"
              >
                <input type="hidden" name="subtaskId" value={s.id} />
                <input
                  type="hidden"
                  name="completed"
                  value={s.completed ? "false" : "true"}
                />
                <button
                  type="submit"
                  aria-label={s.completed ? "Odznacz" : "Zaznacz"}
                  disabled={!canManage}
                  className="grid h-5 w-5 place-items-center text-muted-foreground transition-colors hover:text-primary disabled:cursor-not-allowed"
                >
                  {s.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
              </form>
              <span
                className={`flex-1 truncate text-[0.92rem] transition-colors ${
                  s.completed ? "text-muted-foreground line-through" : ""
                }`}
              >
                {s.title}
              </span>
              {canManage && (
                <form
                  action={(fd) => startTransition(() => deleteSubtaskAction(fd))}
                  className="m-0"
                >
                  <input type="hidden" name="subtaskId" value={s.id} />
                  <button
                    type="submit"
                    aria-label="Usuń"
                    className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && canManage && (
        <form
          action={(fd) =>
            startTransition(async () => {
              await createSubtaskAction(fd);
              setAdding(false);
              setTitle("");
            })
          }
          className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-1.5"
        >
          <input type="hidden" name="taskId" value={taskId} />
          <input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            autoFocus
            placeholder="Co trzeba zrobić?"
            className="flex-1 bg-transparent px-2 py-1 text-[0.9rem] outline-none placeholder:text-muted-foreground/60"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAdding(false);
                setTitle("");
              }
            }}
          />
          <button
            type="submit"
            disabled={!title.trim()}
            className="inline-flex h-8 items-center rounded-md bg-brand-gradient px-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white shadow-brand transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Dodaj
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setTitle("");
            }}
            className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
          >
            Anuluj
          </button>
        </form>
      )}

      {/* Big "Dodaj podzadanie" CTA — replaces the old tiny header pill so the
          action is impossible to miss. Hidden while the composer is open. */}
      {canManage && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/40 font-sans text-[0.92rem] font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-foreground"
        >
          <Plus size={16} /> Dodaj podzadanie
        </button>
      )}

      {subtasks.length === 0 && !adding && !canManage && (
        <p className="text-[0.86rem] text-muted-foreground/80">
          Brak podzadań.
        </p>
      )}
    </section>
  );
}
