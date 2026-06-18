"use client";

// Audit-row expand button + diff drawer (client only because it needs local
// `open` state — the rest of /admin/audit stays a Server Component for fast
// first paint w/ no JS).
//
// Spec ref: `Flovly Admin Sub-views & Extras.dc.html` — chevron caret on right;
// click opens a row showing red (old) / green (new) JSON for `payload`.

import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface AuditDiff {
  old?: Record<string, unknown> | null;
  new?: Record<string, unknown> | null;
  // Some legacy entries store the diff as a flat object — render it as-is.
  flat?: Record<string, unknown> | null;
}

export function AuditExpandRow({
  hasDiff,
  diff,
  colSpan,
}: {
  hasDiff: boolean;
  diff: AuditDiff;
  colSpan: number;
}) {
  const [open, setOpen] = useState(false);

  // Render the toggle inline + a portaled <tr> for the diff body. We can't
  // portal across a <tbody>, so the consumer renders this twice: once for
  // the caret cell, once for the expanded row. We do that by returning a
  // fragment + the consumer puts the expanded row right after the data row.
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Zwiń" : "Rozwiń"}
        disabled={!hasDiff}
        onClick={() => setOpen((v) => !v)}
        data-open={open ? "true" : "false"}
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-default disabled:opacity-30 data-[open=true]:bg-accent data-[open=true]:text-foreground"
      >
        <ChevronDown
          size={13}
          className="transition-transform duration-150 ease-out data-[open=true]:rotate-180"
          data-open={open ? "true" : "false"}
        />
      </button>
      {open && hasDiff && (
        <DiffPortalSlot diff={diff} colSpan={colSpan} />
      )}
    </>
  );
}

// Renders the expanded diff inline as a sibling element. The consumer wraps
// the data row's last cell with this component; CSS positions the portal
// (a sibling div absolutely positioned doesn't work in <table>, so we use a
// `display: table-row` element with explicit cell).
function DiffPortalSlot({
  diff,
  colSpan,
}: {
  diff: AuditDiff;
  colSpan: number;
}) {
  // Note: this is rendered inside a <td>, which is itself inside a <tr>.
  // A nested <table> would be heavyweight + accessible-noisy; instead we use
  // a small absolutely-positioned panel anchored to the caret. Hidden in print.
  // We sidestep the <table> nesting by rendering the panel inline with
  // contents-display: position absolute under the row's last cell.
  return (
    <div
      className="absolute right-2 top-full z-20 mt-1 w-[min(520px,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 text-left shadow-[0_18px_40px_-16px_rgba(10,10,40,0.5)]"
      role="region"
      aria-label="Diff JSON"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
          Diff
        </span>
      </div>
      <DiffBody diff={diff} />
      <span className="sr-only">cols={colSpan}</span>
    </div>
  );
}

function DiffBody({ diff }: { diff: AuditDiff }) {
  // Two presentations:
  //  1. old/new pair → side-by-side panes (red/green) so reviewers spot the
  //     state change without diff'ing in their head.
  //  2. flat payload → just a single green pane (no "before" state recorded).
  if (diff.old || diff.new) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <DiffPane tone="old" label="poprzednio" data={diff.old ?? null} />
        <DiffPane tone="new" label="po zmianie" data={diff.new ?? null} />
      </div>
    );
  }
  return <DiffPane tone="new" label="payload" data={diff.flat ?? null} />;
}

function DiffPane({
  tone,
  label,
  data,
}: {
  tone: "old" | "new";
  label: string;
  data: Record<string, unknown> | null;
}) {
  return (
    <div
      data-tone={tone}
      className="rounded-lg border border-border bg-background/40 p-2 data-[tone=new]:border-emerald-500/30 data-[tone=new]:bg-emerald-500/[0.06] data-[tone=old]:border-destructive/30 data-[tone=old]:bg-destructive/[0.06]"
    >
      <div
        data-tone={tone}
        className="mb-1 font-mono text-[0.56rem] uppercase tracking-[0.14em] text-muted-foreground data-[tone=new]:text-emerald-500 data-[tone=old]:text-destructive"
      >
        {label}
      </div>
      <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-all font-mono text-[0.72rem] leading-[1.5] text-foreground">
        {data ? JSON.stringify(data, null, 2) : "—"}
      </pre>
    </div>
  );
}
