import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { ContactsView } from "@/components/contacts/contacts-view";
import type { ContactBoardRef, ContactHistoryEntry } from "@/components/contacts/contact-card-panel";
import { docText, formatLastContact, type ContactRow } from "@/components/contacts/contact-model";

const ROW_LIMIT = 500;
// History/board lookups are fetched workspace-wide in one query each and then
// bucketed per contact — cheaper than N queries, and the card panel only ever
// shows the newest few entries.
const HISTORY_LIMIT = 600;

const ACTIVITY_TEXT: Record<string, string> = {
  created: "Kontakt utworzony",
  field_change: "Zmiana danych kontaktu",
  owner_change: "Zmiana opiekuna",
};

export default async function ContactsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ kosz?: string }>;
}) {
  const { workspaceId } = await params;
  const { kosz } = await searchParams;
  const ctx = await requireWorkspaceMembership(workspaceId);
  const canCreate = can(ctx.role, "contact.create");
  const canEdit = can(ctx.role, "contact.update");
  const canDelete = can(ctx.role, "contact.delete");
  const trash = kosz === "1" && canDelete;

  const [contacts, trashCount, memberships, activities, messages, taskBoards] = await Promise.all([
    db.contact.findMany({
      where: { workspaceId, deletedAt: trash ? { not: null } : null },
      orderBy: [{ updatedAt: "desc" }],
      take: ROW_LIMIT,
      select: {
        id: true, companyName: true, firstName: true, lastName: true, position: true,
        email: true, phone: true, nip: true, city: true, updatedAt: true,
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { deals: true } },
      },
    }),
    canDelete ? db.contact.count({ where: { workspaceId, deletedAt: { not: null } } }) : Promise.resolve(0),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: "asc" },
      select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    db.contactActivity.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: {
        id: true, contactId: true, type: true, bodyJson: true, createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
    db.contactMessage.findMany({
      where: { workspaceId },
      orderBy: { sentAt: "desc" },
      take: HISTORY_LIMIT,
      select: { id: true, contactId: true, subject: true, bodyText: true, sentAt: true },
    }),
    db.task.findMany({
      where: { workspaceId, deletedAt: null, contactId: { not: null }, board: { deletedAt: null } },
      select: { contactId: true, board: { select: { id: true, name: true } } },
      take: 2000,
    }),
  ]);

  // Notes, field changes and e-mails merged into one newest-first stream per
  // contact; the panel shows the top few, the table the very first one.
  const stream = [
    ...activities.map((a) => ({
      contactId: a.contactId,
      ts: a.createdAt,
      entry: {
        id: a.id,
        kind: a.type === "note" ? ("note" as const) : ("event" as const),
        actorName: a.actor?.name ?? a.actor?.email ?? null,
        text: (a.type === "note" ? docText(a.bodyJson) : "") || ACTIVITY_TEXT[a.type] || a.type,
      },
    })),
    ...messages.map((m) => ({
      contactId: m.contactId,
      ts: m.sentAt,
      entry: {
        id: m.id,
        kind: "mail" as const,
        actorName: null,
        text: m.subject || m.bodyText.slice(0, 120),
      },
    })),
  ].sort((a, b) => b.ts.getTime() - a.ts.getTime());

  const historyByContact: Record<string, ContactHistoryEntry[]> = {};
  const newestAt: Record<string, Date> = {};
  for (const s of stream) {
    newestAt[s.contactId] ??= s.ts;
    const list = (historyByContact[s.contactId] ??= []);
    if (list.length < 6) list.push({ ...s.entry, at: formatLastContact(s.ts.toISOString()) });
  }

  const boardsByContact: Record<string, ContactBoardRef[]> = {};
  for (const t of taskBoards) {
    if (!t.contactId) continue;
    const list = (boardsByContact[t.contactId] ??= []);
    if (!list.some((b) => b.id === t.board.id)) list.push(t.board);
  }

  const rows: ContactRow[] = contacts
    .map((c) => ({
      id: c.id,
      companyName: c.companyName,
      firstName: c.firstName,
      lastName: c.lastName,
      position: c.position,
      email: c.email,
      phone: c.phone,
      nip: c.nip,
      city: c.city,
      dealCount: c._count.deals,
      owner: c.owner,
      lastContactAt: (newestAt[c.id] ?? c.updatedAt).toISOString(),
      lastContactNote: historyByContact[c.id]?.[0]?.text ?? null,
    }))
    .sort((a, b) => b.lastContactAt.localeCompare(a.lastContactAt));

  return (
    <ContactsView
      workspaceId={workspaceId}
      rows={rows}
      members={memberships.map((m) => m.user)}
      boardsByContact={boardsByContact}
      historyByContact={historyByContact}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      trash={trash}
      trashCount={trashCount}
    />
  );
}
