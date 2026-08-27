"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import { contactFieldsSchema, hasIdentity } from "@/lib/schemas/contact";
import { CSV_FIELDS, type ImportedContact } from "./csv";

// „Import CSV” from the E1 header. `createContactAction` ends in redirect(),
// so it cannot be looped over from the client — this writes the batch in one
// call instead. Same guard + zod schema + audit trail as the single create.
const MAX_ROWS = 1000;

export type ImportContactsResult = { ok: true; created: number } | { ok: false; error: string };

export async function importContactsAction(
  workspaceId: string,
  rows: ImportedContact[],
): Promise<ImportContactsResult> {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "Brak wierszy do importu." };
  if (rows.length > MAX_ROWS) return { ok: false, error: `Maksymalnie ${MAX_ROWS} wierszy na import.` };

  const ctx = await requireWorkspaceAction(workspaceId, "contact.create");

  const data = [];
  for (const raw of rows) {
    // Only known columns reach zod; anything else the client sent is dropped.
    const picked: Record<string, string> = {};
    for (const f of CSV_FIELDS) if (typeof raw[f] === "string") picked[f] = raw[f];
    const parsed = contactFieldsSchema.safeParse(picked);
    if (!parsed.success || !hasIdentity(parsed.data)) continue;
    const v = parsed.data;
    data.push({
      workspaceId,
      creatorId: ctx.userId,
      firstName: v.firstName || null,
      lastName: v.lastName || null,
      position: v.position || null,
      email: v.email || null,
      phone: v.phone || null,
      companyName: v.companyName || null,
      nip: v.nip || null,
      regon: v.regon || null,
      vatNumber: v.vatNumber || null,
      website: v.website || null,
      street: v.street || null,
      city: v.city || null,
      postalCode: v.postalCode || null,
      country: v.country || "PL",
    });
  }

  if (data.length === 0) return { ok: false, error: "Żaden wiersz nie przeszedł walidacji." };

  await db.contact.createMany({ data });
  await writeAudit({
    workspaceId,
    objectType: "Contact",
    objectId: workspaceId,
    actorId: ctx.userId,
    action: "contact.imported",
    diff: { count: data.length },
  });

  revalidatePath(`/w/${workspaceId}/contacts`);
  return { ok: true, created: data.length };
}
