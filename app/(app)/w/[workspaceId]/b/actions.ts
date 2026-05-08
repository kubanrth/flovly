"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { ViewType } from "@/lib/generated/prisma/enums";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import { parseEnabledViews, viewTypeToName } from "@/lib/board-views";

// --- Soft delete ----------------------------------------------------------

const deleteBoardSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
});

// Soft delete — flipuje deletedAt, cały content tablicy (zadania,
// kolumny, linki, whiteboard, views, subtasks, poll, reminder-y)
// znika z UI ale zostaje w DB na wypadek recovery. Ostatnia tablica
// workspace'u też może być usunięta — user może mieć pusty workspace.
export async function deleteBoardAction(formData: FormData) {
  const parsed = deleteBoardSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
  });
  if (!parsed.success) return;

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "board.delete");

  // Ownership guard: board must belong to the declared workspace.
  const board = await db.board.findFirst({
    where: {
      id: parsed.data.boardId,
      workspaceId: parsed.data.workspaceId,
      deletedAt: null,
    },
    select: { id: true, name: true },
  });
  if (!board) return;

  await db.board.update({
    where: { id: board.id },
    data: { deletedAt: new Date() },
  });

  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Board",
    objectId: board.id,
    actorId: ctx.userId,
    action: "board.deleted",
    diff: { name: board.name },
  });

  revalidatePath(`/w/${parsed.data.workspaceId}`);
  revalidatePath("/workspaces");
  // Redirect to overview — the board page we may have been on no longer
  // exists from the user's perspective.
  redirect(`/w/${parsed.data.workspaceId}`);
}

const createBoardSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1, "Nazwa jest wymagana").max(80),
  description: z.string().trim().max(280).optional(),
});

export type CreateBoardState =
  | { ok: true; boardId: string }
  | { ok: false; error?: string; fieldErrors?: { name?: string; description?: string } }
  | null;

// Seeds the new board with the same status columns as the default board
// and BoardView rows matching workspace.enabledViews (minus WHITEBOARD,
// which lives in ProcessCanvas and is created on-demand).
export async function createBoardAction(
  _prev: CreateBoardState,
  formData: FormData,
): Promise<CreateBoardState> {
  const parsed = createBoardSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    const fe: { name?: string; description?: string } = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "name" || k === "description") fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "board.create");

  const ws = await db.workspace.findUnique({
    where: { id: parsed.data.workspaceId },
    select: { enabledViews: true },
  });
  if (!ws) return { ok: false, error: "Workspace nie istnieje." };

  // F9-04: pick up user-selected view types from the checkbox group.
  // Must be a subset of workspace.enabledViews — illegal values are
  // stripped silently (we won't block submit on a mismatched box).
  const workspaceEnabled = new Set(
    parseEnabledViews(ws.enabledViews).map((v) => v.toUpperCase()),
  );
  const raw = formData.getAll("enabledViews").map(String);
  const rawFiltered = raw.filter((v) => workspaceEnabled.has(v));
  const selectedTypes: ViewType[] =
    rawFiltered.length > 0
      ? (rawFiltered as ViewType[])
      : // No boxes ticked (e.g. programmatic call) → match workspace default.
        (Array.from(workspaceEnabled) as ViewType[]);

  const board = await db.board.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      creatorId: ctx.userId,
      statusColumns: {
        create: [
          { name: "Do zrobienia", colorHex: "#64748B", order: 0 },
          { name: "W trakcie", colorHex: "#F59E0B", order: 1 },
          { name: "Testy", colorHex: "#3B82F6", order: 2 },
          { name: "Done", colorHex: "#10B981", order: 3 },
        ],
      },
      views: {
        // Seed one BoardView row per selected type — even WHITEBOARD,
        // which usually uses ProcessCanvas but needs a BoardView marker
        // so ViewSwitcher knows the view is enabled for this board.
        create: selectedTypes.map((type) => ({ type })),
      },
    },
  });

  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Board",
    objectId: board.id,
    actorId: ctx.userId,
    action: "board.created",
    diff: { name: board.name },
  });

  revalidatePath(`/w/${parsed.data.workspaceId}`);
  revalidatePath("/workspaces");
  // Pick a landing view. Table if enabled (best default), otherwise the
  // first selected non-whiteboard type, otherwise fall through to table.
  const preferredOrder: ViewType[] = [
    ViewType.TABLE,
    ViewType.KANBAN,
    ViewType.ROADMAP,
    ViewType.GANTT,
    ViewType.WHITEBOARD,
  ];
  const firstType =
    preferredOrder.find((t) => selectedTypes.includes(t)) ?? ViewType.TABLE;
  const firstView = viewTypeToName(firstType) ?? "table";
  redirect(`/w/${parsed.data.workspaceId}/b/${board.id}/${firstView}`);
}

// F12-K52: drag-and-drop reorder tablic. Klient wysyła nową kolejność
// ID. Wymaga task.update permission (ADMIN/MEMBER, nie VIEWER).
export async function reorderBoardsAction(workspaceId: string, orderedIds: string[]) {
  if (!workspaceId || !Array.isArray(orderedIds) || orderedIds.length === 0) return;

  const ctx = await requireWorkspaceAction(workspaceId, "task.update");

  // Sprawdź że wszystkie ID są w tym workspace
  const valid = await db.board.findMany({
    where: { id: { in: orderedIds }, workspaceId, deletedAt: null },
    select: { id: true },
  });
  const validIds = new Set(valid.map((b) => b.id));
  const filtered = orderedIds.filter((id) => validIds.has(id));

  await db.$transaction(
    filtered.map((id, idx) =>
      db.board.update({
        where: { id },
        data: { order: (idx + 1) * 1000 },
      }),
    ),
  );

  await writeAudit({
    workspaceId,
    objectType: "Workspace",
    objectId: workspaceId,
    actorId: ctx.userId,
    action: "boards.reordered",
  });

  revalidatePath(`/w/${workspaceId}`);
}
