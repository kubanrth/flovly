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
import { ensureDefaultStages } from "@/app/(app)/w/[workspaceId]/sales/actions";

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

  const [memberships, stages, deals, activities] = await Promise.all([
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
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

  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 md:gap-8">
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
