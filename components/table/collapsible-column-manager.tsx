"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import { StatusColumnManager } from "@/components/table/status-column-manager";

// Collapsed wrapper around StatusColumnManager so the Kanban page can
// expose column management without dominating the viewport. On Table
// the manager sits below the grid; on Kanban we put it above so admins
// don't scroll past the drag area to reach it.
export function CollapsibleColumnManager(props: {
  workspaceId: string;
  boardId: string;
  columns: { id: string; name: string; colorHex: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/60 px-4 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Settings2 size={12} /> Zarządzaj kolumnami
        <span className="ml-1 text-muted-foreground/70">({props.columns.length})</span>
      </button>
      {open && (
        <div className="pt-1">
          <StatusColumnManager
            workspaceId={props.workspaceId}
            boardId={props.boardId}
            columns={props.columns}
          />
        </div>
      )}
    </div>
  );
}
