"use client";

// Mobile filter drawer — wraps TableFiltersToolbar in a bottom Sheet on
// `max-md`. Desktop renders TableFiltersToolbar inline as before. Per Mobile
// v4 (B11 — Filter drawer): rounded-t-24 glass surface, "Filtry" trigger
// pill, "Wyczyść" / "Zastosuj (N)" sticky footer.
//
// We don't replace the inline toolbar — board-table.tsx decides via
// max-md utility classes which surface to render. This component handles
// just the mobile-bound trigger + sheet shell.

import { useState } from "react";
import { Filter } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  TableFiltersToolbar,
  type ToolbarColumnRef,
  type GroupPreset,
} from "@/components/table/table-filters-toolbar";
import type { TableFilter, TableSort } from "@/lib/table-filters";

interface Props {
  workspaceId: string;
  boardId: string;
  columns: ToolbarColumnRef[];
  groupPresets?: GroupPreset[];
  filters: TableFilter[];
  sort: TableSort | null;
  groupBy: string | null;
  canEdit: boolean;
  onChange: (next: {
    filters: TableFilter[];
    sort: TableSort | null;
    groupBy: string | null;
  }) => void;
}

export function MobileFiltersDrawer(props: Props) {
  const [open, setOpen] = useState(false);
  const activeCount =
    props.filters.length + (props.sort ? 1 : 0) + (props.groupBy ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Otwórz filtry"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-[0.84rem] font-medium text-foreground transition-colors hover:bg-accent"
          />
        }
      >
        <Filter size={14} />
        <span>Filtry</span>
        {activeCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gradient px-1.5 font-mono text-[0.62rem] font-bold text-white">
            {activeCount}
          </span>
        )}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-2xl border-t border-white/10 bg-popover/95 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-12px_rgba(10,10,40,0.5)] backdrop-blur-xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-foreground/20" aria-hidden />
        <SheetTitle className="mb-3 font-display text-[1.05rem] font-semibold tracking-[-0.01em]">
          Filtry
        </SheetTitle>

        {/* The toolbar already handles add/remove/clear on its own. We just
            give it breathing room inside the sheet. */}
        <div className="max-h-[55vh] overflow-y-auto pb-2">
          <TableFiltersToolbar
            workspaceId={props.workspaceId}
            boardId={props.boardId}
            columns={props.columns}
            groupPresets={props.groupPresets}
            filters={props.filters}
            sort={props.sort}
            groupBy={props.groupBy}
            canEdit={props.canEdit}
            onChange={props.onChange}
          />
        </div>

        {/* Sticky footer with apply + clear. Apply closes the sheet (filters
            are already persisted in real-time by the toolbar). Clear wipes all. */}
        <div className="-mx-4 mt-3 flex gap-2 border-t border-border px-4 pt-3">
          <button
            type="button"
            onClick={() => {
              props.onChange({ filters: [], sort: null, groupBy: null });
            }}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-border bg-background text-[0.9rem] font-medium text-foreground transition-colors hover:bg-accent"
          >
            Wyczyść
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-12 flex-[1.3] items-center justify-center gap-1.5 rounded-xl bg-brand-gradient text-[0.95rem] font-semibold text-white shadow-brand"
          >
            Zastosuj
            {activeCount > 0 && <span className="font-mono text-[0.78rem] opacity-90">({activeCount})</span>}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
