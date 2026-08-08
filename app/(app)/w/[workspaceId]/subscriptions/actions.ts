"use server";

// F12-K140: server actions modułu subskrypcji. Każdy członek workspace'u
// może edytować (prosty "Excel" firmowy — bez per-role gate'a, mirror
// password vault).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";

const CYCLES = ["MONTHLY", "YEARLY"] as const;

const createSchema = z.object({
  workspaceId: z.string().min(1),
});

// Create = pusty wiersz od razu w tabeli (Excel-style: dodajesz wiersz,
// wypełniasz inline). Zwraca id żeby klient mógł focus'ować input.
export async function createSubscriptionAction(formData: FormData): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const parsed = createSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
  });
  if (!parsed.success) return { ok: false, error: "Bad request." };

  await requireWorkspaceMembership(parsed.data.workspaceId);

  const row = await db.subscription.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      name: "",
    },
    select: { id: true },
  });

  revalidatePath(`/w/${parsed.data.workspaceId}/subscriptions`);
  return { ok: true, id: row.id };
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(200).optional(),
  url: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  // Kwota przychodzi jako string PLN ("129,99" / "129.99") — parse do groszy.
  amountPln: z.string().max(20).optional(),
  cycle: z.enum(CYCLES).optional(),
});

export async function patchSubscriptionAction(formData: FormData) {
  const parsed = patchSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") ?? undefined,
    url: formData.get("url") ?? undefined,
    notes: formData.get("notes") ?? undefined,
    amountPln: formData.get("amountPln") ?? undefined,
    cycle: formData.get("cycle") ?? undefined,
  });
  if (!parsed.success) return;

  const row = await db.subscription.findUnique({
    where: { id: parsed.data.id },
    select: { workspaceId: true, deletedAt: true },
  });
  if (!row || row.deletedAt) return;

  await requireWorkspaceMembership(row.workspaceId);

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.url !== undefined) data.url = parsed.data.url.trim() || null;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes.trim() || null;
  if (parsed.data.cycle !== undefined) data.cycle = parsed.data.cycle;
  if (parsed.data.amountPln !== undefined) {
    const n = Number(parsed.data.amountPln.trim().replace(",", ".").replace(/\s/g, ""));
    if (Number.isFinite(n) && n >= 0 && n <= 10_000_000) {
      data.amountCents = Math.round(n * 100);
    }
  }
  if (Object.keys(data).length === 0) return;

  await db.subscription.update({ where: { id: parsed.data.id }, data });
  revalidatePath(`/w/${row.workspaceId}/subscriptions`);
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function deleteSubscriptionAction(formData: FormData) {
  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const row = await db.subscription.findUnique({
    where: { id: parsed.data.id },
    select: { workspaceId: true, deletedAt: true },
  });
  if (!row || row.deletedAt) return;

  await requireWorkspaceMembership(row.workspaceId);

  await db.subscription.update({
    where: { id: parsed.data.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/w/${row.workspaceId}/subscriptions`);
}
