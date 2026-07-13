"use server";

// F12-K132: server actions dla team password vault. Każda mutacja
// require'uje workspace membership (dowolna rola — vault jest workspace-
// wide). Odczyt (list) = SSR w page.tsx. Reveal = wydzielona action bo
// nie chcemy w SSR pobierać plaintext'u dla całej listy — user musi
// kliknąć "Pokaż" per-item.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { encrypt, decrypt } from "@/lib/vault-crypto";

const createSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(60).optional(),
  url: z.string().trim().max(500).optional(),
  username: z.string().trim().max(200).optional(),
  password: z.string().min(1).max(4000),
  notes: z.string().max(8000).optional(),
});

export type CreateSecretState =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: { name?: string; password?: string } }
  | null;

export async function createSecretAction(
  _prev: CreateSecretState,
  formData: FormData,
): Promise<CreateSecretState> {
  const parsed = createSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    url: formData.get("url") || undefined,
    username: formData.get("username") || undefined,
    password: formData.get("password"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    const fe: { name?: string; password?: string } = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "name" || k === "password") fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceMembership(parsed.data.workspaceId);

  try {
    const pwd = encrypt(parsed.data.password);
    const notesEnc = parsed.data.notes ? encrypt(parsed.data.notes) : null;

    const item = await db.secretItem.create({
      data: {
        workspaceId: parsed.data.workspaceId,
        ownerId: ctx.userId,
        name: parsed.data.name,
        category: parsed.data.category || null,
        url: parsed.data.url || null,
        username: parsed.data.username || null,
        passwordEnc: pwd.enc,
        passwordIv: pwd.iv,
        notesEnc: notesEnc?.enc ?? null,
        notesIv: notesEnc?.iv ?? null,
      },
      select: { id: true },
    });

    revalidatePath(`/w/${parsed.data.workspaceId}/passwords`);
    return { ok: true, id: item.id };
  } catch (e) {
    console.error("[createSecretAction] failed:", e);
    return {
      ok: false,
      error: "Nie udało się zapisać. Sprawdź konfigurację VAULT_KEY.",
    };
  }
}

const revealSchema = z.object({
  id: z.string().min(1),
});

export async function revealSecretAction(input: {
  id: string;
}): Promise<
  | { ok: true; password: string; notes: string | null }
  | { ok: false; error: string }
> {
  const parsed = revealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };

  const item = await db.secretItem.findFirst({
    where: { id: parsed.data.id, deletedAt: null },
    select: {
      workspaceId: true,
      passwordEnc: true,
      passwordIv: true,
      notesEnc: true,
      notesIv: true,
    },
  });
  if (!item) return { ok: false, error: "Nie znaleziono." };

  await requireWorkspaceMembership(item.workspaceId);

  try {
    const password = decrypt(item.passwordEnc, item.passwordIv);
    const notes =
      item.notesEnc && item.notesIv ? decrypt(item.notesEnc, item.notesIv) : null;
    return { ok: true, password, notes };
  } catch (e) {
    console.error("[revealSecretAction] decrypt failed:", e);
    return { ok: false, error: "Nie udało się odszyfrować." };
  }
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function deleteSecretAction(formData: FormData) {
  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const item = await db.secretItem.findUnique({
    where: { id: parsed.data.id },
    select: { workspaceId: true, deletedAt: true },
  });
  if (!item || item.deletedAt) return;

  await requireWorkspaceMembership(item.workspaceId);

  await db.secretItem.update({
    where: { id: parsed.data.id },
    data: { deletedAt: new Date() },
  });

  revalidatePath(`/w/${item.workspaceId}/passwords`);
}
