import type { TaskPriorityValue } from "@/lib/task-priority";
import type { FieldType } from "@/lib/table-fields";
import type { AttachmentCellItem } from "@/components/table/attachment-cell";

export interface SubtaskLine { id: string; title: string; completed: boolean }
/** Zadanie po drugiej stronie powiazania (TaskLink) — do rozwinietego wiersza. */
export interface LinkedTaskLine { id: string; displayId: number; title: string; otherBoard: boolean }

export interface BoardTableTask {
  id: string;
  // Human, per-workspace sequential id (#123). 0 = legacy task before backfill.
  displayId: number;
  title: string;
  statusColumnId: string | null;
  priority: TaskPriorityValue;
  startAt: string | null;
  stopAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignees: { id: string; name: string | null; email: string; avatarUrl: string | null }[];
  tags: { id: string; name: string; colorHex: string }[];
  // User-defined column values keyed by custom column id.
  customValues: Record<string, string>;
  attachments: AttachmentCellItem[];
  milestone: { id: string; title: string } | null;
  hasDescription: boolean;
  commentCount: number;
  subtaskCount: number;
  subtaskDoneCount: number;
  linkedCount: number;
  // F13: zadanie nadrzedne — Lista i Os czasu zagniezdzaja pod nim podrzedne.
  parentId: string | null;
  subtasks: SubtaskLine[];
  linked: LinkedTaskLine[];
}

/** Wiersz Listy po splaszczeniu drzewa (lib/task-tree). */
export interface TreeRow { t: BoardTableTask; depth: number; childCount: number }

export interface BoardTableColumn {
  id: string;
  name: string;
  colorHex: string;
}

export interface CustomTableColumn {
  id: string;
  name: string;
  type: FieldType;
  // Type-specific config (select options, number format…) — parseFieldOptions tolerates anything.
  options: unknown;
}

export interface ListMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export const memberName = (m: { name: string | null; email: string }) => m.name ?? m.email.split("@")[0];
