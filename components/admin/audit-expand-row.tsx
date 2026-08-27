"use client";

// Audit-row expand button + diff drawer (client only because it needs local
// `open` state — the rest of /admin/audit stays a Server Component for fast
// first paint w/ no JS).
//
// Spec ref: `Flovly Admin Sub-views & Extras.dc.html` — chevron caret on right;
// click opens a row showing red (old) / green (new) JSON for `payload`.

import { useState } from "react";
import { IconChevronDown } from "@/components/ui/icons";

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
        className="grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200 disabled:cursor-default disabled:text-n-300 data-[open=true]:bg-n-100 data-[open=true]:text-foreground"
      >
        <IconChevronDown
          width={13}
          height={13}
          className="transition-transform duration-150 ease-[var(--ease-out)] data-[open=true]:rotate-180"
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
      className="popover-surface absolute right-2 top-full z-20 mt-1 w-[min(520px,calc(100vw-2rem))] p-3 text-left shadow-e2"
      role="region"
      aria-label="Diff JSON"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="eyebrow">Diff</span>
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
      className="rounded-md border border-border p-2 data-[tone=new]:bg-chip-green-bg data-[tone=old]:bg-chip-red-bg"
    >
      <div
        data-tone={tone}
        className="eyebrow mb-1 data-[tone=new]:text-success-text data-[tone=old]:text-danger-text"
      >
        {label}
      </div>
      <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-all font-mono text-2xs leading-[1.5] text-foreground">
        {data ? JSON.stringify(data, null, 2) : "—"}
      </pre>
    </div>
  );
}
