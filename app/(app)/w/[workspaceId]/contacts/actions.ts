"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import { contactFieldsSchema, hasIdentity } from "@/lib/schemas/contact";

type FieldErrors = Partial<Record<
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "companyName"
  | "nip"
  | "regon"
  | "vatNumber"
  | "website"
  | "street"
  | "city"
  | "postalCode"
  | "country"
  | "position"
  | "ownerId"
  | "_form",
  string
>>;

export type ContactFormState =
  | { ok: true; contactId: string; message: string }
  | { ok: false; error?: string; fieldErrors?: FieldErrors }
  | null;

// FormData → ContactFieldsInput. We accept blank strings for "no value" and
// turn them into null at the DB layer (Prisma rejects "" for fields where the
// schema says String? — easier to normalize once here).
function parseFormData(fd: FormData) {
  const get = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const notesRaw = get("notesJson");
  let notesParsed: unknown = null;
  if (notesRaw && notesRaw.length > 0) {
    try {
      notesParsed = JSON.parse(notesRaw);
    } catch {
      notesParsed = null;
    }
  }
  return {
    firstName: get("firstName"),
    lastName: get("lastName"),
    position: get("position"),
    email: get("email"),
    phone: get("phone"),
    companyName: get("companyName"),
    nip: get("nip"),
    regon: get("regon"),
    vatNumber: get("vatNumber"),
    website: get("website"),
    street: get("street"),
    city: get("city"),
    postalCode: get("postalCode"),
    country: get("country"),
    ownerId: get("ownerId"),
    notesJson: notesParsed as Record<string, unknown> | null,
  };
}

function nullIfEmpty<T extends string | undefined>(v: T): string | null {
  if (v === undefined) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// Best-effort timeline log (mirror of DealActivity's helper). Failures swallowed
// so a stuck audit row never blocks the underlying contact mutation.
async function logContactEvent(args: {
  workspaceId: string;
  contactId: string;
  actorId: string | null;
  type: string;
  body?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await db.contactActivity.create({
      data: {
        workspaceId: args.workspaceId,
        contactId: args.contactId,
        actorId: args.actorId,
        type: args.type,
        bodyJson: args.body ?? Prisma.JsonNull,
      },
    });
  } catch {
    /* timeline is best-effort */
  }
}

function isDocNonEmpty(doc: unknown): boolean {
  if (!doc || typeof doc !== "object") return false;
  const queue: unknown[] = [doc];
  while (queue.length) {
    const node = queue.shift() as { type?: string; text?: string; content?: unknown[] };
    if (
      node?.type === "text" &&
      typeof node.text === "string" &&
      node.text.trim().length > 0
    ) {
      return true;
    }
    if (Array.isArray(node?.content)) queue.push(...node.content);
  }
  return false;
}

export type ContactNoteState =
  | { ok: true; activityId: string }
  | { ok: false; error: string }
  | null;

export async function createContactNoteAction(
  workspaceId: string,
  contactId: string,
  _prev: ContactNoteState,
  formData: FormData,
): Promise<ContactNoteState> {
  const raw = formData.get("bodyJson");
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, error: "Treść notatki wymagana." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Niepoprawny format notatki." };
  }
  if (!isDocNonEmpty(parsed)) {
    return { ok: false, error: "Treść notatki nie może być pusta." };
  }

  const contact = await db.contact.findUnique({
    where: { id: contactId },
    select: { workspaceId: true, deletedAt: true },
  });
  if (!contact || contact.workspaceId !== workspaceId || contact.deletedAt) {
    return { ok: false, error: "Kontakt nie istnieje." };
  }

  const ctx = await requireWorkspaceAction(workspaceId, "contact.update");

  const activity = await db.contactActivity.create({
    data: {
      workspaceId,
      contactId,
      actorId: ctx.userId,
      type: "note",
      bodyJson: parsed as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/w/${workspaceId}/contacts/${contactId}`);
  return { ok: true, activityId: activity.id };
}

export async function createContactAction(
  workspaceId: string,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = contactFieldsSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (typeof k === "string") (fe as Record<string, string>)[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }
  if (!hasIdentity(parsed.data)) {
    return {
      ok: false,
      fieldErrors: { _form: "Wypełnij przynajmniej nazwę firmy, imię, nazwisko albo email." },
    };
  }

  const ctx = await requireWorkspaceAction(workspaceId, "contact.create");

  // ownerId — only allow workspace members to be set as owner.
  let ownerId: string | null = null;
  if (parsed.data.ownerId && parsed.data.ownerId.length > 0) {
    const m = await db.workspaceMembership.findFirst({
      where: { workspaceId, userId: parsed.data.ownerId },
      select: { userId: true },
    });
    if (m) ownerId = m.userId;
  }

  const contact = await db.contact.create({
    data: {
      workspaceId,
      creatorId: ctx.userId,
      ownerId,
      firstName: nullIfEmpty(parsed.data.firstName),
      lastName: nullIfEmpty(parsed.data.lastName),
      position: nullIfEmpty(parsed.data.position),
      email: nullIfEmpty(parsed.data.email),
      phone: nullIfEmpty(parsed.data.phone),
      companyName: nullIfEmpty(parsed.data.companyName),
      nip: nullIfEmpty(parsed.data.nip),
      regon: nullIfEmpty(parsed.data.regon),
      vatNumber: nullIfEmpty(parsed.data.vatNumber),
      website: nullIfEmpty(parsed.data.website),
      street: nullIfEmpty(parsed.data.street),
      city: nullIfEmpty(parsed.data.city),
      postalCode: nullIfEmpty(parsed.data.postalCode),
      country: nullIfEmpty(parsed.data.country) ?? "PL",
      notesJson: (parsed.data.notesJson as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
    },
  });

  await writeAudit({
    workspaceId,
    objectType: "Contact",
    objectId: contact.id,
    actorId: ctx.userId,
    action: "contact.created",
    diff: { companyName: contact.companyName, email: contact.email },
  });
  await logContactEvent({
    workspaceId,
    contactId: contact.id,
    actorId: ctx.userId,
    type: "created",
    body: { companyName: contact.companyName, email: contact.email },
  });

  revalidatePath(`/w/${workspaceId}/contacts`);
  redirect(`/w/${workspaceId}/contacts/${contact.id}`);
}

export async function updateContactAction(
  workspaceId: string,
  contactId: string,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = contactFieldsSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (typeof k === "string") (fe as Record<string, string>)[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }
  if (!hasIdentity(parsed.data)) {
    return {
      ok: false,
      fieldErrors: { _form: "Wypełnij przynajmniej nazwę firmy, imię, nazwisko albo email." },
    };
  }

  const existing = await db.contact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      workspaceId: true,
      deletedAt: true,
      companyName: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      ownerId: true,
    },
  });
  if (!existing || existing.workspaceId !== workspaceId || existing.deletedAt) {
    return { ok: false, error: "Kontakt nie istnieje albo został usunięty." };
  }

  const ctx = await requireWorkspaceAction(workspaceId, "contact.update");

  let ownerId: string | null = null;
  if (parsed.data.ownerId && parsed.data.ownerId.length > 0) {
    const m = await db.workspaceMembership.findFirst({
      where: { workspaceId, userId: parsed.data.ownerId },
      select: { userId: true },
    });
    if (m) ownerId = m.userId;
  }

  await db.contact.update({
    where: { id: contactId },
    data: {
      ownerId,
      firstName: nullIfEmpty(parsed.data.firstName),
      lastName: nullIfEmpty(parsed.data.lastName),
      position: nullIfEmpty(parsed.data.position),
      email: nullIfEmpty(parsed.data.email),
      phone: nullIfEmpty(parsed.data.phone),
      companyName: nullIfEmpty(parsed.data.companyName),
      nip: nullIfEmpty(parsed.data.nip),
      regon: nullIfEmpty(parsed.data.regon),
      vatNumber: nullIfEmpty(parsed.data.vatNumber),
      website: nullIfEmpty(parsed.data.website),
      street: nullIfEmpty(parsed.data.street),
      city: nullIfEmpty(parsed.data.city),
      postalCode: nullIfEmpty(parsed.data.postalCode),
      country: nullIfEmpty(parsed.data.country) ?? "PL",
      notesJson: (parsed.data.notesJson as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
    },
  });

  await writeAudit({
    workspaceId,
    objectType: "Contact",
    objectId: contactId,
    actorId: ctx.userId,
    action: "contact.updated",
  });

  // Per-field timeline events. Skipped for very common no-op fields (notes
  // already feel like an activity on their own and would spam the timeline).
  const nextCompany = nullIfEmpty(parsed.data.companyName);
  const nextFirst = nullIfEmpty(parsed.data.firstName);
  const nextLast = nullIfEmpty(parsed.data.lastName);
  const nextEmail = nullIfEmpty(parsed.data.email);
  const nextPhone = nullIfEmpty(parsed.data.phone);
  if (existing.companyName !== nextCompany) {
    await logContactEvent({
      workspaceId,
      contactId,
      actorId: ctx.userId,
      type: "field_change",
      body: { field: "companyName", from: existing.companyName, to: nextCompany },
    });
  }
  if (existing.firstName !== nextFirst || existing.lastName !== nextLast) {
    const from = [existing.firstName, existing.lastName].filter(Boolean).join(" ") || null;
    const to = [nextFirst, nextLast].filter(Boolean).join(" ") || null;
    await logContactEvent({
      workspaceId,
      contactId,
      actorId: ctx.userId,
      type: "field_change",
      body: { field: "name", from, to },
    });
  }
  if (existing.email !== nextEmail) {
    await logContactEvent({
      workspaceId,
      contactId,
      actorId: ctx.userId,
      type: "field_change",
      body: { field: "email", from: existing.email, to: nextEmail },
    });
  }
  if (existing.phone !== nextPhone) {
    await logContactEvent({
      workspaceId,
      contactId,
      actorId: ctx.userId,
      type: "field_change",
      body: { field: "phone", from: existing.phone, to: nextPhone },
    });
  }
  if (existing.ownerId !== ownerId) {
    await logContactEvent({
      workspaceId,
      contactId,
      actorId: ctx.userId,
      type: "owner_change",
      body: { from: existing.ownerId, to: ownerId },
    });
  }

  revalidatePath(`/w/${workspaceId}/contacts`);
  revalidatePath(`/w/${workspaceId}/contacts/${contactId}`);
  return { ok: true, contactId, message: "Zapisano." };
}

export async function deleteContactAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  if (!workspaceId || !contactId) return;

  const existing = await db.contact.findUnique({
    where: { id: contactId },
    select: { id: true, workspaceId: true, deletedAt: true },
  });
  if (!existing || existing.workspaceId !== workspaceId || existing.deletedAt) return;

  const ctx = await requireWorkspaceAction(workspaceId, "contact.delete");

  await db.contact.update({
    where: { id: contactId },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    workspaceId,
    objectType: "Contact",
    objectId: contactId,
    actorId: ctx.userId,
    action: "contact.deleted",
  });

  revalidatePath(`/w/${workspaceId}/contacts`);
  redirect(`/w/${workspaceId}/contacts`);
}

export async function restoreContactAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  if (!workspaceId || !contactId) return;

  const existing = await db.contact.findUnique({
    where: { id: contactId },
    select: { id: true, workspaceId: true },
  });
  if (!existing || existing.workspaceId !== workspaceId) return;

  const ctx = await requireWorkspaceAction(workspaceId, "contact.update");

  await db.contact.update({
    where: { id: contactId },
    data: { deletedAt: null },
  });
  await writeAudit({
    workspaceId,
    objectType: "Contact",
    objectId: contactId,
    actorId: ctx.userId,
    action: "contact.restored",
  });
  revalidatePath(`/w/${workspaceId}/contacts`);
  revalidatePath(`/w/${workspaceId}/contacts/${contactId}`);
}
