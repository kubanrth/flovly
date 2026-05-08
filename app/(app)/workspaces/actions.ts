"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role, ViewType } from "@/lib/generated/prisma/enums";
import {
  createWorkspaceSchema,
  deleteWorkspaceSchema,
  slugify,
  updateWorkspaceSchema,
} from "@/lib/schemas/workspace";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

type FieldErrors = { name?: string; description?: string; confirmName?: string };

export type WorkspaceFormState =
  | { ok: true; workspaceId: string; slug: string }
  | { ok: false; error?: string; fieldErrors?: FieldErrors }
  | null;

// Ensure unique slug by appending `-2`, `-3`, ... until available.
async function uniqueSlug(base: string): Promise<string> {
  const root = base || "workspace";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const existing = await db.workspace.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  return `${root}-${Date.now()}`;
}

const ALL_VIEW_TYPES: ViewType[] = [
  ViewType.TABLE,
  ViewType.KANBAN,
  ViewType.ROADMAP,
  ViewType.GANTT,
  ViewType.WHITEBOARD,
];

// Parse the `enabledViews[]` multi-checkbox from FormData into a safe list
// of ViewType enum values. Falls back to all five when the user hits
// submit without any boxes ticked — "no views at all" isn't a useful state.
function parseSelectedViews(fd: FormData): ViewType[] {
  const raw = fd.getAll("enabledViews").map(String);
  const set = new Set<ViewType>();
  for (const v of raw) {
    const up = v.toUpperCase();
    if ((ALL_VIEW_TYPES as string[]).includes(up)) set.add(up as ViewType);
  }
  return set.size > 0 ? Array.from(set) : ALL_VIEW_TYPES;
}

export async function createWorkspaceAction(
  _prev: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");

  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "name" || k === "description") fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const slug = await uniqueSlug(slugify(parsed.data.name));
  const enabledViews = parseSelectedViews(formData);
  // ViewType.WHITEBOARD doesn't need a BoardView row (canvas is per-board
  // ProcessCanvas, auto-created on first visit). The other four get seed
  // BoardView rows so background customization has a row to update.
  const seedBoardViews = enabledViews.filter((t) => t !== ViewType.WHITEBOARD);

  const workspace = await db.workspace.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      slug,
      ownerId: session.user.id,
      enabledViews,
      memberships: {
        create: { userId: session.user.id, role: Role.ADMIN },
      },
      boards: {
        create: {
          name: "Pierwsza tablica",
          description: "Domyślna tablica utworzona razem z przestrzenią.",
          creatorId: session.user.id,
          statusColumns: {
            create: [
              { name: "Do zrobienia", colorHex: "#64748B", order: 0 },
              { name: "W trakcie", colorHex: "#F59E0B", order: 1 },
              { name: "Testy", colorHex: "#3B82F6", order: 2 },
              { name: "Done", colorHex: "#10B981", order: 3 },
            ],
          },
          views: {
            create: seedBoardViews.map((type) => ({ type })),
          },
        },
      },
      // Auto-created Wiki page so every workspace ships with the "O projekcie"
      // landing doc and nobody has to know the feature exists to use it.
      wikiPage: {
        create: {
          title: "O projekcie",
          contentJson: {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 1 },
                content: [{ type: "text", text: parsed.data.name }],
              },
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text:
                      parsed.data.description ||
                      "Opisz tutaj cel projektu, kluczowych ludzi, kamienie milowe i wszystko, co powinno być pod ręką.",
                  },
                ],
              },
            ],
          },
          updatedById: session.user.id,
        },
      },
    },
  });

  await writeAudit({
    workspaceId: workspace.id,
    objectType: "Workspace",
    objectId: workspace.id,
    actorId: session.user.id,
    action: "workspace.created",
    diff: { name: workspace.name, slug: workspace.slug, enabledViews },
  });

  revalidatePath("/workspaces");
  redirect(`/w/${workspace.id}`);
}

export async function updateWorkspaceAction(
  _prev: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const parsed = updateWorkspaceSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "name" || k === "description") fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceAction(parsed.data.id, "workspace.updateSettings");

  const workspace = await db.workspace.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
    },
  });

  await writeAudit({
    workspaceId: workspace.id,
    objectType: "Workspace",
    objectId: workspace.id,
    actorId: ctx.userId,
    action: "workspace.updated",
    diff: { name: workspace.name },
  });

  revalidatePath(`/w/${workspace.id}/settings`);
  revalidatePath("/workspaces");
  return { ok: true, workspaceId: workspace.id, slug: workspace.slug };
}

export async function deleteWorkspaceAction(
  _prev: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const parsed = deleteWorkspaceSchema.safeParse({
    id: formData.get("id"),
    confirmName: formData.get("confirmName"),
  });

  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "confirmName") fe.confirmName = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceAction(parsed.data.id, "workspace.delete");

  const workspace = await db.workspace.findUnique({ where: { id: parsed.data.id } });
  if (!workspace) return { ok: false, error: "Workspace nie istnieje." };

  if (parsed.data.confirmName.trim() !== workspace.name) {
    return {
      ok: false,
      fieldErrors: { confirmName: "Wpisz dokładną nazwę workspace'u aby potwierdzić." },
    };
  }

  await db.workspace.update({
    where: { id: workspace.id },
    data: { deletedAt: new Date() },
  });

  await writeAudit({
    workspaceId: workspace.id,
    objectType: "Workspace",
    objectId: workspace.id,
    actorId: ctx.userId,
    action: "workspace.deleted",
    diff: { name: workspace.name },
  });

  revalidatePath("/workspaces");
  redirect("/workspaces");
}

// F12-K52: reorder workspace'ów drag-and-drop.
// Klient wysyła całą nową listę ID w kolejności (po drop'ie) — server
// zapisuje order = idx * 1000 dla każdego. Prosta logika, brak ryzyka
// rozjeżdżania się gdy wiele drag'ów na raz.
export async function reorderWorkspacesAction(orderedIds: string[]) {
  const session = await auth();
  if (!session?.user) return;
  const userId = session.user.id;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;

  // Sprawdź że user ma dostęp do każdego workspace'u na liście
  // (nie pozwalamy reorderować cudzych przestrzeni).
  const accessible = await db.workspace.findMany({
    where: {
      id: { in: orderedIds },
      deletedAt: null,
      OR: [
        { ownerId: userId },
        { memberships: { some: { userId } } },
      ],
    },
    select: { id: true },
  });
  const accessibleIds = new Set(accessible.map((w) => w.id));
  const valid = orderedIds.filter((id) => accessibleIds.has(id));

  // Update order'ów w transakcji
  await db.$transaction(
    valid.map((id, idx) =>
      db.workspace.update({
        where: { id },
        data: { order: (idx + 1) * 1000 },
      }),
    ),
  );

  revalidatePath("/workspaces");
}
