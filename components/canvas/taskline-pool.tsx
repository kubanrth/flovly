"use client";

// Pula zadań Linii zadań: panel z prawej (⋯ → „Pula zadań…"). Makieta B10 nie
// pokazuje stałego sidebara, ale zadania muszą jakoś trafiać na etapy — karty
// są przeciągalne (HTML5 dnd, własny MIME), tak jak wcześniej.

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { IconClose, IconSearch } from "@/components/ui/icons";
import { hueForColor } from "@/components/ui/status-hue";
import type { TaskLineMember, TaskLineTask } from "@/components/canvas/taskline-stages";

const TASK_MIME = "application/x-flovly-task-id";

export function TaskLinePool({
  tasks,
  members,
  onClose,
}: {
  tasks: TaskLineTask[];
  members: TaskLineMember[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !`#${t.displayId} ${t.title}`.toLowerCase().includes(q)) return false;
      if (selected.size > 0 && !t.assignees.some((a) => selected.has(a.id))) return false;
      return true;
    });
  }, [tasks, query, selected]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <aside
      data-ui="taskline-pool"
      aria-label="Pula zadań"
      className="absolute inset-y-0 right-0 z-[var(--z-panel)] flex w-[320px] flex-col border-l border-border bg-card shadow-e2 max-md:w-full"
    >
      <div className="flex h-13 flex-none items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="flex-1 text-sm font-semibold">Pula zadań</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij pulę zadań"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors duration-150 ease-out hover:bg-n-100 hover:text-foreground focus-visible:shadow-[var(--focus)] focus-visible:outline-none active:bg-n-200"
        >
          <IconClose width={14} height={14} />
        </button>
      </div>

      <div className="flex flex-none flex-col gap-2 border-b border-border px-4 py-3">
        <span className="flex h-8 items-center gap-2 rounded-sm border border-input-border px-2.5 focus-within:border-orange-500">
          <IconSearch width={14} height={14} className="shrink-0 text-fg-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj zadań…"
            aria-label="Szukaj zadań"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-3"
          />
        </span>
        {members.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {members.map((m) => {
              const active = selected.has(m.id);
              const name = m.name ?? m.email.split("@")[0];
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  aria-pressed={active}
                  title={m.email}
                  className={`inline-flex h-6 items-center gap-1.5 rounded-sm border px-1.5 text-2xs font-medium transition-colors duration-150 ease-out focus-visible:shadow-[var(--focus)] focus-visible:outline-none ${
                    active
                      ? "border-orange-500 bg-orange-50 text-orange-800"
                      : "border-border bg-card text-n-700 hover:bg-n-50 active:bg-n-100"
                  }`}
                >
                  <Avatar name={name} src={m.avatarUrl} size={20} />
                  <span className="max-w-[80px] truncate">{name}</span>
                </button>
              );
            })}
          </div>
        )}
        <p className="font-mono text-2xs text-fg-3">
          {filtered.length} z {tasks.length}
        </p>
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <li className="rounded-lg border border-dashed border-input-border px-3 py-6 text-center text-xs text-fg-3">
            {tasks.length === 0 ? "Wszystkie zadania są już na etapach." : "Brak dopasowań."}
          </li>
        ) : (
          filtered.map((t) => (
            <li
              key={t.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(TASK_MIME, t.id);
                // "move", not "copy": the stage column answers with
                // dropEffect "move", and a copy/move mismatch makes Chrome
                // cancel the drop — the task never left the pool.
                e.dataTransfer.effectAllowed = "move";
              }}
              className="cursor-grab rounded-lg border border-border bg-card px-3 py-2.5 transition-colors duration-150 ease-out hover:bg-row-hover active:cursor-grabbing"
            >
              <p className="mb-1.5 line-clamp-2 text-sm font-medium leading-[18px]">{t.title}</p>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-2xs text-fg-3">#{t.displayId}</span>
                {t.statusName && (
                  <Chip hue={hueForColor(t.statusColor)} size="sm">
                    {t.statusName}
                  </Chip>
                )}
                {t.assignees[0] && (
                  <Avatar
                    name={t.assignees[0].name ?? t.assignees[0].email}
                    src={t.assignees[0].avatarUrl}
                    size={20}
                    className="ml-auto"
                  />
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
