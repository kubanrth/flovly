"use client";

// „Filtry widoku” builder (B1): rows of [column][operator][value][✕], AND
// between rows, „+ Dodaj warunek” / „Wyczyść wszystko”. Pure UI over
// TableFilter[]; persistence lives in list-state.

import type { ChipHue } from "@/components/ui/chip";
import { Combobox } from "@/components/ui/combobox";
import { Input, inputVariants } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconPlus, IconTrash } from "@/components/ui/icons";
import { OPERATORS_FOR_TYPE, type FilterOp, type TableFilter } from "@/lib/table-filters";

export interface FilterColumn {
  id: string;
  label: string;
  // Drives the operator list + value editor.
  kind: TableFilter["kind"];
  // Select-like kinds (status, priority, people, tags, select fields).
  options?: { value: string; label: string; hue?: ChipHue; avatar?: string | null }[];
}

// UI wording (B1 shows „jest”); lib's OPERATOR_LABEL keeps the symbol variants.
export const OP_LABEL: Record<FilterOp, string> = {
  equals: "jest",
  notEquals: "nie jest",
  contains: "zawiera",
  notContains: "nie zawiera",
  isEmpty: "jest puste",
  isNotEmpty: "nie jest puste",
  gt: "większe niż",
  gte: "większe lub równe",
  lt: "mniejsze niż",
  lte: "mniejsze lub równe",
  before: "przed",
  after: "po",
  isToday: "dziś",
  isFuture: "w przyszłości",
  isPast: "w przeszłości",
  isChecked: "zaznaczone",
  isNotChecked: "niezaznaczone",
  hasAny: "zawiera dowolne",
  hasAll: "zawiera wszystkie",
};

const NO_VALUE_OPS = new Set<FilterOp>(["isEmpty", "isNotEmpty", "isToday", "isFuture", "isPast", "isChecked", "isNotChecked"]);
export const needsValue = (op: FilterOp) => !NO_VALUE_OPS.has(op);

// Rows still being typed (value empty) don't filter anything and get no chip.
export function isActiveFilter(f: TableFilter): boolean {
  return !needsValue(f.op) || f.value.trim() !== "";
}

function parseMulti(value: string): string[] {
  try {
    const j = JSON.parse(value);
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function valueLabel(f: TableFilter, col: FilterColumn | undefined): string {
  if (!needsValue(f.op)) return "";
  if (col?.options) {
    const ids = f.op === "hasAny" || f.op === "hasAll" ? parseMulti(f.value) : [f.value];
    return ids.map((id) => col.options!.find((o) => o.value === id)?.label ?? id).join(", ");
  }
  if (f.kind === "DATE" || f.kind === "BUILTIN_DATE" || f.kind === "CREATED_TIME" || f.kind === "LAST_MODIFIED_TIME") {
    const d = new Date(f.value);
    return Number.isNaN(d.getTime()) ? f.value : d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  }
  return f.value;
}

// Chip text: „Status: W toku”, „Tytuł zawiera „ab””, „Koniec przed 1 wrz”, „Start: jest puste”.
export function describeFilter(f: TableFilter, columns: FilterColumn[]): string {
  const col = columns.find((c) => c.id === f.columnId);
  const label = col?.label ?? f.columnId;
  if (!needsValue(f.op)) return `${label}: ${OP_LABEL[f.op]}`;
  const v = valueLabel(f, col);
  if (f.op === "equals" || f.op === "hasAny") return `${label}: ${v}`;
  if (f.op === "contains" || f.op === "notContains") return `${label} ${OP_LABEL[f.op]} „${v}”`;
  return `${label} ${OP_LABEL[f.op]} ${v}`;
}

export function defaultOp(kind: TableFilter["kind"]): FilterOp {
  return OPERATORS_FOR_TYPE[kind][0]!;
}

export function newFilter(col: FilterColumn): TableFilter {
  return { columnId: col.id, kind: col.kind, op: defaultOp(col.kind), value: "" };
}

export function FilterBuilder({
  filters,
  columns,
  onChange,
}: {
  filters: TableFilter[];
  columns: FilterColumn[];
  onChange: (next: TableFilter[]) => void;
}) {
  const update = (i: number, next: TableFilter) => onChange(filters.map((f, j) => (j === i ? next : f)));
  const add = () => columns[0] && onChange([...filters, newFilter(columns[0])]);
  return (
    <div className="w-[460px] max-w-[calc(100vw-32px)]" data-ui="filter-builder">
      <p className="mb-2.5 text-xs font-semibold">Filtry widoku</p>
      {filters.length === 0 && <p className="mb-2 text-xs text-muted-foreground">Brak warunków — wszystkie zadania są widoczne.</p>}
      <div className="flex flex-col gap-2">
        {filters.map((f, i) => {
          const col = columns.find((c) => c.id === f.columnId);
          const ops = OPERATORS_FOR_TYPE[f.kind] ?? [];
          return (
            <div key={i} className="flex items-center gap-2">
              {i > 0 ? (
                <span className="inline-flex h-7 w-11 shrink-0 items-center justify-center rounded-sm border border-border bg-canvas text-2xs font-semibold text-muted-foreground">AND</span>
              ) : (
                <span className="w-11 shrink-0" />
              )}
              {/* ponytail: native selects — base-ui popups nested in a popover
                  land under it; the OS dropdown always wins. */}
              <select
                aria-label="Kolumna"
                className={cn(inputVariants({ size: "sm" }), "w-[130px] shrink-0 text-xs")}
                value={f.columnId}
                onChange={(e) => {
                  const c = columns.find((x) => x.id === e.target.value);
                  if (c) update(i, newFilter(c));
                }}
              >
                {columns.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <select
                aria-label="Operator"
                className={cn(inputVariants({ size: "sm" }), "w-[130px] shrink-0 text-xs")}
                value={f.op}
                onChange={(e) => {
                  const op = e.target.value as FilterOp;
                  update(i, { ...f, op, value: needsValue(op) ? f.value : "" });
                }}
              >
                {ops.map((op) => <option key={op} value={op}>{OP_LABEL[op]}</option>)}
              </select>
              <div className="min-w-0 flex-1">
                {needsValue(f.op) && col && <FilterValue column={col} filter={f} onChange={(value) => update(i, { ...f, value })} />}
              </div>
              <Button variant="ghost" size="sm" iconOnly aria-label="Usuń warunek" onClick={() => onChange(filters.filter((_, j) => j !== i))}>
                <IconTrash />
              </Button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center border-t border-n-100 pt-2.5">
        <Button variant="link" size="sm" onClick={add}>
          <IconPlus width={11} height={11} />
          Dodaj warunek
        </Button>
        <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" disabled={filters.length === 0} onClick={() => onChange([])}>
          Wyczyść wszystko
        </Button>
      </div>
    </div>
  );
}

function FilterValue({ column, filter, onChange }: { column: FilterColumn; filter: TableFilter; onChange: (v: string) => void }) {
  const multi = filter.op === "hasAny" || filter.op === "hasAll";
  if (column.options) {
    if (multi) {
      return (
        <Combobox
          multi
          size="sm"
          placeholder="Wybierz…"
          options={column.options.map((o) => ({ value: o.value, label: o.label, hue: o.hue, avatar: o.avatar }))}
          value={parseMulti(filter.value)}
          onValueChange={(v) => onChange(Array.isArray(v) && v.length > 0 ? JSON.stringify(v) : "")}
        />
      );
    }
    return (
      <select aria-label="Wartość" className={cn(inputVariants({ size: "sm" }), "text-xs", !filter.value && "text-n-500")} value={filter.value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— wybierz —</option>
        {column.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  switch (column.kind) {
    case "NUMBER":
    case "RATING":
    case "AUTO_NUMBER":
      return <Input size="sm" type="number" value={filter.value} onChange={(e) => onChange(e.target.value)} placeholder="0" className="font-mono text-xs" />;
    case "DATE":
    case "CREATED_TIME":
    case "LAST_MODIFIED_TIME":
    case "BUILTIN_DATE":
      return <Input size="sm" type="date" value={filter.value ? filter.value.slice(0, 10) : ""} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />;
    default:
      return <Input size="sm" value={filter.value} onChange={(e) => onChange(e.target.value)} placeholder="wartość…" className="text-xs" />;
  }
}
