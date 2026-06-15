"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronRight, FolderTree, Search } from "lucide-react";
import { moveTaskToBoardAction } from "@/app/(app)/w/[workspaceId]/t/actions";

export interface MoveTargetBoard {
  id: string;
  name: string;
  workspaceName: string;
}

// Małe menu w nagłówku karty zadania — pokazuje listę docelowych tablic w tym
// samym workspace (excluding current board). Klik na tablicę odpala server
// action; po revalidate task ląduje na górze nowej listy. Status map'ujemy
// po nazwie kolumny w action — UI nie pyta usera bo to dodatkowy klik dla
// rzadkiego edge case'a (brak matcha = status = null, user może zmienić).
export function MoveTaskMenu({
  taskId,
  currentBoardId,
  availableBoards,
}: {
  taskId: string;
  currentBoardId: string;
  availableBoards: MoveTargetBoard[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const candidates = availableBoards
    .filter((b) => b.id !== currentBoardId)
    .filter((b) => (q ? b.name.toLowerCase().includes(q) : true))
    .slice(0, 50);

  const submit = (targetBoardId: string) => {
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("targetBoardId", targetBoardId);
    startTransition(() => {
      void moveTaskToBoardAction(fd).then(() => {
        setOpen(false);
        setQuery("");
      });
    });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Przenieś zadanie do innej tablicy"
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 font-sans text-[0.78rem] font-semibold text-violet-700 transition-colors hover:border-violet-500/50 hover:bg-violet-500/15 active:scale-[0.97] motion-reduce:active:scale-100 dark:border-violet-400/40 dark:bg-violet-400/10 dark:text-violet-300"
      >
        <FolderTree size={12} /> Przenieś
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[300px] overflow-hidden rounded-lg border border-border bg-popover shadow-[0_16px_40px_-16px_rgba(10,10,40,0.35)]">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search size={11} className="text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="szukaj tablicy…"
              className="h-7 flex-1 bg-transparent text-[0.86rem] outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          {candidates.length === 0 ? (
            <p className="px-3 py-4 text-center text-[0.82rem] text-muted-foreground">
              {q ? "Brak dopasowań." : "Brak innych tablic w workspace."}
            </p>
          ) : (
            <ul className="flex max-h-[300px] flex-col overflow-y-auto py-1">
              {candidates.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => submit(b.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/60"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[0.88rem] font-medium">
                        {b.name}
                      </span>
                      <span className="truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
                        {b.workspaceName}
                      </span>
                    </div>
                    <ChevronRight size={12} className="shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-border px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/70">
            <ArrowRight size={9} className="inline -mt-0.5 mr-1" />
            Status zostanie dopasowany po nazwie albo wyczyszczony.
          </p>
        </div>
      )}
    </div>
  );
}
