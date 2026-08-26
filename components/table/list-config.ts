import type { TableFilter, TableSort } from "@/lib/table-filters";

// Per-view Lista config persisted in BoardView.configJson (server-safe module —
// pages parse it before handing it to the client provider).
export interface ListConfig {
  filters: TableFilter[];
  sort: TableSort | null;
  groupBy: string | null;
  columnOrder: string[];
  hidden: string[];
  pinned: string[];
  widths: Record<string, number>;
}

// Guarded read — shape is validated on write, legacy/hand-edited rows can differ.
export function parseListConfig(raw: unknown): ListConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    filters: Array.isArray(c.filters) ? (c.filters as TableFilter[]) : [],
    sort: c.sort && typeof c.sort === "object" ? (c.sort as TableSort) : null,
    groupBy: typeof c.groupBy === "string" ? c.groupBy : null,
    columnOrder: Array.isArray(c.columnOrder) ? (c.columnOrder as string[]) : [],
    hidden: Array.isArray(c.hidden) ? (c.hidden as string[]) : [],
    pinned: Array.isArray(c.pinned) ? (c.pinned as string[]) : [],
    widths: c.widths && typeof c.widths === "object" ? (c.widths as Record<string, number>) : {},
  };
}
