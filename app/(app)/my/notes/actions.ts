"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";

// Private per-user Notes (Apple-Notes parity). Intentionally single-player —
// every action scopes by session user.
async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

// --- Folders ---

const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function createNoteFolderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = createFolderSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return;

  const last = await db.noteFolder.findFirst({
    where: { userId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await db.noteFolder.create({
    data: {
      userId,
      name: parsed.data.name,
      order: (last?.order ?? 0) + 1,
    },
  });
  revalidatePath("/my/notes");
}

const deleteFolderSchema = z.object({ id: z.string().min(1) });

export async function deleteNoteFolderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = deleteFolderSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.noteFolder.deleteMany({ where: { id: parsed.data.id, userId } });
  revalidatePath("/my/notes");
}

const renameFolderSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
});

export async function renameNoteFolderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = renameFolderSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;
  await db.noteFolder.updateMany({
    where: { id: parsed.data.id, userId },
    data: { name: parsed.data.name },
  });
  revalidatePath("/my/notes");
}

// --- Notes ---

const createNoteSchema = z.object({
  folderId: z.string().optional().or(z.literal("")),
});

export async function createNoteAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = createNoteSchema.safeParse({
    folderId: formData.get("folderId") ?? "",
  });
  if (!parsed.success) return;

  let folderId: string | null = null;
  if (parsed.data.folderId) {
    const f = await db.noteFolder.findFirst({
      where: { id: parsed.data.folderId, userId },
      select: { id: true },
    });
    if (f) folderId = f.id;
  }

  const note = await db.note.create({
    data: { userId, folderId, title: "Nowa notatka" },
  });
  redirect(`/my/notes?noteId=${note.id}`);
}

const updateNoteSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200).optional(),
  content: z.string().max(50_000).optional(),
  // Tiptap JSON for rich text. Plain `content` is a search-friendly snippet derived on save.
  contentJson: z.string().max(100_000).optional().or(z.literal("")),
});

export async function updateNoteAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = updateNoteSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title") ?? undefined,
    content: formData.get("content") ?? undefined,
    contentJson: formData.get("contentJson") ?? undefined,
  });
  if (!parsed.success) return;
  const data: Prisma.NoteUncheckedUpdateManyInput = {};
  if (typeof parsed.data.title === "string") data.title = parsed.data.title;
  if (typeof parsed.data.content === "string") data.content = parsed.data.content;
  if (parsed.data.contentJson !== undefined && parsed.data.contentJson !== "") {
    try {
      const parsedDoc = JSON.parse(parsed.data.contentJson);
      if (parsedDoc && typeof parsedDoc === "object") {
        data.contentJson = parsedDoc as Prisma.InputJsonValue;
        // Plain text snippet for search + list preview.
        const plain = extractPlainText(parsedDoc).slice(0, 50_000);
        data.content = plain;
      }
    } catch {
      /* malformed JSON — skip */
    }
  }
  if (Object.keys(data).length === 0) return;
  await db.note.updateMany({
    where: { id: parsed.data.id, userId },
    data,
  });
  revalidatePath("/my/notes");
}

/**
 * Walks a Tiptap doc collecting `text` leaves into a single string.
 * Inserts whitespace between block-level nodes so the snippet stays readable.
 */
function extractPlainText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (typeof n.text === "string") return n.text;
  const blockTypes = new Set([
    "paragraph", "heading", "blockquote", "listItem", "codeBlock", "bulletList", "orderedList",
  ]);
  let out = "";
  if (Array.isArray(n.content)) {
    for (const child of n.content) {
      out += extractPlainText(child);
      if (n.type && blockTypes.has(n.type)) out += " ";
    }
  }
  return out;
}

const moveNoteSchema = z.object({
  id: z.string().min(1),
  folderId: z.string().optional().or(z.literal("")),
});

export async function moveNoteAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = moveNoteSchema.safeParse({
    id: formData.get("id"),
    folderId: formData.get("folderId") ?? "",
  });
  if (!parsed.success) return;

  let folderId: string | null = null;
  if (parsed.data.folderId) {
    const f = await db.noteFolder.findFirst({
      where: { id: parsed.data.folderId, userId },
      select: { id: true },
    });
    if (f) folderId = f.id;
  }
  await db.note.updateMany({
    where: { id: parsed.data.id, userId },
    data: { folderId },
  });
  revalidatePath("/my/notes");
}

const deleteNoteSchema = z.object({ id: z.string().min(1) });

// Soft-delete moves note to Trash (iOS Notes parity); permanent delete via
// emptyTrashAction or permanentDeleteNoteAction.
export async function deleteNoteAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = deleteNoteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.note.updateMany({
    where: { id: parsed.data.id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/my/notes");
}

export async function restoreNoteAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = deleteNoteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.note.updateMany({
    where: { id: parsed.data.id, userId },
    data: { deletedAt: null },
  });
  revalidatePath("/my/notes");
}

export async function permanentDeleteNoteAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = deleteNoteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.note.deleteMany({
    where: { id: parsed.data.id, userId, deletedAt: { not: null } },
  });
  revalidatePath("/my/notes");
}

export async function emptyTrashAction() {
  const userId = await currentUserId();
  if (!userId) return;
  await db.note.deleteMany({
    where: { userId, deletedAt: { not: null } },
  });
  revalidatePath("/my/notes");
}

const togglePinSchema = z.object({
  id: z.string().min(1),
  next: z.enum(["true", "false"]),
});

export async function togglePinNoteAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = togglePinSchema.safeParse({
    id: formData.get("id"),
    next: formData.get("next"),
  });
  if (!parsed.success) return;
  await db.note.updateMany({
    where: { id: parsed.data.id, userId },
    data: { pinned: parsed.data.next === "true" },
  });
  revalidatePath("/my/notes");
}
