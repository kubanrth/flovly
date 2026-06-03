"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

const createSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().max(500).optional().or(z.literal("")),
});

export type VacationFormState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | null;

export async function createVacationRequestAction(
  _prev: VacationFormState,
  formData: FormData,
): Promise<VacationFormState> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Niezalogowany." };

  const parsed = createSchema.safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Wypełnij obie daty." };

  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "Niepoprawny format daty." };
  }
  if (end < start) {
    return { ok: false, error: "Koniec urlopu musi być po początku." };
  }
  // Anything older than yesterday is almost certainly a typo, not a real
  // request — protect the requester from accidentally back-filing leave.
  const yesterday = new Date();
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  if (start < yesterday) {
    return { ok: false, error: "Data początku nie może być w przeszłości." };
  }

  await db.vacationRequest.create({
    data: {
      requesterId: userId,
      startDate: start,
      endDate: end,
      reason: parsed.data.reason ? parsed.data.reason.trim() : null,
    },
  });

  revalidatePath("/vacations");
  return { ok: true, message: "Wniosek wysłany — czeka na decyzję administratora." };
}

const decisionSchema = z.object({ id: z.string().min(1) });

// Approve / reject is reserved for super admins. Workspace admins don't get
// to decide because vacations are user-scoped (not tied to one workspace).
async function requireSuperAdmin(userId: string): Promise<boolean> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  return !!u?.isSuperAdmin;
}

export async function approveVacationRequestAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  if (!(await requireSuperAdmin(userId))) return;
  const parsed = decisionSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.vacationRequest.updateMany({
    where: { id: parsed.data.id, status: "pending" },
    data: { status: "approved", decidedById: userId, decidedAt: new Date() },
  });
  revalidatePath("/vacations");
}

export async function rejectVacationRequestAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  if (!(await requireSuperAdmin(userId))) return;
  const parsed = decisionSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.vacationRequest.updateMany({
    where: { id: parsed.data.id, status: "pending" },
    data: { status: "rejected", decidedById: userId, decidedAt: new Date() },
  });
  revalidatePath("/vacations");
}

// Requester cancels their own pending request.
export async function cancelVacationRequestAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = decisionSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.vacationRequest.updateMany({
    where: { id: parsed.data.id, requesterId: userId, status: "pending" },
    data: { status: "cancelled" },
  });
  revalidatePath("/vacations");
}
