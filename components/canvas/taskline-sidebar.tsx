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
    // v4 TASKLINE spec line 220-225: sidebar 320px po lewej, rounded-[22px]
    // glass — search input + filtr pills + lista draggable task cards.
    // Mobile (spec lines 110-126): sidebar staje się top section z horizontal
    // scroll chip strip — canvas dostaje resztę viewportu.
    <aside className="glass-surface flex w-full shrink-0 flex-col gap-3 overflow-hidden rounded-[22px] shadow-[0_30px_70px_-30px_rgba(122,51,236,0.4)] md:w-[320px] max-md:max-h-[42dvh]">
      {/* Header eyebrow — "Pula zadań" jak w v4 spec */}
      <div className="border-b border-[color-mix(in_oklch,var(--foreground)_8%,transparent)] px-4 pb-3 pt-4">
        <div className="mb-2.5 text-[0.88rem] font-semibold text-foreground">
          Pula zadań
        </div>
        {/* Search input — v4 spec line 221: rounded-[10px] z subtle bg */}
        <div className="flex items-center gap-2 rounded-[10px] border border-[color-mix(in_oklch,var(--foreground)_8%,transparent)] bg-[color-mix(in_oklch,var(--card)_60%,transparent)] px-2.5 py-2">
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
      </div>

      {/* Assignee filter pills */}
      <div className="flex flex-col gap-1.5 px-4">
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
      <div className="px-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/80">
        {filteredTasks.length} z {tasks.length}{" "}
        {tasks.length === 1 ? "zadania" : "zadań"}
      </div>

      {/* Task cards list — przeciągalna.
          Desktop: pionowa kolumna scroll-y. Mobile: horizontal scroll chip strip
          (każda karta = chip 220px wide, max-md:flex-row + overflow-x-auto). */}
      <ul className="flex-1 overflow-y-auto px-3 pb-3 [scrollbar-width:thin] max-md:flex max-md:flex-row max-md:gap-2 max-md:overflow-x-auto max-md:overflow-y-hidden max-md:pb-2 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden">
        {filteredTasks.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[0.82rem] text-muted-foreground max-md:min-w-[220px]">
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
      // v4 spec line 223: rounded-[12px] glass-ish card z border 1px, hover
      // ring-primary/40. displayId font-mono brand-light, title 13px, status
      // pill po prawej.
      // Mobile: chip-style — szerokość 220px (snap point dla horizontal scroll),
      // bez mb-1.5 (gap od <ul> max-md:gap-2 wystarczy).
      className="group mb-1.5 flex cursor-grab flex-col gap-1.5 rounded-[12px] border border-[color-mix(in_oklch,var(--foreground)_8%,transparent)] bg-[color-mix(in_oklch,var(--card)_70%,transparent)] p-3 transition-[transform,border-color,box-shadow] hover:-translate-y-px hover:border-primary/40 hover:shadow-[0_8px_18px_-10px_rgba(124,92,255,0.35)] active:cursor-grabbing max-md:mb-0 max-md:min-w-[220px] max-md:max-w-[220px] max-md:shrink-0"
    >
      <div className="flex items-center gap-2">
        {task.statusColor && (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: task.statusColor }}
          />
        )}
        <span className="font-mono text-[0.66rem] font-semibold tracking-[0.08em] text-[color:var(--brand-500)]">
          #{task.displayId}
        </span>
        {task.statusName && (
          <span
            className="ml-auto inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[0.56rem] uppercase tracking-[0.1em]"
            style={{
              color: task.statusColor ?? "#94A3B8",
              background: `${task.statusColor ?? "#94A3B8"}1A`,
            }}
          >
            {task.statusName}
          </span>
        )}
      </div>
      <div className="line-clamp-2 text-[0.82rem] font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
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
