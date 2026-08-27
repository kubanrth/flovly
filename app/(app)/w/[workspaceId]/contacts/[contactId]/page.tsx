import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Avatar } from "@/components/ui/avatar";
import { IconChevronLeft, IconTrash } from "@/components/ui/icons";
import { InitialsTile } from "@/components/contacts/initials-tile";
import { contactKind, KIND_HUE, KIND_LABEL } from "@/components/contacts/contact-model";
import { hueForColor } from "@/components/ui/status-hue";
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
import { ContactMobileTabs } from "@/components/contacts/contact-mobile-tabs";
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

  // Inicjały do mobile avatar'a (80×80 gradient header per B6 spec).
  const initialsSource =
    contact.companyName ??
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") ??
    contact.email ??
    "?";
  const mobileInitials = initialsSource
    .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";

  const kind = contactKind({ ...contact, dealCount: deals.length });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-8 py-5 max-md:px-4">
        <div className="flex flex-col gap-3">
          <Link
            href={`/w/${workspaceId}/contacts`}
            className="inline-flex w-fit items-center gap-1 rounded-[2px] text-xs text-muted-foreground no-underline outline-none hover:text-orange-800 active:text-orange-900"
          >
            <IconChevronLeft width={12} height={12} /> Wszystkie kontakty
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <InitialsTile label={headline || mobileInitials} kind={kind} size={44} />
            <div className="flex min-w-0 flex-col">
              <h1 className="truncate text-xl font-semibold tracking-[-0.3px]">{headline || "—"}</h1>
              <span className="flex items-center gap-2">
                <Chip hue={KIND_HUE[kind]} size="sm">{KIND_LABEL[kind]}</Chip>
                {contact.companyName && (contact.firstName || contact.lastName) && (
                  <span className="truncate text-xs text-muted-foreground">
                    {contact.companyName}
                    {contact.position ? ` · ${contact.position}` : ""}
                  </span>
                )}
              </span>
            </div>
            <span className="flex-1" />
            {canDelete && (
              <form action={deleteContactAction} className="m-0">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="contactId" value={contact.id} />
                <Button type="submit" variant="secondary" aria-label="Usuń kontakt">
                  <IconTrash /> Usuń
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Mobile-only sticky tabs (B6 spec): horizontal scrollable pills,
            anchor-link nav do sekcji poniżej, IntersectionObserver podświetla
            aktywną. Hidden na md+. */}
        <ContactMobileTabs />

        {/* scroll-mt-32 daje 128px offset'u od top'u przy `scrollIntoView` żeby
            section nie wjeżdżał pod sticky AppShell header + mobile tabs.
            Każda sekcja ma ID matching TABS w ContactMobileTabs. */}
        <div id="contact-deals" className="flex scroll-mt-32 flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">Plan sprzedaży tego kontaktu</h2>
            <span className="font-mono text-2xs text-muted-foreground">
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

        <div id="contact-messages" className="scroll-mt-32">
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
        </div>

        <div id="contact-tasks" className="scroll-mt-32">
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
        </div>

        <div id="contact-activity" className="scroll-mt-32">
          <ContactTimeline
            workspaceId={workspaceId}
            contactId={contact.id}
            activities={timelineActivities}
            users={userLookup}
            canEdit={canEdit}
          />
        </div>

        <div id="contact-info" className="scroll-mt-32">
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
      </div>
    </div>
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
    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-card px-3 py-2">
      <span className="text-2xs text-fg-3">{label}</span>
      <span className="font-mono text-sm">
        {value && value.length > 0 ? value : <span className="text-fg-3">—</span>}
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
        <h2 className="text-sm font-semibold">Zadania powiązane</h2>
        <span className="font-mono text-2xs text-muted-foreground">
          {tasks.length} {tasks.length === 1 ? "zadanie" : "zadań"}
        </span>
      </div>
      <ContactTaskLinker contactId={contactId} candidates={linkableTasks} />
      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-input-border bg-card px-4 py-6 text-center text-xs text-muted-foreground">
          Brak zadań powiązanych z tym kontaktem. W karcie zadania wybierz tego
          klienta w polu „Kontakt”, żeby pojawiło się tutaj.
        </p>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
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
                    <Avatar name={a.name ?? a.email} src={a.avatarUrl} size={24} />
                  ) : (
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-n-100 font-mono text-2xs text-fg-3">
                      —
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{t.title}</span>
                    <span className="flex items-center gap-1.5 truncate font-mono text-2xs text-muted-foreground">
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
                    <Chip hue={hueForColor(t.statusColumn.colorHex)} dot size="sm" className="shrink-0">
                      {t.statusColumn.name}
                    </Chip>
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
