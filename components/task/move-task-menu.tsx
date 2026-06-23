"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
//
// Popover portalled do document.body żeby nie był ucięty przez `overflow-y-auto`
// na TaskModalShellu; z-[100] żeby był nad task drawer overlay (z-80) i nad
// mobile hamburger menu.
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
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Position popover beneath trigger via fixed coords (right-aligned to match
  // poprzedni `right-0` look).
  useEffect(() => {
    if (!open) return;
    const recompute = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      if (r.bottom < 0 || r.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      const POP_WIDTH = 300;
      const left = Math.min(
        Math.max(8, r.right - POP_WIDTH),
        window.innerWidth - POP_WIDTH - 8,
      );
      setCoords({
        top: r.bottom + 8,
        left,
      });
    };
    recompute();
    const onScroll = () => recompute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
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
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Przenieś zadanie do innej tablicy"
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 font-sans text-[0.78rem] font-semibold text-violet-700 transition-colors hover:border-violet-500/50 hover:bg-violet-500/15 active:scale-[0.97] motion-reduce:active:scale-100 dark:border-violet-400/40 dark:bg-violet-400/10 dark:text-violet-300"
      >
        <FolderTree size={12} /> Przenieś
      </button>
      {open && coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: 300,
            }}
            className="z-[100] overflow-hidden rounded-lg border border-border bg-popover shadow-[0_16px_40px_-16px_rgba(10,10,40,0.35)]"
          >
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
          </div>,
          document.body,
        )}
    </>
  );
}
