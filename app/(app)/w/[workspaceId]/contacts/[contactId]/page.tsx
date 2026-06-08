import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { ContactForm } from "@/components/contacts/contact-form";
import { deleteContactAction } from "@/app/(app)/w/[workspaceId]/contacts/actions";
import {
  ContactTimeline,
  type ContactTimelineActivity,
  type ContactUserLookup,
} from "@/components/contacts/contact-timeline";
import {
  ContactPipeline,
  type ContactPipelineDeal,
  type ContactPipelineStage,
} from "@/components/contacts/contact-pipeline";
import {
  ContactConversation,
  type ContactConversationSender,
  type ContactMessageRow,
} from "@/components/contacts/contact-conversation";
import { ContactTaskLinker } from "@/components/contacts/contact-task-linker";
import { ensureDefaultStages } from "@/app/(app)/w/[workspaceId]/sales/actions";
import { auth } from "@/lib/auth";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; contactId: string }>;
}) {
  const { workspaceId, contactId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId, deletedAt: null },
  });
  if (!contact) notFound();

  // Seed default deal stages so the per-contact pipeline always has columns
  // to render — same lazy seeding /sales does on first visit.
  await ensureDefaultStages(workspaceId);

  const [memberships, stages, deals, activities, contactTasks, contactMessages, currentSession, linkableTasks] = await Promise.all([
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.dealStage.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { order: "asc" },
    }),
    db.deal.findMany({
      where: { workspaceId, deletedAt: null, contactId },
      orderBy: { rowOrder: "asc" },
    }),
    db.contactActivity.findMany({
      where: { contactId, workspaceId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
    // F12-K67: zadania powiązane z tym kontaktem przez Task.contactId.
    // Sortujemy po updatedAt desc żeby ostatnio dotykane były pierwsze.
    db.task.findMany({
      where: {
        contactId,
        workspaceId,
        deletedAt: null,
        board: { deletedAt: null },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        displayId: true,
        stopAt: true,
        statusColumn: { select: { name: true, colorHex: true } },
        board: { select: { id: true, name: true } },
        assignees: {
          take: 1,
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
      },
    }),
    // F12-K68: thread wiadomości email do/z kontaktu. Asc bo render leci
    // od najstarszej (góra) do najnowszej (dół) — chat pattern.
    db.contactMessage.findMany({
      where: { contactId, workspaceId },
      orderBy: { sentAt: "asc" },
      take: 200,
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    }),
    auth(),
    // F12-K67 update: pool task'ów w workspace BEZ powiązanego kontaktu —
    // do picker'a "Powiąż istniejące zadanie" w ContactTasksTile. Limit
    // 500 ostatnio aktualizowanych, reszta filtrowana po stronie klienta.
    db.task.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        contactId: null,
        board: { deletedAt: null },
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: { id: true, title: true, displayId: true, board: { select: { name: true } } },
    }),
  ]);

  const stagesProp: ContactPipelineStage[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    colorHex: s.colorHex,
    closedKind:
      s.closedKind === "won" || s.closedKind === "lost" ? s.closedKind : null,
  }));
  const dealsProp: ContactPipelineDeal[] = deals.map((d) => ({
    id: d.id,
    title: d.title,
    valueAmount: d.valueAmount,
    valueCurrency: d.valueCurrency,
    stageId: d.stageId,
  }));

  const userLookup: ContactUserLookup = {};
  for (const m of memberships) {
    userLookup[m.user.id] = { name: m.user.name, email: m.user.email };
  }

  const timelineActivities: ContactTimelineActivity[] = activities.map((a) => ({
    id: a.id,
    type: a.type,
    createdAt: a.createdAt.toISOString(),
    actor: a.actor
      ? {
          id: a.actor.id,
          name: a.actor.name,
          email: a.actor.email,
          avatarUrl: a.actor.avatarUrl,
        }
      : null,
    body: (a.bodyJson ?? null) as Record<string, unknown> | null,
  }));

  const canEdit = can(ctx.role, "contact.update");
  const canDelete = can(ctx.role, "contact.delete");

  const headline =
    contact.companyName ??
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") ??
    contact.email ??
    "Kontakt";

  // Sender candidates dla composer'a: opiekun na początku (jeśli ustawiony),
  // potem zalogowany user, potem reszta workspace'u. Dedup po userId.
  const ownerMember = contact.ownerId
    ? memberships.find((m) => m.user.id === contact.ownerId)
    : null;
  const currentUserId = currentSession?.user?.id ?? null;
  const selfMember = currentUserId
    ? memberships.find((m) => m.user.id === currentUserId)
    : null;
  const sortedMembers = (() => {
    const ordered: typeof memberships = [];
    const seen = new Set<string>();
    const push = (m: (typeof memberships)[number] | null | undefined) => {
      if (!m || seen.has(m.user.id)) return;
      ordered.push(m);
      seen.add(m.user.id);
    };
    push(ownerMember);
    push(selfMember);
    for (const m of memberships) push(m);
    return ordered;
  })();
  const senderCandidates: ContactConversationSender[] = sortedMembers.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    // memberships.user nie zawiera avatarUrl w tym query — pomijamy.
    avatarUrl: null,
  }));
  const defaultSenderEmail =
    ownerMember?.user.email ?? selfMember?.user.email ?? null;

  const messageRows: ContactMessageRow[] = contactMessages.map((m) => ({
    id: m.id,
    direction: m.direction,
    fromEmail: m.fromEmail,
    toEmail: m.toEmail,
    subject: m.subject,
    bodyText: m.bodyText,
    sentAt: m.sentAt.toISOString(),
    senderName: m.sender?.name ?? m.sender?.email ?? null,
  }));

  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      {/* Wyrównanie szerokości do listy kontaktów (max-w-6xl). Wcześniej
          karta kontaktu była zacieśniona do max-w-3xl (768px) — przez to
          dłuższe ContactsTable / pipeline'y / thread konwersacji wyglądały
          klaustrofobicznie obok reszty modułów. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-3">
          <Link
            href={`/w/${workspaceId}/contacts`}
            className="eyebrow inline-flex w-fit items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ArrowLeft size={11} /> Wszystkie kontakty
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="eyebrow">Kontrahent</span>
              <h1 className="truncate font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
                {headline || "—"}
              </h1>
              {contact.companyName &&
                (contact.firstName || contact.lastName) && (
                  <p className="text-[0.92rem] text-muted-foreground">
                    {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
                    {contact.position ? ` · ${contact.position}` : ""}
                  </p>
                )}
            </div>
            {canDelete && (
              <form action={deleteContactAction} className="m-0">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="contactId" value={contact.id} />
                <button
                  type="submit"
                  aria-label="Usuń kontakt"
                  title="Usuń kontakt"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                >
                  <Trash2 size={12} /> Usuń
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <span className="eyebrow">Plan sprzedaży tego kontaktu</span>
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
              {deals.length} {deals.length === 1 ? "deal" : "deal’i"}
            </span>
          </div>
          <ContactPipeline
            workspaceId={workspaceId}
            contactId={contact.id}
            stages={stagesProp}
            deals={dealsProp}
          />
        </div>

        <ContactConversation
          workspaceId={workspaceId}
          contactId={contact.id}
          contactEmail={contact.email}
          contactLabel={headline}
          messages={messageRows}
          senderCandidates={senderCandidates}
          defaultSenderEmail={defaultSenderEmail}
          canSend={canEdit}
        />

        <ContactTasksTile
          workspaceId={workspaceId}
          contactId={contact.id}
          tasks={contactTasks}
          linkableTasks={linkableTasks.map((t) => ({
            id: t.id,
            label: `#${t.displayId} · ${t.title}`,
            sublabel: t.board.name,
          }))}
        />

        <ContactTimeline
          workspaceId={workspaceId}
          contactId={contact.id}
          activities={timelineActivities}
          users={userLookup}
          canEdit={canEdit}
        />

        {canEdit ? (
          <ContactForm
            mode="edit"
            workspaceId={workspaceId}
            initial={{
              id: contact.id,
              firstName: contact.firstName,
              lastName: contact.lastName,
              position: contact.position,
              email: contact.email,
              phone: contact.phone,
              companyName: contact.companyName,
              nip: contact.nip,
              regon: contact.regon,
              vatNumber: contact.vatNumber,
              website: contact.website,
              street: contact.street,
              city: contact.city,
              postalCode: contact.postalCode,
              country: contact.country,
              ownerId: contact.ownerId,
            }}
            members={memberships.map((m) => m.user)}
          />
        ) : (
          <ReadOnlyView contact={contact} />
        )}
      </div>
    </main>
  );
}

function ReadOnlyView({
  contact,
}: {
  contact: {
    firstName: string | null;
    lastName: string | null;
    position: string | null;
    email: string | null;
    phone: string | null;
    companyName: string | null;
    nip: string | null;
    regon: string | null;
    vatNumber: string | null;
    website: string | null;
    street: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
  };
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Row label="Email" value={contact.email} />
      <Row label="Telefon" value={contact.phone} />
      <Row label="Stanowisko" value={contact.position} />
      <Row label="NIP" value={contact.nip} />
      <Row label="REGON" value={contact.regon} />
      <Row label="VAT EU" value={contact.vatNumber} />
      <Row label="Strona" value={contact.website} />
      <Row
        label="Adres"
        value={[contact.street, contact.postalCode, contact.city, contact.country]
          .filter(Boolean)
          .join(", ")}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-card px-3 py-2.5">
      <span className="eyebrow">{label}</span>
      <span className="font-mono text-[0.86rem]">
        {value && value.length > 0 ? value : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </span>
    </div>
  );
}

// F12-K67: kafelek "Zadania" w karcie kontaktu. Pokazuje task'i powiązane
// przez Task.contactId — status, board, termin, primary assignee + klik na
// title prowadzi do task'a. Empty state zachęca do podpięcia pierwszego.
type ContactTaskRow = {
  id: string;
  title: string;
  displayId: number;
  stopAt: Date | null;
  statusColumn: { name: string; colorHex: string } | null;
  board: { id: string; name: string };
  assignees: Array<{
    user: { id: string; name: string | null; email: string; avatarUrl: string | null };
  }>;
};

function ContactTasksTile({
  workspaceId,
  contactId,
  tasks,
  linkableTasks,
}: {
  workspaceId: string;
  contactId: string;
  tasks: ContactTaskRow[];
  linkableTasks: { id: string; label: string; sublabel?: string | null }[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">Zadania powiązane</span>
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
          {tasks.length} {tasks.length === 1 ? "zadanie" : "zadań"}
        </span>
      </div>
      <ContactTaskLinker contactId={contactId} candidates={linkableTasks} />
      {tasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card px-4 py-6 text-center text-[0.86rem] text-muted-foreground">
          Brak zadań powiązanych z tym kontaktem. W karcie zadania wybierz tego
          klienta w polu „Kontakt”, żeby pojawiło się tutaj.
        </p>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
          {tasks.map((t) => {
            const a = t.assignees[0]?.user ?? null;
            return (
              <li
                key={t.id}
                className="border-b border-border last:border-b-0 hover:bg-accent/30"
              >
                <Link
                  href={`/w/${workspaceId}/t/${t.id}`}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  {a ? (
                    <span
                      title={a.name ?? a.email}
                      className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.58rem] font-bold text-white"
                    >
                      {a.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (a.name ?? a.email).slice(0, 2).toUpperCase()
                      )}
                    </span>
                  ) : (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted font-mono text-[0.55rem] uppercase text-muted-foreground/60">
                      —
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-display text-[0.9rem] font-semibold tracking-[-0.01em]">
                      {t.title}
                    </span>
                    <span className="flex items-center gap-1.5 truncate font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
                      #{t.displayId} · {t.board.name}
                      {t.stopAt && (
                        <>
                          <span>·</span>
                          <span>
                            do {t.stopAt.toLocaleDateString("pl-PL")}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  {t.statusColumn && (
                    <span
                      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em]"
                      style={{
                        color: t.statusColumn.colorHex,
                        background: `${t.statusColumn.colorHex}22`,
                      }}
                    >
                      {t.statusColumn.name}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
