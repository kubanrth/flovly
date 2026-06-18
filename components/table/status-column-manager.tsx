"use client";

import { useState } from "react";
import { Plus, Pencil, X, Check } from "lucide-react";
import {
  createStatusColumnAction,
  deleteStatusColumnAction,
  updateStatusColumnAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";

interface Column {
  id: string;
  name: string;
  colorHex: string;
}

// Exported jako single source of truth dla wszystkich
// status-color picker'ów (tabela, kanban, status-picker w komórkach).
// Paleta przeniesiona do `lib/colors.ts` (BRAND_PALETTE) —
// re-eksport pod tą samą nazwą żeby istniejące importy (kanban-board)
// działały bez zmian.
import { STATUS_PALETTE } from "@/lib/colors";
export const PRESET_COLORS = STATUS_PALETTE;

export function StatusColumnManager({
  workspaceId,
  boardId,
  columns,
}: {
  workspaceId: string;
  boardId: string;
  columns: Column[];
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(46,19,52,0.08)]">
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow">Ustawienia tablicy</span>
        <h3 className="font-display text-[1.1rem] font-bold leading-[1.2] tracking-[-0.02em]">
          Statusy
        </h3>
        <p className="text-[0.88rem] leading-[1.55] text-muted-foreground">
          Dostosuj do swojego procesu. Nazwy i kolory pojawią się wszędzie w
          projekcie — w tabeli, na Kanbanie (F3), w karcie zadania.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {columns.map((c) => (
          <ColumnRow
            key={c.id}
            workspaceId={workspaceId}
            column={c}
            canDelete={columns.length > 1}
          />
        ))}
      </ul>

      <AddColumn workspaceId={workspaceId} boardId={boardId} />
    </section>
  );
}

function ColumnRow({
  workspaceId,
  column,
  canDelete,
}: {
  workspaceId: string;
  column: Column;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [color, setColor] = useState(column.colorHex);

  if (editing) {
    return (
      <li>
        <form
          action={updateStatusColumnAction}
          onSubmit={() => setEditing(false)}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2"
        >
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="columnId" value={column.id} />
          <input type="hidden" name="colorHex" value={color} />
          <input
            name="name"
            type="text"
            required
            maxLength={40}
            defaultValue={column.name}
            autoFocus
            className="flex-1 min-w-[160px] rounded-md bg-transparent px-2 py-1 font-mono text-[0.78rem] uppercase tracking-[0.1em] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
          <ColorSwatches selected={color} onChange={setColor} />
          <button
            type="submit"
            className="grid h-8 w-8 place-items-center rounded-md bg-brand-gradient text-white transition-opacity hover:opacity-90"
            aria-label="Zapisz"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Anuluj"
          >
            <X size={14} />
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <span
        className="inline-flex h-6 items-center rounded-full px-2 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em]"
        style={{ color: column.colorHex, background: `${column.colorHex}22` }}
      >
        {column.name}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Edytuj"
        >
          <Pencil size={13} />
        </button>
        {canDelete && (
          <form action={deleteStatusColumnAction}>
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="columnId" value={column.id} />
            <button
              type="submit"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Usuń"
            >
              <X size={13} />
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

function AddColumn({ workspaceId, boardId }: { workspaceId: string; boardId: string }) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(PRESET_COLORS[0]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-dashed border-border px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
      >
        <Plus size={13} /> Dodaj status
      </button>
    );
  }

  return (
    <form
      action={createStatusColumnAction}
      onSubmit={() => {
        setOpen(false);
        setColor(PRESET_COLORS[0]);
      }}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="colorHex" value={color} />
      <input
        name="name"
        type="text"
        required
        maxLength={40}
        placeholder="np. Wstrzymane"
        autoFocus
        className="flex-1 min-w-[160px] rounded-md bg-transparent px-2 py-1 font-mono text-[0.78rem] uppercase tracking-[0.1em] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      />
      <ColorSwatches selected={color} onChange={setColor} />
      <button
        type="submit"
        className="grid h-8 w-8 place-items-center rounded-md bg-brand-gradient text-white transition-opacity hover:opacity-90"
        aria-label="Utwórz"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Anuluj"
      >
        <X size={14} />
      </button>
    </form>
  );
}

function ColorSwatches({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          style={{
            background: c,
            outline: selected === c ? "2px solid var(--foreground)" : "none",
            outlineOffset: selected === c ? 2 : 0,
          }}
          aria-label={`kolor ${c}`}
        />
      ))}
    </div>
  );
}
