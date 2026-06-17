"use client";

import { useMemo, useState } from "react";
import { Search, X, Filter } from "lucide-react";
import type {
  TaskLineMember,
  TaskLineTask,
} from "@/components/canvas/taskline-workspace";

// F12-K73 Task Line sidebar: search + assignee multi-filter + lista task-cards.
// Cards są HTML5 draggable z custom MIME 'application/x-flovly-task-id'.
// CanvasEditor drop handler odbiera taskId i tworzy TASK_REF node.
export function TaskLineSidebar({
  workspaceId: _workspaceId,
  tasks,
  members,
}: {
  workspaceId: string;
  tasks: TaskLineTask[];
  members: TaskLineMember[];
}) {
  const [query, setQuery] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<Set<string>>(
    new Set(),
  );

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q) {
        const haystack = `#${t.displayId} ${t.title}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (selectedAssignees.size > 0) {
        if (!t.assignees.some((a) => selectedAssignees.has(a.id))) return false;
      }
      return true;
    });
  }, [tasks, query, selectedAssignees]);

  const toggleAssignee = (id: string) => {
    setSelectedAssignees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card md:w-[320px]">
      {/* Search */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Search size={13} className="shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj zadań…"
          className="flex-1 bg-transparent text-[0.88rem] outline-none placeholder:text-muted-foreground/60"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Wyczyść"
            className="grid h-5 w-5 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Assignee filter pills */}
      <div className="flex flex-col gap-1.5 px-3">
        <div className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
          <Filter size={10} />
          <span>Filtr po opiekunach</span>
          {selectedAssignees.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedAssignees(new Set())}
              className="ml-auto rounded px-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              wyczyść
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {members.map((m) => {
            const active = selectedAssignees.has(m.id);
            const display = m.name ?? m.email.split("@")[0];
            const initials = (m.name ?? m.email).slice(0, 2).toUpperCase();
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleAssignee(m.id)}
                title={`${display} (${m.email})`}
                className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2 transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                <span className="grid h-4 w-4 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient text-[0.5rem] font-bold text-white">
                  {m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </span>
                <span className="max-w-[80px] truncate text-[0.7rem] font-medium">
                  {display}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Counter */}
      <div className="px-3 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/80">
        {filteredTasks.length} z {tasks.length}{" "}
        {tasks.length === 1 ? "zadania" : "zadań"}
      </div>

      {/* Task cards list — przeciągalna */}
      <ul className="flex-1 overflow-y-auto px-3 pb-3">
        {filteredTasks.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[0.82rem] text-muted-foreground">
            {tasks.length === 0
              ? "Brak zadań w tej tablicy."
              : "Brak dopasowań."}
          </li>
        ) : (
          filteredTasks.map((t) => (
            <TaskLineCard key={t.id} task={t} />
          ))
        )}
      </ul>
    </aside>
  );
}

function TaskLineCard({ task }: { task: TaskLineTask }) {
  const primaryAssignee = task.assignees[0];
  return (
    <li
      draggable
      onDragStart={(e) => {
        // Custom MIME type żeby nie kolidować z drag-tekstem na elementach
        // input/textarea — CanvasEditor onDragOver sprawdza dokładnie ten typ.
        e.dataTransfer.setData("application/x-flovly-task-id", task.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className="group mb-1.5 flex cursor-grab flex-col gap-1.5 rounded-md border border-border bg-background p-2.5 transition-all hover:border-primary/40 hover:shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        {task.statusColor && (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: task.statusColor }}
          />
        )}
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">
          #{task.displayId}
        </span>
        {task.statusName && (
          <span
            className="ml-auto inline-flex items-center rounded-full px-1.5 font-mono text-[0.56rem] uppercase tracking-[0.1em]"
            style={{
              color: task.statusColor ?? "#94A3B8",
              background: `${task.statusColor ?? "#94A3B8"}1A`,
            }}
          >
            {task.statusName}
          </span>
        )}
      </div>
      <div className="line-clamp-2 text-[0.82rem] font-medium leading-tight text-foreground transition-colors group-hover:text-primary">
        {task.title}
      </div>
      {primaryAssignee && (
        <div className="flex items-center gap-1.5 text-[0.66rem] text-muted-foreground">
          <span className="grid h-4 w-4 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient text-[0.5rem] font-bold text-white">
            {primaryAssignee.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryAssignee.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              (primaryAssignee.name ?? primaryAssignee.email)
                .slice(0, 2)
                .toUpperCase()
            )}
          </span>
          <span className="truncate">
            {primaryAssignee.name ?? primaryAssignee.email.split("@")[0]}
          </span>
          {task.assignees.length > 1 && (
            <span className="font-mono">+{task.assignees.length - 1}</span>
          )}
        </div>
      )}
    </li>
  );
}
