"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { ViewType } from "@/lib/generated/prisma/enums";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import { parseEnabledViews, viewTypeToName } from "@/lib/board-views";

const deleteBoardSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
});

// Soft-delete flips deletedAt — board content is hidden from UI but stays in DB
// for recovery. A workspace may be emptied of all boards.
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

// Seeds the new board with default status columns and BoardView rows matching
// workspace.enabledViews.
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

  // Selected view types must be a subset of workspace.enabledViews; illegal values silently stripped.
  const workspaceEnabled = new Set(
    parseEnabledViews(ws.enabledViews).map((v) => v.toUpperCase()),
  );
  const raw = formData.getAll("enabledViews").map(String);
  const rawFiltered = raw.filter((v) => workspaceEnabled.has(v));
  const selectedTypes: ViewType[] =
    rawFiltered.length > 0
      ? (rawFiltered as ViewType[])
      : // No boxes ticked → match workspace default.
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
        // One BoardView per selected type — even WHITEBOARD needs a marker
        // row so ViewSwitcher knows the view is enabled.
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
  // Landing view: prefer Table, then first selected type, fall through to Table.
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

// Drag-and-drop board reorder. Requires task.update (ADMIN/MEMBER, not VIEWER).
export async function reorderBoardsAction(workspaceId: string, orderedIds: string[]) {
  if (!workspaceId || !Array.isArray(orderedIds) || orderedIds.length === 0) return;

  const ctx = await requireWorkspaceAction(workspaceId, "task.update");

  // Validate all IDs belong to this workspace.
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

  // Layout-level revalidate — sidebar shows boards too, not just the overview page.
  revalidatePath("/", "layout");
}
