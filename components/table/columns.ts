import type { FieldType } from "@/lib/table-fields";
import type { TableFilter } from "@/lib/table-filters";
import type { CustomTableColumn } from "@/components/table/types";

// Built-in columns in B1 order with default widths (px). Drag-resize overrides persist on top.
export interface BuiltinColumnDef {
  id: string;
  label: string;
  width: number;
  minWidth: number;
  // Sort/compare semantics (see sortKey in board-table).
  kind: TableFilter["kind"];
}

export const CHECKBOX_W = 36;
export const FROZEN_IDS = ["displayId", "title"];

export const BUILTIN_COLUMNS: BuiltinColumnDef[] = [
  { id: "displayId", label: "#ID", width: 56, minWidth: 48, kind: "NUMBER" },
  { id: "title", label: "Tytuł", width: 392, minWidth: 160, kind: "BUILTIN_TITLE" },
  { id: "statusColumnId", label: "Status", width: 128, minWidth: 90, kind: "BUILTIN_STATUS" },
  { id: "priority", label: "Priorytet", width: 116, minWidth: 80, kind: "NUMBER" },
  { id: "assignees", label: "Przypisani", width: 104, minWidth: 72, kind: "TEXT" },
  { id: "tags", label: "Tagi", width: 148, minWidth: 90, kind: "TEXT" },
  { id: "startAt", label: "Start", width: 96, minWidth: 72, kind: "BUILTIN_DATE" },
  { id: "stopAt", label: "Koniec", width: 96, minWidth: 72, kind: "BUILTIN_DATE" },
  { id: "attachments", label: "Załączniki", width: 96, minWidth: 64, kind: "NUMBER" },
  { id: "milestone", label: "Milestone", width: 136, minWidth: 90, kind: "TEXT" },
];

export const customColId = (id: string) => `custom:${id}`;
export const rawColId = (id: string) => id.replace(/^custom:/, "");
export const isCustomColId = (id: string) => id.startsWith("custom:");

export function defaultWidthForType(type: FieldType): number {
  switch (type) {
    case "CHECKBOX": return 80;
    case "RATING": return 130;
    case "NUMBER":
    case "AUTO_NUMBER": return 110;
    case "DATE":
    case "CREATED_TIME":
    case "LAST_MODIFIED_TIME": return 140;
    case "PHONE": return 150;
    case "URL":
    case "EMAIL": return 200;
    case "LONG_TEXT": return 280;
    case "MULTI_SELECT": return 200;
    case "SINGLE_SELECT":
    case "USER": return 150;
    case "ATTACHMENT": return 120;
    default: return 180;
  }
}

// Frozen first, then the saved order (unknown ids dropped), then anything new.
export function orderedColumnIds(saved: string[], customIds: string[]): string[] {
  const known = new Set([...BUILTIN_COLUMNS.map((c) => c.id), ...customIds]);
  const rest = saved.filter((id) => known.has(id) && !FROZEN_IDS.includes(id));
  const seen = new Set([...FROZEN_IDS, ...rest]);
  return [
    ...FROZEN_IDS,
    ...rest,
    ...BUILTIN_COLUMNS.map((c) => c.id).filter((id) => !seen.has(id)),
    ...customIds.filter((id) => !seen.has(id)),
  ];
}

export function sortKindFor(colId: string, customColumns: CustomTableColumn[]): TableFilter["kind"] {
  if (isCustomColId(colId)) return customColumns.find((c) => c.id === rawColId(colId))?.type ?? "TEXT";
  return BUILTIN_COLUMNS.find((c) => c.id === colId)?.kind ?? "TEXT";
}

export function columnLabel(colId: string, customColumns: CustomTableColumn[]): string {
  if (isCustomColId(colId)) return customColumns.find((c) => c.id === rawColId(colId))?.name ?? colId;
  return BUILTIN_COLUMNS.find((c) => c.id === colId)?.label ?? colId;
}
