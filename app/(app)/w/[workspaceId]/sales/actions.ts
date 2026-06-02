"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import {
  dealFieldsSchema,
  dealStageFieldsSchema,
  DEFAULT_DEAL_STAGES,
} from "@/lib/schemas/deal";

type DealFieldErrors = Partial<Record<
  | "title"
  | "valueAmount"
  | "valueCurrency"
  | "expectedCloseAt"
  | "stageId"
  | "ownerId"
  | "contactId"
  | "_form",
  string
>>;

export type DealFormState =
  | { ok: true; dealId: string; message: string }
  | { ok: false; error?: string; fieldErrors?: DealFieldErrors }
  | null;

// Lazy-seeds default DealStage rows on first /sales access. Idempotent — runs
// inside a transaction with a count check, so concurrent calls don't double-
// insert (only the first one to acquire the row creates the defaults).
export async function ensureDefaultStages(workspaceId: string): Promise<void> {
  const existing = await db.dealStage.count({
    where: { workspaceId, deletedAt: null },
  });
  if (existing > 0) return;

  await db.dealStage.createMany({
    data: DEFAULT_DEAL_STAGES.map((s, idx) => ({
      workspaceId,
      name: s.name,
      colorHex: s.colorHex,
      order: idx,
      closedKind: s.closedKind,
    })),
  });
}

function parseDealFormData(fd: FormData) {
  const get = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return {
    title: get("title") ?? "",
    valueAmount: get("valueAmount") ?? "",
    valueCurrency: get("valueCurrency") ?? "",
    expectedCloseAt: get("expectedCloseAt") ?? "",
    stageId: get("stageId") ?? "",
    ownerId: get("ownerId") ?? "",
    contactId: get("contactId") ?? "",
  };
}

// Notes come from RichTextEditor as a hidden-input JSON string. Empty / unparseable
// values clear the column (Prisma.JsonNull).
function parseNotesField(fd: FormData): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  const raw = fd.get("notesJson");
  if (typeof raw !== "string" || raw.length === 0) return Prisma.JsonNull;
  try {
    return JSON.parse(raw) as Prisma.InputJsonValue;
  } catch {
    return Prisma.JsonNull;
  }
}

function nullIfEmpty(v: string | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

// New deals slot to the BOTTOM of their stage column (max rowOrder + 1).
async function nextRowOrder(stageId: string): Promise<number> {
  const max = await db.deal.aggregate({
    where: { stageId, deletedAt: null },
    _max: { rowOrder: true },
  });
  return (max._max.rowOrder ?? 0) + 1;
}

export async function createDealAction(
  workspaceId: string,
  _prev: DealFormState,
  formData: FormData,
): Promise<DealFormState> {
  const parsed = dealFieldsSchema.safeParse(parseDealFormData(formData));
  if (!parsed.success) {
    const fe: DealFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (typeof k === "string") (fe as Record<string, string>)[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  // Guard stage: must live in this workspace.
  const stage = await db.dealStage.findFirst({
    where: { id: parsed.data.stageId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!stage) return { ok: false, fieldErrors: { stageId: "Etap nie istnieje." } };

  const ctx = await requireWorkspaceAction(workspaceId, "deal.create");

  // Guard owner: workspace member.
  let ownerId: string | null = null;
  if (parsed.data.ownerId && parsed.data.ownerId.length > 0) {
    const m = await db.workspaceMembership.findFirst({
      where: { workspaceId, userId: parsed.data.ownerId },
      select: { userId: true },
    });
    if (m) ownerId = m.userId;
  }

  // Guard contact: same workspace + not soft-deleted.
  let contactId: string | null = null;
  if (parsed.data.contactId && parsed.data.contactId.length > 0) {
    const c = await db.contact.findFirst({
      where: { id: parsed.data.contactId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (c) contactId = c.id;
  }

  const deal = await db.deal.create({
    data: {
      workspaceId,
      creatorId: ctx.userId,
      ownerId,
      stageId: stage.id,
      contactId,
      title: parsed.data.title,
      valueAmount: parsed.data.valueAmount,
      valueCurrency: parsed.data.valueCurrency,
      expectedCloseAt: parsed.data.expectedCloseAt,
      notesJson: parseNotesField(formData),
      rowOrder: await nextRowOrder(stage.id),
    },
  });

  await writeAudit({
    workspaceId,
    objectType: "Deal",
    objectId: deal.id,
    actorId: ctx.userId,
    action: "deal.created",
    diff: { title: deal.title, stageId: stage.id },
  });

  revalidatePath(`/w/${workspaceId}/sales`);
  redirect(`/w/${workspaceId}/sales/${deal.id}`);
}

export async function updateDealAction(
  workspaceId: string,
  dealId: string,
  _prev: DealFormState,
  formData: FormData,
): Promise<DealFormState> {
  const parsed = dealFieldsSchema.safeParse(parseDealFormData(formData));
  if (!parsed.success) {
    const fe: DealFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (typeof k === "string") (fe as Record<string, string>)[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const existing = await db.deal.findUnique({
    where: { id: dealId },
    select: { id: true, workspaceId: true, deletedAt: true, stageId: true },
  });
  if (!existing || existing.workspaceId !== workspaceId || existing.deletedAt) {
    return { ok: false, error: "Deal nie istnieje albo został usunięty." };
  }

  const ctx = await requireWorkspaceAction(workspaceId, "deal.update");

  const stage = await db.dealStage.findFirst({
    where: { id: parsed.data.stageId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!stage) return { ok: false, fieldErrors: { stageId: "Etap nie istnieje." } };

  let ownerId: string | null = null;
  if (parsed.data.ownerId && parsed.data.ownerId.length > 0) {
    const m = await db.workspaceMembership.findFirst({
      where: { workspaceId, userId: parsed.data.ownerId },
      select: { userId: true },
    });
    if (m) ownerId = m.userId;
  }

  let contactId: string | null = null;
  if (parsed.data.contactId && parsed.data.contactId.length > 0) {
    const c = await db.contact.findFirst({
      where: { id: parsed.data.contactId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (c) contactId = c.id;
  }

  // Stage moved via form (not drag-drop) → slot to bottom of the new column.
  const movedToNewStage = stage.id !== existing.stageId;
  const data: Prisma.DealUpdateInput = {
    title: parsed.data.title,
    valueAmount: parsed.data.valueAmount,
    valueCurrency: parsed.data.valueCurrency,
    expectedCloseAt: parsed.data.expectedCloseAt,
    notesJson: parseNotesField(formData),
    owner: ownerId ? { connect: { id: ownerId } } : { disconnect: true },
    contact: contactId ? { connect: { id: contactId } } : { disconnect: true },
    stage: { connect: { id: stage.id } },
  };
  if (movedToNewStage) {
    data.rowOrder = await nextRowOrder(stage.id);
  }

  await db.deal.update({
    where: { id: dealId },
    data,
  });

  await writeAudit({
    workspaceId,
    objectType: "Deal",
    objectId: dealId,
    actorId: ctx.userId,
    action: "deal.updated",
    diff: { stageId: stage.id, title: parsed.data.title },
  });

  revalidatePath(`/w/${workspaceId}/sales`);
  revalidatePath(`/w/${workspaceId}/sales/${dealId}`);
  return { ok: true, dealId, message: "Zapisano." };
}

export async function deleteDealAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const dealId = String(formData.get("dealId") ?? "");
  if (!workspaceId || !dealId) return;

  const existing = await db.deal.findUnique({
    where: { id: dealId },
    select: { workspaceId: true, deletedAt: true },
  });
  if (!existing || existing.workspaceId !== workspaceId || existing.deletedAt) return;

  const ctx = await requireWorkspaceAction(workspaceId, "deal.delete");

  await db.deal.update({
    where: { id: dealId },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    workspaceId,
    objectType: "Deal",
    objectId: dealId,
    actorId: ctx.userId,
    action: "deal.deleted",
  });

  revalidatePath(`/w/${workspaceId}/sales`);
  redirect(`/w/${workspaceId}/sales`);
}

// Drag-drop: client sends destination stageId + a new rowOrder computed from
// the neighbors (avg between prev/next, or +1 at the end). Server validates
// + writes — no reorder math here so concurrent drags don't fight.
export async function moveDealAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const dealId = String(formData.get("dealId") ?? "");
  const stageId = String(formData.get("stageId") ?? "");
  const rowOrderRaw = String(formData.get("rowOrder") ?? "");
  const rowOrder = Number(rowOrderRaw);
  if (!workspaceId || !dealId || !stageId || !Number.isFinite(rowOrder)) return;

  const [deal, stage] = await Promise.all([
    db.deal.findUnique({
      where: { id: dealId },
      select: { workspaceId: true, deletedAt: true, stageId: true },
    }),
    db.dealStage.findUnique({
      where: { id: stageId },
      select: { workspaceId: true, deletedAt: true },
    }),
  ]);
  if (!deal || deal.workspaceId !== workspaceId || deal.deletedAt) return;
  if (!stage || stage.workspaceId !== workspaceId || stage.deletedAt) return;

  const ctx = await requireWorkspaceAction(workspaceId, "deal.update");

  await db.deal.update({
    where: { id: dealId },
    data: { stageId, rowOrder },
  });

  // Only audit when the column actually changed; pure intra-column reorder is noise.
  if (deal.stageId !== stageId) {
    await writeAudit({
      workspaceId,
      objectType: "Deal",
      objectId: dealId,
      actorId: ctx.userId,
      action: "deal.stageMoved",
      diff: { from: deal.stageId, to: stageId },
    });
  }

  revalidatePath(`/w/${workspaceId}/sales`);
}

// ─── Stage management ───────────────────────────────────────────────────────

type StageFieldErrors = Partial<Record<"name" | "colorHex" | "closedKind", string>>;

export type StageFormState =
  | { ok: true; stageId: string }
  | { ok: false; error?: string; fieldErrors?: StageFieldErrors }
  | null;

function parseStageFormData(fd: FormData) {
  const get = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return {
    name: get("name") ?? "",
    colorHex: get("colorHex") ?? "#7B68EE",
    closedKind: get("closedKind") ?? "",
  };
}

export async function createDealStageAction(formData: FormData): Promise<StageFormState> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  if (!workspaceId) return { ok: false, error: "Brak workspace." };

  const parsed = dealStageFieldsSchema.safeParse(parseStageFormData(formData));
  if (!parsed.success) {
    const fe: StageFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (typeof k === "string") (fe as Record<string, string>)[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceAction(workspaceId, "dealStage.manage");

  // New stages append to the right (max order + 1).
  const max = await db.dealStage.aggregate({
    where: { workspaceId },
    _max: { order: true },
  });
  const stage = await db.dealStage.create({
    data: {
      workspaceId,
      name: parsed.data.name,
      colorHex: parsed.data.colorHex,
      closedKind: parsed.data.closedKind,
      order: (max._max.order ?? -1) + 1,
    },
  });

  await writeAudit({
    workspaceId,
    objectType: "DealStage",
    objectId: stage.id,
    actorId: ctx.userId,
    action: "dealStage.created",
    diff: { name: stage.name, closedKind: stage.closedKind },
  });
  revalidatePath(`/w/${workspaceId}/sales`);
  return { ok: true, stageId: stage.id };
}

export async function updateDealStageAction(formData: FormData): Promise<StageFormState> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const stageId = String(formData.get("stageId") ?? "");
  if (!workspaceId || !stageId) return { ok: false, error: "Brak workspace lub etapu." };

  const parsed = dealStageFieldsSchema.safeParse(parseStageFormData(formData));
  if (!parsed.success) {
    const fe: StageFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (typeof k === "string") (fe as Record<string, string>)[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const existing = await db.dealStage.findUnique({
    where: { id: stageId },
    select: { workspaceId: true, deletedAt: true },
  });
  if (!existing || existing.workspaceId !== workspaceId || existing.deletedAt) {
    return { ok: false, error: "Etap nie istnieje." };
  }

  const ctx = await requireWorkspaceAction(workspaceId, "dealStage.manage");

  await db.dealStage.update({
    where: { id: stageId },
    data: {
      name: parsed.data.name,
      colorHex: parsed.data.colorHex,
      closedKind: parsed.data.closedKind,
    },
  });
  await writeAudit({
    workspaceId,
    objectType: "DealStage",
    objectId: stageId,
    actorId: ctx.userId,
    action: "dealStage.updated",
    diff: { name: parsed.data.name, closedKind: parsed.data.closedKind },
  });
  revalidatePath(`/w/${workspaceId}/sales`);
  return { ok: true, stageId };
}

// Drag-drop reorder of pipeline columns. Client sends the new order as a
// comma-joined string of stage ids; server rewrites `order` 0..N-1 in a
// transaction so partial failures don't leave the column row inconsistent.
export async function reorderDealStagesAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const orderedIdsRaw = String(formData.get("orderedIds") ?? "");
  if (!workspaceId || !orderedIdsRaw) return;

  const orderedIds = orderedIdsRaw.split(",").filter(Boolean);
  if (orderedIds.length === 0) return;

  const ctx = await requireWorkspaceAction(workspaceId, "dealStage.manage");

  // Refuse mismatches — caller is replaying the FULL stage list so that the
  // numbering stays contiguous. A subset would create gaps the move math
  // breaks on.
  const existing = await db.dealStage.findMany({
    where: { workspaceId, deletedAt: null },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((s) => s.id));
  const allMatch =
    orderedIds.length === existing.length &&
    orderedIds.every((id) => existingIds.has(id));
  if (!allMatch) return;

  await db.$transaction(
    orderedIds.map((id, idx) =>
      db.dealStage.update({ where: { id }, data: { order: idx } }),
    ),
  );

  await writeAudit({
    workspaceId,
    objectType: "DealStage",
    objectId: orderedIds[0]!,
    actorId: ctx.userId,
    action: "dealStage.reordered",
    diff: { order: orderedIds },
  });
  revalidatePath(`/w/${workspaceId}/sales`);
}

export async function deleteDealStageAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const stageId = String(formData.get("stageId") ?? "");
  if (!workspaceId || !stageId) return;

  const existing = await db.dealStage.findUnique({
    where: { id: stageId },
    select: { workspaceId: true, deletedAt: true, _count: { select: { deals: { where: { deletedAt: null } } } } },
  });
  if (!existing || existing.workspaceId !== workspaceId || existing.deletedAt) return;
  // Don't strand deals — caller must move them first. Action is a no-op when
  // the column isn't empty; the UI surfaces this as a button-disabled state.
  if (existing._count.deals > 0) return;

  const ctx = await requireWorkspaceAction(workspaceId, "dealStage.manage");

  await db.dealStage.update({
    where: { id: stageId },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    workspaceId,
    objectType: "DealStage",
    objectId: stageId,
    actorId: ctx.userId,
    action: "dealStage.deleted",
  });
  revalidatePath(`/w/${workspaceId}/sales`);
}
