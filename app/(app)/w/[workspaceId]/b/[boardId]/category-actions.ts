"use server";

// F15: kategorie zadań per tablica. Lista kategorii to ustawienie tablicy
// (`board.update`), przypisanie zadania — zwykła edycja (`task.update`).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { canSeeTask } from "@/lib/access-queries";

export interface TaskCategoryItem { id: string; name: string; colorHex: string }

const HEX = /^#[0-9a-fA-F]{6}$/;
const itemZ = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(60),
  colorHex: z.string().regex(HEX).default("#64748B"),
});

function revalidate() {
  revalidatePath(`/w/[workspaceId]/b/[boardId]`, "layout");
}

async function boardOf(boardId: string) {
  return db.board.findFirst({ where: { id: boardId, deletedAt: null }, select: { id: true, workspaceId: true } });
}

export type SaveCategoriesResult = { ok: true; categories: TaskCategoryItem[] } | { ok: false; error: string };

/**
 * Zapis całej listy naraz (edytor pod przyciskiem „Kategorie"). Wiersz z `id`
 * to zmiana nazwy/koloru, bez `id` — nowa kategoria, brakujący — skasowana
 * (zadania tracą kategorię przez `onDelete: SetNull`). Kolejność = pozycja.
 */
export async function saveTaskCategoriesAction(formData: FormData): Promise<SaveCategoriesResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("categories") ?? "[]"));
  } catch {
    return { ok: false, error: "Nieprawidłowe dane." };
  }
  const parsed = z.object({ boardId: z.string().min(1), categories: z.array(itemZ).max(100) })
    .safeParse({ boardId: formData.get("boardId"), categories: raw });
  if (!parsed.success) return { ok: false, error: "Nazwa kategorii jest wymagana (do 60 znaków)." };

  const board = await boardOf(parsed.data.boardId);
  if (!board) return { ok: false, error: "Tablica nie istnieje." };
  const ctx = await requireWorkspaceAction(board.workspaceId, "board.update");

  const existing = await db.taskCategory.findMany({ where: { boardId: board.id }, select: { id: true } });
  const known = new Set(existing.map((c) => c.id));
  const kept = new Set<string>();
  const ops = [];
  for (const [i, c] of parsed.data.categories.entries()) {
    if (c.id && known.has(c.id)) {
      kept.add(c.id);
      ops.push(db.taskCategory.update({ where: { id: c.id }, data: { name: c.name, colorHex: c.colorHex, order: i } }));
    } else {
      ops.push(db.taskCategory.create({ data: { boardId: board.id, name: c.name, colorHex: c.colorHex, order: i } }));
    }
  }
  const removed = existing.filter((c) => !kept.has(c.id)).map((c) => c.id);
  if (removed.length > 0) ops.push(db.taskCategory.deleteMany({ where: { id: { in: removed } } }));
  await db.$transaction(ops);

  const categories = await db.taskCategory.findMany({
    where: { boardId: board.id },
    orderBy: { order: "asc" },
    select: { id: true, name: true, colorHex: true },
  });
  await writeAudit({
    workspaceId: board.workspaceId, objectType: "Board", objectId: board.id, actorId: ctx.userId,
    action: "board.categoriesChanged", diff: { count: categories.length, removed: removed.length },
  });
  revalidate();
  return { ok: true, categories };
}

export type CreateCategoryResult = { ok: true; category: TaskCategoryItem } | { ok: false; error: string };

/** Pojedyncza nowa kategoria „w locie" — z dialogu „Nowe zadanie" i panelu zadania. */
export async function createTaskCategoryAction(formData: FormData): Promise<CreateCategoryResult> {
  const parsed = z.object({ boardId: z.string().min(1), name: z.string().trim().min(1).max(60) })
    .safeParse({ boardId: formData.get("boardId"), name: formData.get("name") });
  if (!parsed.success) return { ok: false, error: "Podaj nazwę kategorii (do 60 znaków)." };

  const board = await boardOf(parsed.data.boardId);
  if (!board) return { ok: false, error: "Tablica nie istnieje." };
  await requireWorkspaceAction(board.workspaceId, "board.update");

  // Ta sama nazwa = ta sama kategoria; nie mnożymy duplikatów przez literówkę w dialogu.
  const same = await db.taskCategory.findFirst({
    where: { boardId: board.id, name: { equals: parsed.data.name, mode: "insensitive" } },
    select: { id: true, name: true, colorHex: true },
  });
  if (same) return { ok: true, category: same };

  const [count] = await Promise.all([db.taskCategory.count({ where: { boardId: board.id } })]);
  const PALETTE = ["#FF5C00", "#2F6FE8", "#1E9E5A", "#E8A100", "#7A33EC", "#D6382C", "#0E9AA7", "#64748B"];
  const category = await db.taskCategory.create({
    data: { boardId: board.id, name: parsed.data.name, colorHex: PALETTE[count % PALETTE.length]!, order: count },
    select: { id: true, name: true, colorHex: true },
  });
  revalidate();
  return { ok: true, category };
}

export type SetCategoryResult = { ok: true } | { ok: false; error: string };

/** Przypisanie kategorii do zadania; pusty `categoryId` odpina. */
export async function setTaskCategoryAction(formData: FormData): Promise<SetCategoryResult> {
  const parsed = z.object({ taskId: z.string().min(1), categoryId: z.string().optional().or(z.literal("")) })
    .safeParse({ taskId: formData.get("taskId"), categoryId: formData.get("categoryId") ?? "" });
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe dane." };

  const task = await db.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true, workspaceId: true, boardId: true, deletedAt: true, creatorId: true, categoryId: true },
  });
  if (!task || task.deletedAt) return { ok: false, error: "Zadanie nie istnieje." };
  const ctx = await requireWorkspaceAction(task.workspaceId, "task.update");
  if (!(await canSeeTask(ctx, task.id, task.creatorId))) return { ok: false, error: "Brak dostępu do zadania." };

  let categoryId: string | null = null;
  if (parsed.data.categoryId) {
    const category = await db.taskCategory.findFirst({
      where: { id: parsed.data.categoryId, boardId: task.boardId },
      select: { id: true },
    });
    if (!category) return { ok: false, error: "Kategoria nie istnieje na tej tablicy." };
    categoryId = category.id;
  }
  if (categoryId === task.categoryId) return { ok: true };

  await db.task.update({ where: { id: task.id }, data: { categoryId, version: { increment: 1 } } });
  await writeAudit({
    workspaceId: task.workspaceId, objectType: "Task", objectId: task.id, actorId: ctx.userId,
    action: "task.category", diff: { from: task.categoryId, to: categoryId },
  });
  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
  revalidate();
  return { ok: true };
}
