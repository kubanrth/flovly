"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  createStatusColumnSchema,
  deleteStatusColumnSchema,
  renameBoardSchema,
  reorderStatusColumnsSchema,
  updateStatusColumnSchema,
} from "@/lib/schemas/board";
import { backgroundSchema, updateBackgroundSchema } from "@/lib/schemas/background";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

const NICE_COLORS = [
  "#64748B",
  "#F59E0B",
  "#3B82F6",
  "#10B981",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#14B8A6",
];

export async function renameBoardAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  // F12-K61: coerce null → undefined dla `description` żeby schema'owe
  // `.optional()` zaakceptowało brak pola w FormData (formData.get() zwraca
  // null gdy brak; null nie pasuje do z.string().optional()).
  const descRaw = formData.get("description");
  const parsed = renameBoardSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: descRaw === null ? undefined : descRaw,
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(workspaceId, "board.update");
  // F12-K61: skip description gdy nie podane (Prisma undefined = "don't
  // update this column"). Inline-edit-name nie powinien wymazywać opisu.
  const board = await db.board.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description || null }
        : {}),
    },
  });
  await writeAudit({
    workspaceId,
    objectType: "Board",
    objectId: board.id,
    actorId: ctx.userId,
    action: "board.renamed",
    diff: { name: board.name },
  });
  revalidatePath(`/w/${workspaceId}`);
  revalidatePath(`/w/${workspaceId}/b/${board.id}/table`);
}

export async function createStatusColumnAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = createStatusColumnSchema.safeParse({
    boardId: formData.get("boardId"),
    name: formData.get("name"),
    colorHex: formData.get("colorHex") || undefined,
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(workspaceId, "board.update");

  const count = await db.statusColumn.count({ where: { boardId: parsed.data.boardId } });
  const color = parsed.data.colorHex || NICE_COLORS[count % NICE_COLORS.length];

  const col = await db.statusColumn.create({
    data: {
      boardId: parsed.data.boardId,
      name: parsed.data.name,
      colorHex: color,
      order: count,
    },
  });
  await writeAudit({
    workspaceId,
    objectType: "Board",
    objectId: parsed.data.boardId,
    actorId: ctx.userId,
    action: "board.statusColumnCreated",
    diff: { name: col.name },
  });
  revalidatePath(`/w/${workspaceId}/b/${parsed.data.boardId}/table`);
  revalidatePath(`/w/${workspaceId}/b/${parsed.data.boardId}/kanban`);
}

export async function updateStatusColumnAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = updateStatusColumnSchema.safeParse({
    columnId: formData.get("columnId"),
    name: formData.get("name"),
    colorHex: formData.get("colorHex"),
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(workspaceId, "board.update");

  const col = await db.statusColumn.update({
    where: { id: parsed.data.columnId },
    data: { name: parsed.data.name, colorHex: parsed.data.colorHex },
  });
  await writeAudit({
    workspaceId,
    objectType: "Board",
    objectId: col.boardId,
    actorId: ctx.userId,
    action: "board.statusColumnUpdated",
    diff: { name: col.name },
  });
  revalidatePath(`/w/${workspaceId}/b/${col.boardId}/table`);
  revalidatePath(`/w/${workspaceId}/b/${col.boardId}/kanban`);
}

export async function deleteStatusColumnAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = deleteStatusColumnSchema.safeParse({
    columnId: formData.get("columnId"),
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(workspaceId, "board.update");

  const col = await db.statusColumn.findUnique({ where: { id: parsed.data.columnId } });
  if (!col) return;

  // Move all tasks in this column to "no status" (null).
  await db.$transaction([
    db.task.updateMany({
      where: { statusColumnId: parsed.data.columnId },
      data: { statusColumnId: null },
    }),
    db.statusColumn.delete({ where: { id: parsed.data.columnId } }),
  ]);

  await writeAudit({
    workspaceId,
    objectType: "Board",
    objectId: col.boardId,
    actorId: ctx.userId,
    action: "board.statusColumnDeleted",
    diff: { name: col.name },
  });
  revalidatePath(`/w/${workspaceId}/b/${col.boardId}/table`);
  revalidatePath(`/w/${workspaceId}/b/${col.boardId}/kanban`);
}

// BoardView background — "ikona pędzla" per-view customization (color /
// gradient / image URL). Persists on BoardView.background as JSON.
export async function updateBackgroundAction(formData: FormData) {
  const parsedMeta = updateBackgroundSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
    viewType: formData.get("viewType"),
    payload: formData.get("payload"),
  });
  if (!parsedMeta.success) return;

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(parsedMeta.data.payload);
  } catch {
    return;
  }
  const parsed = backgroundSchema.safeParse(parsedPayload);
  if (!parsed.success) return;

  const ctx = await requireWorkspaceAction(
    parsedMeta.data.workspaceId,
    "background.customize",
  );

  // F8 dropped the @@unique([boardId, type]) index so a board can host
  // multiple views of the same type (custom views). The "default" view
  // for each type is the one with name = null, so we target that here.
  const bg = parsed.data === null ? Prisma.DbNull : (parsed.data as Prisma.InputJsonValue);
  const existing = await db.boardView.findFirst({
    where: {
      boardId: parsedMeta.data.boardId,
      type: parsedMeta.data.viewType,
      name: null,
    },
    select: { id: true },
  });
  if (existing) {
    await db.boardView.update({
      where: { id: existing.id },
      data: { background: bg },
    });
  } else {
    await db.boardView.create({
      data: {
        boardId: parsedMeta.data.boardId,
        type: parsedMeta.data.viewType,
        background: bg,
      },
    });
  }

  await writeAudit({
    workspaceId: parsedMeta.data.workspaceId,
    objectType: "Board",
    objectId: parsedMeta.data.boardId,
    actorId: ctx.userId,
    action: "board.backgroundCustomized",
    diff: { viewType: parsedMeta.data.viewType, kind: (parsed.data ?? { kind: "none" }).kind },
  });

  revalidatePath(`/w/${parsedMeta.data.workspaceId}/b/${parsedMeta.data.boardId}/table`);
}

export async function reorderStatusColumnsAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const rawIds = formData.get("ids");
  const parsed = reorderStatusColumnsSchema.safeParse({
    boardId: formData.get("boardId"),
    ids: typeof rawIds === "string" ? rawIds.split(",").filter(Boolean) : [],
  });
  if (!parsed.success) return;
  await requireWorkspaceAction(workspaceId, "board.update");

  await db.$transaction(
    parsed.data.ids.map((id, idx) =>
      db.statusColumn.update({ where: { id }, data: { order: idx } }),
    ),
  );
  // F12-K55: revalidate też kanban + roadmap (kolejność statusów to
  // kolejność kolumn w kanban, przedziałów w roadmap'ie).
  revalidatePath(`/w/${workspaceId}/b/${parsed.data.boardId}/table`);
  revalidatePath(`/w/${workspaceId}/b/${parsed.data.boardId}/kanban`);
  revalidatePath(`/w/${workspaceId}/b/${parsed.data.boardId}/roadmap`);
}

// F8b: create a named BoardView so the user can have multiple views of
// the same type (e.g. two Kanbans with different filters), and also a
// "name = null" default row that recreates the canonical pill (Tabela,
// Kanban, …) when the user deleted it earlier.
const createViewSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  type: z.enum(["TABLE", "KANBAN", "ROADMAP", "GANTT", "WHITEBOARD"]),
  // Empty string = recreate the default for this type. Server checks
  // there isn't already a default of this type before allowing it.
  name: z.string().trim().max(60).optional(),
});

export type CreateViewState =
  | { ok: true; viewId: string; defaultPath: string | null }
  | { ok: false; error?: string; fieldErrors?: { name?: string; type?: string } }
  | null;

export async function createBoardViewAction(
  _prev: CreateViewState,
  formData: FormData,
): Promise<CreateViewState> {
  const parsed = createViewSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
    type: formData.get("type"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) {
    const fe: { name?: string; type?: string } = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "name" || k === "type") fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "board.update");

  const wantsDefault = !parsed.data.name || parsed.data.name.length === 0;
  if (wantsDefault) {
    // Guard: there should only ever be one "default" row (name=null)
    // per (board, type). Fail loudly so the UI prompts for a name.
    const existing = await db.boardView.findFirst({
      where: { boardId: parsed.data.boardId, type: parsed.data.type, name: null },
    });
    if (existing) {
      return {
        ok: false,
        fieldErrors: { name: "Domyślny widok tego typu już istnieje — podaj nazwę dla nowego." },
      };
    }
  }

  const view = await db.boardView.create({
    data: {
      boardId: parsed.data.boardId,
      type: parsed.data.type,
      name: wantsDefault ? null : parsed.data.name,
    },
  });

  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Board",
    objectId: parsed.data.boardId,
    actorId: ctx.userId,
    action: "boardView.created",
    diff: { type: parsed.data.type, name: parsed.data.name ?? null },
  });

  // Default views map back to canonical /table /kanban /roadmap etc.
  // routes; named views live under /v/[viewId].
  const defaultPath = wantsDefault
    ? `/w/${parsed.data.workspaceId}/b/${parsed.data.boardId}/${parsed.data.type.toLowerCase()}`
    : null;

  // Revalidate every default route so the pill list updates regardless
  // of which page the user lands on.
  const base = `/w/${parsed.data.workspaceId}/b/${parsed.data.boardId}`;
  for (const p of ["table", "kanban", "roadmap", "gantt", "whiteboard"]) {
    revalidatePath(`${base}/${p}`);
  }
  return { ok: true, viewId: view.id, defaultPath };
}

const deleteViewSchema = z.object({ viewId: z.string().min(1) });

export async function deleteBoardViewAction(formData: FormData) {
  const parsed = deleteViewSchema.safeParse({ viewId: formData.get("viewId") });
  if (!parsed.success) return;

  const view = await db.boardView.findUnique({
    where: { id: parsed.data.viewId },
    include: { board: { select: { workspaceId: true, id: true } } },
  });
  if (!view) return;

  const ctx = await requireWorkspaceAction(view.board.workspaceId, "board.update");

  // F9-08: also allow removing default (name=null) views per board —
  // e.g. an OKR board wants only Tabela. Safety: never let the board
  // end up with zero views (user would have no way back in).
  const remaining = await db.boardView.count({
    where: { boardId: view.board.id, id: { not: view.id } },
  });
  if (remaining === 0) return;

  await db.boardView.delete({ where: { id: parsed.data.viewId } });

  await writeAudit({
    workspaceId: view.board.workspaceId,
    objectType: "Board",
    objectId: view.board.id,
    actorId: ctx.userId,
    action: "boardView.deleted",
    diff: { type: view.type, name: view.name },
  });
  // Revalidate every concrete view page — user might have been on the
  // one we just deleted and needs the updated pill list on reload.
  const base = `/w/${view.board.workspaceId}/b/${view.board.id}`;
  for (const p of ["table", "kanban", "roadmap", "gantt", "whiteboard"]) {
    revalidatePath(`${base}/${p}`);
  }
}

// F8b: per-board table column preferences. Stored on the default TABLE
// BoardView.configJson as `{ columnOrder: string[], hidden: string[] }`.
// Per-board (not per-user) because support-ability > ergonomics — one
// shared layout means screenshots match what admins see.
const tablePrefsSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  // Stringified JSON `{ columnOrder, hidden }`.
  config: z.string().max(4000),
});

// F9-07 / F10-A: CRUD for per-board custom columns. F10-A added type
// + options so each column knows whether it's NUMBER, DATE, SELECT, etc.
// `options` is opaque JSON validated by the FieldOptions schema in
// lib/table-fields.ts — we trust the client picker here and only check
// shape on read in formatCellValue.
const FIELD_TYPES = [
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "DATE",
  "CHECKBOX",
  "SINGLE_SELECT",
  "MULTI_SELECT",
  "URL",
  "EMAIL",
  "PHONE",
  "RATING",
  "USER",
  "ATTACHMENT",
  "CREATED_TIME",
  "LAST_MODIFIED_TIME",
  "AUTO_NUMBER",
] as const;

const createTableColumnSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  type: z.enum(FIELD_TYPES).default("TEXT"),
  options: z.string().max(8000).optional(),
});

export async function createTableColumnAction(formData: FormData) {
  const parsed = createTableColumnSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
    name: formData.get("name"),
    type: formData.get("type") ?? "TEXT",
    options: formData.get("options") ?? undefined,
  });
  if (!parsed.success) return;

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "board.update");

  let optionsJson: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull;
  if (parsed.data.options) {
    try {
      const obj = JSON.parse(parsed.data.options);
      if (obj && typeof obj === "object") optionsJson = obj as Prisma.InputJsonValue;
    } catch {
      // invalid JSON → fall back to NULL options
    }
  }

  const last = await db.tableColumn.findFirst({
    where: { boardId: parsed.data.boardId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await db.tableColumn.create({
    data: {
      boardId: parsed.data.boardId,
      name: parsed.data.name,
      type: parsed.data.type,
      options: optionsJson,
      order: (last?.order ?? 0) + 1,
    },
  });
  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Board",
    objectId: parsed.data.boardId,
    actorId: ctx.userId,
    action: "tableColumn.created",
    diff: { name: parsed.data.name, type: parsed.data.type },
  });
  revalidatePath(`/w/${parsed.data.workspaceId}/b/${parsed.data.boardId}/table`);
}

// F10-A: rename + retype + reconfigure an existing column. Used by the
// gear-icon popover in the table header. Type changes are destructive
// in spirit (a NUMBER column becoming DATE will display NaN strings
// from old text values), so the picker UI warns the user — we don't
// scrub TaskCustomValue rows here.
const configureColumnSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  type: z.enum(FIELD_TYPES).optional(),
  options: z.string().max(8000).optional(),
});

export async function configureColumnAction(formData: FormData) {
  const parsed = configureColumnSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") ?? undefined,
    type: formData.get("type") ?? undefined,
    options: formData.get("options") ?? undefined,
  });
  if (!parsed.success) return;

  const col = await db.tableColumn.findUnique({
    where: { id: parsed.data.id },
    include: { board: { select: { workspaceId: true, id: true } } },
  });
  if (!col) return;
  const ctx = await requireWorkspaceAction(col.board.workspaceId, "board.update");

  const data: Prisma.TableColumnUpdateInput = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.type !== undefined) data.type = parsed.data.type;
  if (parsed.data.options !== undefined) {
    if (parsed.data.options === "") {
      data.options = Prisma.DbNull;
    } else {
      try {
        const obj = JSON.parse(parsed.data.options);
        data.options = obj && typeof obj === "object" ? (obj as Prisma.InputJsonValue) : Prisma.DbNull;
      } catch {
        return;
      }
    }
  }

  await db.tableColumn.update({ where: { id: parsed.data.id }, data });
  await writeAudit({
    workspaceId: col.board.workspaceId,
    objectType: "Board",
    objectId: col.board.id,
    actorId: ctx.userId,
    action: "tableColumn.configured",
    diff: { id: parsed.data.id, type: parsed.data.type, name: parsed.data.name },
  });
  revalidatePath(`/w/${col.board.workspaceId}/b/${col.board.id}/table`);
}

const renameTableColumnSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
});

export async function renameTableColumnAction(formData: FormData) {
  const parsed = renameTableColumnSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;

  const col = await db.tableColumn.findUnique({
    where: { id: parsed.data.id },
    include: { board: { select: { workspaceId: true, id: true } } },
  });
  if (!col) return;
  const ctx = await requireWorkspaceAction(col.board.workspaceId, "board.update");
  await db.tableColumn.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });
  await writeAudit({
    workspaceId: col.board.workspaceId,
    objectType: "Board",
    objectId: col.board.id,
    actorId: ctx.userId,
    action: "tableColumn.renamed",
    diff: { name: parsed.data.name },
  });
  revalidatePath(`/w/${col.board.workspaceId}/b/${col.board.id}/table`);
}

const deleteTableColumnSchema = z.object({ id: z.string().min(1) });

export async function deleteTableColumnAction(formData: FormData) {
  const parsed = deleteTableColumnSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const col = await db.tableColumn.findUnique({
    where: { id: parsed.data.id },
    include: { board: { select: { workspaceId: true, id: true } } },
  });
  if (!col) return;
  const ctx = await requireWorkspaceAction(col.board.workspaceId, "board.update");
  await db.tableColumn.delete({ where: { id: parsed.data.id } });
  await writeAudit({
    workspaceId: col.board.workspaceId,
    objectType: "Board",
    objectId: col.board.id,
    actorId: ctx.userId,
    action: "tableColumn.deleted",
    diff: { name: col.name },
  });
  revalidatePath(`/w/${col.board.workspaceId}/b/${col.board.id}/table`);
}

const setCellSchema = z.object({
  taskId: z.string().min(1),
  columnId: z.string().min(1),
  value: z.string().max(4000).optional().or(z.literal("")),
});

export async function setTaskCustomValueAction(formData: FormData) {
  const parsed = setCellSchema.safeParse({
    taskId: formData.get("taskId"),
    columnId: formData.get("columnId"),
    value: formData.get("value") ?? "",
  });
  if (!parsed.success) return;

  // Ownership guard: both task + column must belong to the same board
  // under a workspace the user can update.
  const [task, col] = await Promise.all([
    db.task.findUnique({
      where: { id: parsed.data.taskId },
      select: { workspaceId: true, boardId: true },
    }),
    db.tableColumn.findUnique({
      where: { id: parsed.data.columnId },
      select: { boardId: true },
    }),
  ]);
  if (!task || !col || task.boardId !== col.boardId) return;

  await requireWorkspaceAction(task.workspaceId, "task.update");

  const v = parsed.data.value ?? "";
  if (v.length === 0) {
    await db.taskCustomValue.deleteMany({
      where: { taskId: parsed.data.taskId, columnId: parsed.data.columnId },
    });
  } else {
    await db.taskCustomValue.upsert({
      where: {
        taskId_columnId: {
          taskId: parsed.data.taskId,
          columnId: parsed.data.columnId,
        },
      },
      update: { valueText: v },
      create: {
        taskId: parsed.data.taskId,
        columnId: parsed.data.columnId,
        valueText: v,
      },
    });
  }
  revalidatePath(`/w/${task.workspaceId}/b/${task.boardId}/table`);
}

// F10-B: persist filter + sort + groupBy on the default TABLE view's
// configJson (alongside columnOrder/hidden saved by saveTableColumnPrefsAction).
// All three are optional — UI sends only the keys it edits, and we
// merge with whatever already lives on the view.
const tableFiltersSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  // Stringified JSON: `{ filters?, sort?, groupBy? }`
  payload: z.string().max(8000),
});

export async function saveTableFiltersAction(formData: FormData) {
  const parsed = tableFiltersSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
    payload: formData.get("payload"),
  });
  if (!parsed.success) return;

  let payload: unknown;
  try {
    payload = JSON.parse(parsed.data.payload);
  } catch {
    return;
  }
  const shape = z
    .object({
      filters: z
        .array(
          z.object({
            columnId: z.string().min(1),
            kind: z.string(),
            op: z.string(),
            value: z.string().max(2000),
          }),
        )
        .optional(),
      sort: z
        .object({
          columnId: z.string().min(1),
          kind: z.string(),
          dir: z.enum(["asc", "desc"]),
        })
        .nullable()
        .optional(),
      groupBy: z.string().nullable().optional(),
    })
    .safeParse(payload);
  if (!shape.success) return;

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "board.update");

  const existing = await db.boardView.findFirst({
    where: { boardId: parsed.data.boardId, type: "TABLE", name: null },
    select: { id: true, configJson: true },
  });

  const merged: Prisma.InputJsonValue = {
    ...(typeof existing?.configJson === "object" && existing.configJson
      ? (existing.configJson as Record<string, unknown>)
      : {}),
    ...(shape.data.filters !== undefined ? { filters: shape.data.filters } : {}),
    ...(shape.data.sort !== undefined ? { sort: shape.data.sort } : {}),
    ...(shape.data.groupBy !== undefined ? { groupBy: shape.data.groupBy } : {}),
  };

  if (existing) {
    await db.boardView.update({
      where: { id: existing.id },
      data: { configJson: merged },
    });
  } else {
    await db.boardView.create({
      data: {
        boardId: parsed.data.boardId,
        type: "TABLE",
        configJson: merged,
      },
    });
  }

  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Board",
    objectId: parsed.data.boardId,
    actorId: ctx.userId,
    action: "board.tableFiltersUpdated",
    diff: {
      filters: shape.data.filters?.length ?? 0,
      sort: shape.data.sort?.columnId ?? null,
      groupBy: shape.data.groupBy ?? null,
    },
  });

  revalidatePath(`/w/${parsed.data.workspaceId}/b/${parsed.data.boardId}/table`);
}

export async function saveTableColumnPrefsAction(formData: FormData) {
  const parsed = tablePrefsSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
    config: formData.get("config"),
  });
  if (!parsed.success) return;

  let config: unknown;
  try {
    config = JSON.parse(parsed.data.config);
  } catch {
    return;
  }
  const shape = z
    .object({
      columnOrder: z.array(z.string()).optional(),
      hidden: z.array(z.string()).optional(),
      // F10-X: per-column persisted pixel widths (TanStack columnSizing)
      widths: z.record(z.string(), z.number().min(40).max(1200)).optional(),
      // F12-K3: pinned columns (left side) by columnId
      pinned: z.array(z.string()).optional(),
    })
    .safeParse(config);
  if (!shape.success) return;

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "board.update");

  const existing = await db.boardView.findFirst({
    where: { boardId: parsed.data.boardId, type: "TABLE", name: null },
    select: { id: true, configJson: true },
  });

  const mergedConfig: Prisma.InputJsonValue = {
    ...(typeof existing?.configJson === "object" && existing.configJson
      ? (existing.configJson as Record<string, unknown>)
      : {}),
    ...(shape.data.columnOrder !== undefined ? { columnOrder: shape.data.columnOrder } : {}),
    ...(shape.data.hidden !== undefined ? { hidden: shape.data.hidden } : {}),
    ...(shape.data.widths !== undefined ? { widths: shape.data.widths } : {}),
    ...(shape.data.pinned !== undefined ? { pinned: shape.data.pinned } : {}),
  };

  if (existing) {
    await db.boardView.update({
      where: { id: existing.id },
      data: { configJson: mergedConfig },
    });
  } else {
    await db.boardView.create({
      data: {
        boardId: parsed.data.boardId,
        type: "TABLE",
        configJson: mergedConfig,
      },
    });
  }

  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Board",
    objectId: parsed.data.boardId,
    actorId: ctx.userId,
    action: "board.tablePrefsUpdated",
    diff: { order: shape.data.columnOrder, hidden: shape.data.hidden },
  });

  revalidatePath(`/w/${parsed.data.workspaceId}/b/${parsed.data.boardId}/table`);
}
