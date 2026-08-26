"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import { linkTasksAction, unlinkTasksAction } from "@/app/(app)/w/[workspaceId]/t/task-link-actions";
import type { LinkCandidate, LinkedTaskItem } from "@/components/task/task-detail";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { InputGroup } from "@/components/ui/input";
import { IconClose, IconPlus, IconSearch } from "@/components/ui/icons";

// B2 Powiązane zadania: 32px rows (#ID mono · title · assignee), „Powiąż" picker.
export function LinkedTasksSection({ workspaceId, taskId, linkedTasks, candidates, canEdit }: {
  workspaceId: string; taskId: string; linkedTasks: LinkedTaskItem[]; candidates: LinkCandidate[]; canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const linkedIds = new Set(linkedTasks.map((l) => l.task.id));
  const q = query.trim().toLowerCase();
  const pool = candidates.filter((c) => !linkedIds.has(c.id) && c.id !== taskId);
  const filtered = (q ? pool.filter((c) => c.title.toLowerCase().includes(q) || `#${c.displayId}`.includes(q)) : pool).slice(0, 50);

  const link = (targetTaskId: string) => {
    const fd = new FormData();
    fd.set("sourceTaskId", taskId);
    fd.set("targetTaskId", targetTaskId);
    startTransition(async () => { await linkTasksAction(fd); setOpen(false); setQuery(""); });
  };

  return (
    <section className="flex flex-col gap-2" data-ui="task-links">
      <div className="flex items-center gap-2">
        <span className="eyebrow">Powiązane zadania{linkedTasks.length > 0 ? ` · ${linkedTasks.length}` : ""}</span>
        {canEdit && !open && <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="ml-auto -my-1 h-6 px-1.5 text-xs text-n-600"><IconPlus /> Powiąż</Button>}
      </div>
      {linkedTasks.length === 0 && !open && <p className="text-sm text-n-500">Brak powiązanych zadań.</p>}
      {linkedTasks.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {linkedTasks.map((l) => {
            const a = l.task.primaryAssignee;
            return (
              <li key={l.linkId} className="group flex h-8 items-center gap-2 rounded-sm border border-n-100 px-2">
                <span className="font-mono text-2xs text-n-600">#{l.task.displayId}</span>
                <Link href={`/w/${workspaceId}/t/${l.task.id}`} className="min-w-0 flex-1 truncate text-xs text-foreground no-underline hover:text-link hover:underline">{l.task.title}</Link>
                {a && <Avatar name={a.name ?? a.email} src={a.avatarUrl} size={20} />}
                {canEdit && (
                  <form action={(fd) => startTransition(() => unlinkTasksAction(fd))} className="m-0">
                    <input type="hidden" name="linkId" value={l.linkId} />
                    <Button type="submit" variant="ghost" size="sm" iconOnly aria-label={`Odłącz #${l.task.displayId}`} className="size-6 opacity-0 hover:text-danger-text focus-visible:opacity-100 group-hover:opacity-100"><IconClose /></Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {open && canEdit && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
          <div className="flex items-center gap-2">
            <InputGroup leading={<IconSearch />} size="sm" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj po tytule albo #ID…" aria-label="Szukaj zadania do powiązania" />
            <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setQuery(""); }}>Anuluj</Button>
          </div>
          {filtered.length === 0 ? (
            <p className="px-1 py-2 text-xs text-n-500">{q ? "Brak dopasowań." : "Brak dostępnych zadań do powiązania."}</p>
          ) : (
            <ul className="flex max-h-[240px] flex-col overflow-y-auto">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => link(c.id)} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-n-100">
                    <span className="font-mono text-2xs text-n-600">#{c.displayId}</span>
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
