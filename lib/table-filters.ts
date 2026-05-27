// Filter / sort / group config for the Tabela view.
//
// Persisted shape on `BoardView.configJson`:
//   { columnOrder: string[], hidden: string[],
//     filters: TableFilter[], sort: TableSort | null,
//     groupBy: string | null }
//
// Operators typed per FieldType so UI narrows the dropdown. Apply runs
// client-side over the fetched task list — server stays simple, realtime
// subscriptions stay intact.

import type { FieldType } from "@/lib/table-fields";
import { decodeCellValue } from "@/lib/table-fields";

// UI narrows the choice per column type via OPERATORS_FOR_TYPE below.
export type FilterOp =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "isEmpty"
  | "isNotEmpty"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "before"
  | "after"
  | "isToday"
  | "isFuture"
  | "isPast"
  | "isChecked"
  | "isNotChecked"
  | "hasAny"  // MULTI_SELECT: at least one of the selected options
  | "hasAll"; // MULTI_SELECT: all selected

export interface TableFilter {
  // Built-ins: "title" | "statusColumnId" | "startAt" | "stopAt".
  // Custom columns: raw TableColumn.id (no `custom:` prefix).
  columnId: string;
  // Mirrors FieldType so UI doesn't re-resolve the column per render.
  // "BUILTIN_*" used for non-custom columns.
  kind: FieldType | "BUILTIN_TITLE" | "BUILTIN_STATUS" | "BUILTIN_DATE";
  op: FilterOp;
  // String-encoded; MULTI_SELECT stores JSON array of option values.
  value: string;
}

export interface TableSort {
  columnId: string;
  kind: TableFilter["kind"];
  dir: "asc" | "desc";
}

export interface TableViewConfig {
  columnOrder?: string[];
  hidden?: string[];
  filters?: TableFilter[];
  sort?: TableSort | null;
  groupBy?: string | null;
}

export const OPERATORS_FOR_TYPE: Record<TableFilter["kind"], FilterOp[]> = {
  TEXT: ["contains", "notContains", "equals", "notEquals", "isEmpty", "isNotEmpty"],
  LONG_TEXT: ["contains", "notContains", "isEmpty", "isNotEmpty"],
  NUMBER: ["equals", "notEquals", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"],
  DATE: ["before", "after", "isToday", "isFuture", "isPast", "isEmpty", "isNotEmpty"],
  CHECKBOX: ["isChecked", "isNotChecked"],
  SINGLE_SELECT: ["equals", "notEquals", "isEmpty", "isNotEmpty"],
  MULTI_SELECT: ["hasAny", "hasAll", "isEmpty", "isNotEmpty"],
  URL: ["contains", "isEmpty", "isNotEmpty"],
  EMAIL: ["contains", "isEmpty", "isNotEmpty"],
  PHONE: ["contains", "isEmpty", "isNotEmpty"],
  RATING: ["equals", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"],
  USER: ["equals", "notEquals", "isEmpty", "isNotEmpty"],
  ATTACHMENT: ["isEmpty", "isNotEmpty"],
  CREATED_TIME: ["before", "after", "isToday", "isFuture", "isPast"],
  LAST_MODIFIED_TIME: ["before", "after", "isToday", "isFuture", "isPast"],
  AUTO_NUMBER: ["equals", "gt", "gte", "lt", "lte"],
  BUILTIN_TITLE: ["contains", "notContains", "equals", "notEquals", "isEmpty", "isNotEmpty"],
  BUILTIN_STATUS: ["equals", "notEquals", "isEmpty", "isNotEmpty"],
  BUILTIN_DATE: ["before", "after", "isToday", "isFuture", "isPast", "isEmpty", "isNotEmpty"],
};

export const OPERATOR_LABEL: Record<FilterOp, string> = {
  equals: "= równa",
  notEquals: "≠ różna",
  contains: "zawiera",
  notContains: "nie zawiera",
  isEmpty: "puste",
  isNotEmpty: "wypełnione",
  gt: "> większe niż",
  gte: "≥ większe lub równe",
  lt: "< mniejsze niż",
  lte: "≤ mniejsze lub równe",
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

export function matchesFilter(
  filter: TableFilter,
  rawValue: string | undefined,
): boolean {
  const v = rawValue ?? "";
  switch (filter.op) {
    case "isEmpty":
      return v.length === 0;
    case "isNotEmpty":
      return v.length > 0;
    case "equals":
      return v === filter.value;
    case "notEquals":
      return v !== filter.value;
    case "contains":
      return v.toLowerCase().includes(filter.value.toLowerCase());
    case "notContains":
      return !v.toLowerCase().includes(filter.value.toLowerCase());
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = Number(v);
      const b = Number(filter.value);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      return filter.op === "gt"
        ? a > b
        : filter.op === "gte"
          ? a >= b
          : filter.op === "lt"
            ? a < b
            : a <= b;
    }
    case "before":
    case "after": {
      if (!v) return false;
      const ta = new Date(v).getTime();
      const tb = filter.value ? new Date(filter.value).getTime() : NaN;
      if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
      return filter.op === "before" ? ta < tb : ta > tb;
    }
    case "isToday": {
      if (!v) return false;
      const d = new Date(v);
      const today = new Date();
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    }
    case "isFuture": {
      if (!v) return false;
      return new Date(v).getTime() > Date.now();
    }
    case "isPast": {
      if (!v) return false;
      return new Date(v).getTime() < Date.now();
    }
    case "isChecked":
      return v === "true" || v === "1";
    case "isNotChecked":
      return v !== "true" && v !== "1";
    case "hasAny":
    case "hasAll": {
      const arr = decodeCellValue("MULTI_SELECT", v) as string[] | null;
      const need = filter.value
        ? (() => {
            try {
              const j = JSON.parse(filter.value);
              return Array.isArray(j) ? (j as string[]) : [];
            } catch {
              return [];
            }
          })()
        : [];
      if (!Array.isArray(arr) || arr.length === 0) return false;
      if (need.length === 0) return false;
      return filter.op === "hasAny"
        ? need.some((n) => arr.includes(n))
        : need.every((n) => arr.includes(n));
    }
  }
}

export function compareValues(
  a: string | undefined,
  b: string | undefined,
  kind: TableFilter["kind"],
): number {
  const av = a ?? "";
  const bv = b ?? "";
  if (av === "" && bv === "") return 0;
  if (av === "") return 1; // empties last
  if (bv === "") return -1;
  switch (kind) {
    case "NUMBER":
    case "RATING":
    case "AUTO_NUMBER": {
      const na = Number(av);
      const nb = Number(bv);
      if (!Number.isFinite(na) || !Number.isFinite(nb)) return av.localeCompare(bv);
      return na - nb;
    }
    case "DATE":
    case "CREATED_TIME":
    case "LAST_MODIFIED_TIME":
    case "BUILTIN_DATE": {
      const ta = new Date(av).getTime();
      const tb = new Date(bv).getTime();
      if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
      return ta - tb;
    }
    case "CHECKBOX": {
      const xa = av === "true" || av === "1" ? 1 : 0;
      const xb = bv === "true" || bv === "1" ? 1 : 0;
      return xa - xb;
    }
    default:
      return av.localeCompare(bv);
  }
}
