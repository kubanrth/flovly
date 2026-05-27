"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

// Link folders are named containers + user-defined tables (columns/rows/cells).
// All mutations scope by folder → board → workspace.
const revalidateBoard = (workspaceId: string, boardId: string) => {
  const base = `/w/${workspaceId}/b/${boardId}`;
  for (const p of ["table", "kanban", "roadmap", "gantt", "whiteboard"]) {
    revalidatePath(`${base}/${p}`);
  }
};

// --- Folder ---

const createFolderSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
});

export async function createLinkFolderAction(formData: FormData) {
  const parsed = createFolderSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "boardLink.manage");

  const last = await db.linkFolder.findFirst({
    where: { boardId: parsed.data.boardId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  // Seed three default columns so the user doesn't land on an empty table.
  const folder = await db.linkFolder.create({
    data: {
      boardId: parsed.data.boardId,
      name: parsed.data.name,
      order: (last?.order ?? 0) + 1,
      columns: {
        create: [
          { name: "Nazwa", order: 0 },
          { name: "Link", order: 1 },
          { name: "Opis", order: 2 },
        ],
      },
    },
  });
  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Board",
    objectId: parsed.data.boardId,
    actorId: ctx.userId,
    action: "linkFolder.created",
    diff: { id: folder.id, name: folder.name },
  });
  revalidateBoard(parsed.data.workspaceId, parsed.data.boardId);
}

const renameFolderSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
});

export async function renameLinkFolderAction(formData: FormData) {
  const parsed = renameFolderSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;
  const f = await db.linkFolder.findUnique({
    where: { id: parsed.data.id },
    include: { board: { select: { workspaceId: true, id: true } } },
  });
  if (!f) return;
  const ctx = await requireWorkspaceAction(f.board.workspaceId, "boardLink.manage");
  await db.linkFolder.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });
  await writeAudit({
    workspaceId: f.board.workspaceId,
    objectType: "Board",
    objectId: f.board.id,
    actorId: ctx.userId,
    action: "linkFolder.renamed",
    diff: { name: parsed.data.name },
  });
  revalidateBoard(f.board.workspaceId, f.board.id);
}

const deleteFolderSchema = z.object({ id: z.string().min(1) });

export async function deleteLinkFolderAction(formData: FormData) {
  const parsed = deleteFolderSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  const f = await db.linkFolder.findUnique({
    where: { id: parsed.data.id },
    include: { board: { select: { workspaceId: true, id: true } } },
  });
  if (!f) return;
  const ctx = await requireWorkspaceAction(f.board.workspaceId, "boardLink.manage");
  await db.linkFolder.delete({ where: { id: parsed.data.id } });
  await writeAudit({
    workspaceId: f.board.workspaceId,
    objectType: "Board",
    objectId: f.board.id,
    actorId: ctx.userId,
    action: "linkFolder.deleted",
    diff: { name: f.name },
  });
  revalidateBoard(f.board.workspaceId, f.board.id);
}

// --- Columns ---

const createColumnSchema = z.object({
  folderId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
});

export async function createLinkFolderColumnAction(formData: FormData) {
  const parsed = createColumnSchema.safeParse({
    folderId: formData.get("folderId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;
  const f = await db.linkFolder.findUnique({
    where: { id: parsed.data.folderId },
    include: { board: { select: { workspaceId: true, id: true } } },
  });
  if (!f) return;
  await requireWorkspaceAction(f.board.workspaceId, "boardLink.manage");

  const last = await db.linkFolderColumn.findFirst({
    where: { folderId: parsed.data.folderId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await db.linkFolderColumn.create({
    data: {
      folderId: parsed.data.folderId,
      name: parsed.data.name,
      order: (last?.order ?? 0) + 1,
    },
  });
  revalidateBoard(f.board.workspaceId, f.board.id);
}

const renameColumnSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
});

export async function renameLinkFolderColumnAction(formData: FormData) {
  const parsed = renameColumnSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;
  const c = await db.linkFolderColumn.findUnique({
    where: { id: parsed.data.id },
    include: { folder: { include: { board: { select: { workspaceId: true, id: true } } } } },
  });
  if (!c) return;
  await requireWorkspaceAction(c.folder.board.workspaceId, "boardLink.manage");
  await db.linkFolderColumn.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });
  revalidateBoard(c.folder.board.workspaceId, c.folder.board.id);
}

const deleteColumnSchema = z.object({ id: z.string().min(1) });

export async function deleteLinkFolderColumnAction(formData: FormData) {
  const parsed = deleteColumnSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  const c = await db.linkFolderColumn.findUnique({
    where: { id: parsed.data.id },
    include: { folder: { include: { board: { select: { workspaceId: true, id: true } } } } },
  });
  if (!c) return;
  await requireWorkspaceAction(c.folder.board.workspaceId, "boardLink.manage");
  await db.linkFolderColumn.delete({ where: { id: parsed.data.id } });
  revalidateBoard(c.folder.board.workspaceId, c.folder.board.id);
}

// --- Rows / cells ---

const createRowSchema = z.object({ folderId: z.string().min(1) });

export async function createLinkFolderRowAction(formData: FormData) {
  const parsed = createRowSchema.safeParse({ folderId: formData.get("folderId") });
  if (!parsed.success) return;
  const f = await db.linkFolder.findUnique({
    where: { id: parsed.data.folderId },
    include: { board: { select: { workspaceId: true, id: true } } },
  });
  if (!f) return;
  await requireWorkspaceAction(f.board.workspaceId, "boardLink.manage");
  const last = await db.linkFolderRow.findFirst({
    where: { folderId: parsed.data.folderId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await db.linkFolderRow.create({
    data: {
      folderId: parsed.data.folderId,
      order: (last?.order ?? 0) + 1,
    },
  });
  revalidateBoard(f.board.workspaceId, f.board.id);
}

const deleteRowSchema = z.object({ id: z.string().min(1) });

export async function deleteLinkFolderRowAction(formData: FormData) {
  const parsed = deleteRowSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  const r = await db.linkFolderRow.findUnique({
    where: { id: parsed.data.id },
    include: { folder: { include: { board: { select: { workspaceId: true, id: true } } } } },
  });
  if (!r) return;
  await requireWorkspaceAction(r.folder.board.workspaceId, "boardLink.manage");
  await db.linkFolderRow.delete({ where: { id: parsed.data.id } });
  revalidateBoard(r.folder.board.workspaceId, r.folder.board.id);
}

const setCellSchema = z.object({
  rowId: z.string().min(1),
  columnId: z.string().min(1),
  value: z.string().max(4000).optional().or(z.literal("")),
});

export async function setLinkFolderCellAction(formData: FormData) {
  const parsed = setCellSchema.safeParse({
    rowId: formData.get("rowId"),
    columnId: formData.get("columnId"),
    value: formData.get("value") ?? "",
  });
  if (!parsed.success) return;
  // Row and column must belong to the same folder.
  const row = await db.linkFolderRow.findUnique({
    where: { id: parsed.data.rowId },
    include: { folder: { include: { board: { select: { workspaceId: true, id: true } } } } },
  });
  const column = await db.linkFolderColumn.findUnique({
    where: { id: parsed.data.columnId },
    select: { folderId: true },
  });
  if (!row || !column || row.folderId !== column.folderId) return;

  await requireWorkspaceAction(row.folder.board.workspaceId, "boardLink.manage");

  const v = parsed.data.value ?? "";
  if (v.length === 0) {
    await db.linkFolderCellValue.deleteMany({
      where: { rowId: parsed.data.rowId, columnId: parsed.data.columnId },
    });
  } else {
    await db.linkFolderCellValue.upsert({
      where: {
        rowId_columnId: {
          rowId: parsed.data.rowId,
          columnId: parsed.data.columnId,
        },
      },
      update: { valueText: v },
      create: {
        rowId: parsed.data.rowId,
        columnId: parsed.data.columnId,
        valueText: v,
      },
    });
  }
  revalidateBoard(row.folder.board.workspaceId, row.folder.board.id);
}
