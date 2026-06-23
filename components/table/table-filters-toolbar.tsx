"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import {
  ArrowDownAZ,
  Filter,
  Group,
  Plus,
  X,
} from "lucide-react";
import { saveTableFiltersAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import {
  OPERATORS_FOR_TYPE,
  OPERATOR_LABEL,
  type FilterOp,
  type TableFilter,
  type TableSort,
} from "@/lib/table-filters";
import type { FieldOptions } from "@/lib/table-fields";

export interface ToolbarColumnRef {
  id: string;
  label: string;
  // Determines which operators we offer + how the value editor renders.
  kind: TableFilter["kind"];
  // Only present for SINGLE_SELECT / MULTI_SELECT — used to power the
  // value picker.
  fieldOptions?: FieldOptions | null;
  // For BUILTIN_STATUS — list of {id,name} pairs.
  statusOptions?: { id: string; label: string; color: string }[];
}

// Empty / undefined GroupPreset = no preset section (backwards compat).
export interface GroupPreset {
  id: string;
  label: string;
}

export function TableFiltersToolbar({
  workspaceId,
  boardId,
  columns,
  groupPresets,
  filters,
  sort,
  groupBy,
  canEdit,
  onChange,
}: {
  workspaceId: string;
  boardId: string;
  columns: ToolbarColumnRef[];
  groupPresets?: GroupPreset[];
  filters: TableFilter[];
  sort: TableSort | null;
  groupBy: string | null;
  canEdit: boolean;
  onChange: (next: { filters: TableFilter[]; sort: TableSort | null; groupBy: string | null }) => void;
}) {
  const persist = (next: {
    filters: TableFilter[];
    sort: TableSort | null;
    groupBy: string | null;
  }) => {
    onChange(next);
    if (!canEdit) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set(
      "payload",
      JSON.stringify({ filters: next.filters, sort: next.sort, groupBy: next.groupBy }),
    );
    startTransition(() => saveTableFiltersAction(fd));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((f, idx) => (
          <FilterChip
            key={`${f.columnId}-${idx}`}
            filter={f}
            columns={columns}
            onChange={(next) => {
              const arr = [...filters];
              arr[idx] = next;
              persist({ filters: arr, sort, groupBy });
            }}
            onRemove={() => {
              const arr = filters.filter((_, i) => i !== idx);
              persist({ filters: arr, sort, groupBy });
            }}
          />
        ))}
        <AddFilterButton
          columns={columns}
          onAdd={(f) => persist({ filters: [...filters, f], sort, groupBy })}
        />
      </div>

      <SortPicker
        columns={columns}
        sort={sort}
        onChange={(next) => persist({ filters, sort: next, groupBy })}
      />
      <GroupPicker
        columns={columns}
        presets={groupPresets}
        groupBy={groupBy}
        onChange={(next) => persist({ filters, sort, groupBy: next })}
      />
    </div>
  );
}

function pickerButtonClass(active: boolean): string {
  return `inline-flex h-8 items-center gap-1.5 rounded-md border px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] transition-colors ${
    active
      ? "border-primary/60 bg-primary/8 text-foreground"
      : "border-border bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground"
  }`;
}

function AddFilterButton({
  columns,
  onAdd,
}: {
  columns: ToolbarColumnRef[];
  onAdd: (f: TableFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onClose={() => setOpen(false)} trigger={
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-border px-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
      >
        <Filter size={11} />
        <Plus size={10} />
        Filtr
      </button>
    }>
      <ul className="max-h-72 w-56 overflow-y-auto p-1">
        {columns.map((c) => {
          const ops = OPERATORS_FOR_TYPE[c.kind];
          const defaultOp = ops[0];
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd({ columnId: c.id, kind: c.kind, op: defaultOp, value: "" });
                  setOpen(false);
                }}
                className="block w-full truncate rounded-md px-2 py-1 text-left text-[0.82rem] transition-colors hover:bg-accent"
              >
                {c.label}
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}

function FilterChip({
  filter,
  columns,
  onChange,
  onRemove,
}: {
  filter: TableFilter;
  columns: ToolbarColumnRef[];
  onChange: (f: TableFilter) => void;
  onRemove: () => void;
}) {
  const col = columns.find((c) => c.id === filter.columnId);
  const ops = OPERATORS_FOR_TYPE[filter.kind] ?? [];
  const needsValue = !["isEmpty", "isNotEmpty", "isToday", "isFuture", "isPast", "isChecked", "isNotChecked"].includes(filter.op);

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-1 text-[0.74rem]">
      <span className="px-1 font-medium text-foreground">{col?.label ?? filter.columnId}</span>
      <select
        value={filter.op}
        onChange={(e) => onChange({ ...filter, op: e.target.value as FilterOp })}
        className="bg-transparent px-1 py-0.5 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-muted-foreground outline-none focus-visible:text-foreground"
      >
        {ops.map((op) => (
          <option key={op} value={op}>
            {OPERATOR_LABEL[op]}
          </option>
        ))}
      </select>
      {needsValue && col && (
        <FilterValueInput
          column={col}
          value={filter.value}
          onChange={(v) => onChange({ ...filter, value: v })}
        />
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Usuń filtr"
        className="ml-1 grid h-5 w-5 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X size={11} />
      </button>
    </div>
  );
}

function FilterValueInput({
  column,
  value,
  onChange,
}: {
  column: ToolbarColumnRef;
  value: string;
  onChange: (v: string) => void;
}) {
  // Defer to specialised editors per kind so the user gets the right
  // affordance (datepicker for dates, dropdown for selects, etc.).
  switch (column.kind) {
    case "NUMBER":
    case "RATING":
    case "AUTO_NUMBER":
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-20 rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[0.78rem] outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      );
    case "DATE":
    case "CREATED_TIME":
    case "LAST_MODIFIED_TIME":
    case "BUILTIN_DATE":
      return (
        <input
          type="date"
          value={value ? value.slice(0, 10) : ""}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[0.78rem] outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      );
    case "SINGLE_SELECT": {
      const opts = column.fieldOptions?.selectOptions ?? [];
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[0.78rem] outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <option value="">— wybierz —</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value}
            </option>
          ))}
        </select>
      );
    }
    case "MULTI_SELECT": {
      const opts = column.fieldOptions?.selectOptions ?? [];
      let selected: string[] = [];
      try {
        const parsed = value ? JSON.parse(value) : [];
        selected = Array.isArray(parsed) ? parsed : [];
      } catch {
        selected = [];
      }
      const toggle = (v: string) => {
        const next = selected.includes(v)
          ? selected.filter((x) => x !== v)
          : [...selected, v];
        onChange(next.length === 0 ? "" : JSON.stringify(next));
      };
      return (
        <div className="flex flex-wrap items-center gap-1">
          {opts.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={`rounded-full px-1.5 py-0.5 text-[0.66rem] font-semibold transition-opacity ${
                selected.includes(o.value) ? "" : "opacity-40"
              }`}
              style={{ color: o.color, background: `${o.color}1F` }}
            >
              {o.value}
            </button>
          ))}
        </div>
      );
    }
    case "BUILTIN_STATUS": {
      const opts = column.statusOptions ?? [];
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[0.78rem] outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <option value="">— wybierz —</option>
          {opts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    default:
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="wartość…"
          className="w-32 rounded-sm border border-border bg-background px-1.5 py-0.5 text-[0.78rem] outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
        />
      );
  }
}

function SortPicker({
  columns,
  sort,
  onChange,
}: {
  columns: ToolbarColumnRef[];
  sort: TableSort | null;
  onChange: (next: TableSort | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = sort ? columns.find((c) => c.id === sort.columnId) : null;
  return (
    <Popover open={open} onClose={() => setOpen(false)} trigger={
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={pickerButtonClass(Boolean(sort))}
      >
        <ArrowDownAZ size={12} />
        {current ? `${current.label} · ${sort!.dir === "asc" ? "rosn." : "mal."}` : "Sortuj"}
      </button>
    }>
      <div className="w-56 p-1">
        <div className="px-2 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground/80">
          Sortuj według kolumny
        </div>
        <ul className="max-h-60 overflow-y-auto">
          <li>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={`flex w-full justify-between rounded-md px-2 py-1 text-left text-[0.82rem] transition-colors hover:bg-accent ${
                sort === null ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span>Brak</span>
              {sort === null && <span className="text-primary">✓</span>}
            </button>
          </li>
          {columns.map((c) => (
            <li key={c.id}>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onChange({ columnId: c.id, kind: c.kind, dir: "asc" });
                    setOpen(false);
                  }}
                  className={`flex flex-1 items-center justify-between rounded-md px-2 py-1 text-left text-[0.82rem] transition-colors hover:bg-accent ${
                    sort?.columnId === c.id && sort?.dir === "asc" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span className="truncate">{c.label}</span>
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/60">
                    rosn.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ columnId: c.id, kind: c.kind, dir: "desc" });
                    setOpen(false);
                  }}
                  aria-label={`Sortuj malejąco: ${c.label}`}
                  className={`grid h-7 w-7 place-items-center rounded-md text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${
                    sort?.columnId === c.id && sort?.dir === "desc" ? "bg-accent text-foreground" : ""
                  }`}
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Popover>
  );
}

function GroupPicker({
  columns,
  presets,
  groupBy,
  onChange,
}: {
  columns: ToolbarColumnRef[];
  // Gotowe presety bucketingu (np. "Data dodania", "Tagi A→Z")
  // pokazane nad listą kolumn jako odzielna sekcja.
  presets?: GroupPreset[];
  groupBy: string | null;
  onChange: (next: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  // Aktywny groupBy może być id presetu (`preset:*`) — najpierw
  // szukamy w presetach, potem w listingu kolumn.
  const current = groupBy
    ? presets?.find((p) => p.id === groupBy) ?? columns.find((c) => c.id === groupBy)
    : null;
  // Only allow grouping on bucket-like fields — grouping by free text
  // would create one bucket per row.
  // Klient zgłosił że grupowanie nie obejmuje wszystkich
  // kolumn — wcześniej był whitelist na bucket-like fields. Teraz każda
  // kolumna jest groupable; długie wartości (TEXT/LONG_TEXT) tworzą
  // dużo bucketów (każda unikalna wartość = osobny), ale to świadoma
  // decyzja użytkownika.
  const groupable = columns;
  const hasPresets = (presets?.length ?? 0) > 0;
  return (
    <Popover open={open} onClose={() => setOpen(false)} trigger={
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={pickerButtonClass(Boolean(groupBy))}
      >
        <Group size={12} />
        {current ? `Grupuj · ${current.label}` : "Grupuj"}
      </button>
    }>
      <div className="w-60 p-1">
        <ul className="max-h-72 overflow-y-auto">
          <li>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={`flex w-full justify-between rounded-md px-2 py-1 text-left text-[0.82rem] transition-colors hover:bg-accent ${
                groupBy === null ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span>Brak</span>
              {groupBy === null && <span className="text-primary">✓</span>}
            </button>
          </li>

          {hasPresets && (
            <>
              <li className="mt-1.5 px-2 pb-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground/80">
                Presety
              </li>
              {presets!.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                    className={`flex w-full justify-between rounded-md px-2 py-1 text-left text-[0.82rem] transition-colors hover:bg-accent ${
                      groupBy === p.id ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span className="truncate">{p.label}</span>
                    {groupBy === p.id && <span className="text-primary">✓</span>}
                  </button>
                </li>
              ))}
              <li className="mx-2 my-1 h-px bg-border/60" aria-hidden />
            </>
          )}

          <li className={`px-2 ${hasPresets ? "" : "mt-1.5"} pb-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground/80`}>
            Według kolumny
          </li>
          {groupable.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                className={`flex w-full justify-between rounded-md px-2 py-1 text-left text-[0.82rem] transition-colors hover:bg-accent ${
                  groupBy === c.id ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <span className="truncate">{c.label}</span>
                {groupBy === c.id && <span className="text-primary">✓</span>}
              </button>
            </li>
          ))}
          {groupable.length === 0 && (
            <li className="px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/60">
              brak kolumn do grupowania
            </li>
          )}
        </ul>
      </div>
    </Popover>
  );
}

// Tiny shared popover wrapper so each picker has identical click-outside
// + escape behaviour without 3× the boilerplate.
function Popover({
  open,
  onClose,
  trigger,
  children,
}: {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        // Z-50 (było z-30) — sticky <thead> ma własny stacking
        // context z z-30, więc filter popover wpadał pod nagłówek tabeli
        // ('obraz nakłada się na checkbox' = tło thead nakładało się na
        // listę filtrów).
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 rounded-xl border border-border bg-popover shadow-[0_12px_32px_-12px_rgba(10,10,40,0.25)]">
          {children}
        </div>
      )}
    </div>
  );
}
