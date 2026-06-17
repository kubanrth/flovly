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
  ViewType.TASKLINE,
];

// Parses enabledViews[] multi-checkbox into ViewType enum values.
// Falls back to all five when nothing is ticked — empty selection isn't useful.
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
  // WHITEBOARD i TASKLINE używają ProcessCanvas (auto-created on first visit);
  // reszta widoków potrzebuje seed BoardView rows żeby background customization
  // miał wiersz do update'u.
  const seedBoardViews = enabledViews.filter(
    (t) => t !== ViewType.WHITEBOARD && t !== ViewType.TASKLINE,
  );

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
      // Auto-create "O projekcie" wiki page so the feature is discoverable.
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

// Inline rename from workspace overview heading. Single field, no error UI —
// fire-and-forget with client-side optimistic UI. Kept separate from
// updateWorkspaceAction to avoid bloating the settings-form response shape.
export async function renameWorkspaceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const rawName = String(formData.get("name") ?? "").trim();
  if (!id || !rawName) return;
  // Mirror updateWorkspaceSchema constraint: 1-80 chars.
  const name = rawName.slice(0, 80);
  if (name.length < 1) return;

  const ctx = await requireWorkspaceAction(id, "workspace.updateSettings");

  const workspace = await db.workspace.update({
    where: { id },
    data: { name },
  });
  await writeAudit({
    workspaceId: workspace.id,
    objectType: "Workspace",
    objectId: workspace.id,
    actorId: ctx.userId,
    action: "workspace.renamed",
    diff: { name: workspace.name },
  });
  revalidatePath("/", "layout");
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

// Drag-and-drop workspace reorder. Client posts the full ordered ID list;
// server writes order = idx * 1000. No re-ordering races on concurrent drags.
export async function reorderWorkspacesAction(orderedIds: string[]) {
  const session = await auth();
  if (!session?.user) return;
  const userId = session.user.id;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;

  // Authorize: only IDs user can access — no reordering other people's workspaces.
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

  await db.$transaction(
    valid.map((id, idx) =>
      db.workspace.update({
        where: { id },
        data: { order: (idx + 1) * 1000 },
      }),
    ),
  );

  // Layout-level revalidate — sidebar reads workspaces from (app)/layout.tsx.
  revalidatePath("/", "layout");
}
