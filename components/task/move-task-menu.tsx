"use client";

import { startTransition, useState } from "react";
import { moveTaskToBoardAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { InputGroup } from "@/components/ui/input";
import { IconChevronRight, IconMove, IconSearch } from "@/components/ui/icons";

export interface MoveTargetBoard { id: string; name: string; workspaceName: string }

// „Przenieś" — pick a target board in the workspace; status is matched by column name
// server-side (or cleared). After revalidate the task lands on top of the new board.
export function MoveTaskMenu({ taskId, currentBoardId, availableBoards, iconOnly }: { taskId: string; currentBoardId: string; availableBoards: MoveTargetBoard[]; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const candidates = availableBoards.filter((b) => b.id !== currentBoardId).filter((b) => (q ? b.name.toLowerCase().includes(q) : true)).slice(0, 50);

  const submit = (targetBoardId: string) => {
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("targetBoardId", targetBoardId);
    startTransition(async () => { await moveTaskToBoardAction(fd); setOpen(false); setQuery(""); });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant={iconOnly ? "ghost" : "secondary"} size="sm" iconOnly={iconOnly} aria-label="Przenieś" title="Przenieś zadanie do innej tablicy" />}>
        <IconMove />{!iconOnly && "Przenieś"}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-0">
        <div className="border-b border-border p-2">
          <InputGroup leading={<IconSearch />} size="sm" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj tablicy…" aria-label="Szukaj tablicy" />
        </div>
        {candidates.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-fg-3">{q ? "Brak dopasowań." : "Brak innych tablic w przestrzeni."}</p>
        ) : (
          <ul className="flex max-h-[300px] flex-col overflow-y-auto p-1">
            {candidates.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => submit(b.id)} className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left outline-none hover:bg-n-100">
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-sm font-medium">{b.name}</span>
                    <span className="truncate text-2xs text-fg-3">{b.workspaceName}</span>
                  </span>
                  <IconChevronRight width={12} height={12} className="text-fg-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-border px-3 py-2 text-2xs text-fg-3">Status zostanie dopasowany po nazwie albo wyczyszczony.</p>
      </PopoverContent>
    </Popover>
  );
}
