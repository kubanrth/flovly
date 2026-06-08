import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { deleteDealAction } from "@/app/(app)/w/[workspaceId]/sales/actions";
import { DealForm } from "@/components/sales/deal-form";
import type { RichTextDoc } from "@/components/task/rich-text-editor";
import {
  DealTimeline,
  type ContactLookup,
  type StageLookup,
  type TimelineActivity,
  type UserLookup,
} from "@/components/sales/deal-timeline";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; dealId: string }>;
}) {
  const { workspaceId, dealId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const deal = await db.deal.findFirst({
    where: { id: dealId, workspaceId, deletedAt: null },
  });
  if (!deal) notFound();

  const [stages, stagesFull, memberships, contacts, activities] = await Promise.all([
    db.dealStage.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { order: "asc" },
      // colorHex potrzebny do swatch'a w SearchableDropdown.
      select: { id: true, name: true, colorHex: true },
    }),
    // Stage palette for the timeline pills — we want colorHex too.
    db.dealStage.findMany({
      where: { workspaceId },
      select: { id: true, name: true, colorHex: true },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.contact.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        companyName: true,
        email: true,
        // NIP w sublabel/search — ułatwia "znalezienie firmy po numerze".
        nip: true,
      },
    }),
    db.dealActivity.findMany({
      where: { dealId, workspaceId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
  ]);

  // Timeline lookups so the client component can hydrate stage / user / contact
  // references without an extra fetch per row. Include soft-deleted entries
  // (no deletedAt filter on contacts/users below) so historical "from→to"
  // references still render even after the source was removed.
  const stageLookup: StageLookup = {};
  for (const s of stagesFull) stageLookup[s.id] = { name: s.name, colorHex: s.colorHex };
  const userLookup: UserLookup = {};
  for (const m of memberships) {
    userLookup[m.user.id] = { name: m.user.name, email: m.user.email };
  }
  const contactLookup: ContactLookup = {};
  for (const c of contacts) {
    contactLookup[c.id] = {
      label:
        c.companyName ??
        [c.firstName, c.lastName].filter(Boolean).join(" ") ??
        c.email ??
        "—",
    };
  }

  const timelineActivities: TimelineActivity[] = activities.map((a) => ({
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

  const canEdit = can(ctx.role, "deal.update");
  const canDelete = can(ctx.role, "deal.delete");

  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      {/* Wyrównanie szerokości — pipeline ma max-w-[1400px], karta deala
          z max-w-3xl wyglądała wąsko obok niego. 6xl = ~1152px. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-3">
          <Link
            href={`/w/${workspaceId}/sales`}
            className="eyebrow inline-flex w-fit items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ArrowLeft size={11} /> Pipeline
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="eyebrow">Deal</span>
              <h1 className="truncate font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
                {deal.title}
              </h1>
            </div>
            {canDelete && (
              <form action={deleteDealAction} className="m-0">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="dealId" value={deal.id} />
                <button
                  type="submit"
                  aria-label="Usuń deal"
                  title="Usuń deal"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                >
                  <Trash2 size={12} /> Usuń
                </button>
              </form>
            )}
          </div>
        </div>

        {canEdit ? (
          <DealForm
            mode="edit"
            workspaceId={workspaceId}
            initial={{
              id: deal.id,
              title: deal.title,
              valueAmount: deal.valueAmount,
              valueCurrency: deal.valueCurrency,
              expectedCloseAt: deal.expectedCloseAt
                ? deal.expectedCloseAt.toISOString()
                : null,
              stageId: deal.stageId,
              ownerId: deal.ownerId,
              contactId: deal.contactId,
              notesJson: (deal.notesJson ?? null) as RichTextDoc | null,
              reminderAt: deal.reminderAt ? deal.reminderAt.toISOString() : null,
            }}
            stages={stages}
            members={memberships.map((m) => m.user)}
            contacts={contacts.map((c) => {
              const person = [c.firstName, c.lastName].filter(Boolean).join(" ");
              const labelBase =
                c.companyName ?? (person !== "" ? person : (c.email ?? "—"));
              // Sublabel = osoba (gdy firma w głównym labelu) lub email / NIP.
              const sublabel =
                c.companyName && person !== ""
                  ? person
                  : (c.email ?? c.nip ?? null);
              return { id: c.id, label: labelBase, sublabel };
            })}
          />
        ) : (
          <p className="rounded-md border border-border bg-card px-4 py-8 text-center text-[0.88rem] text-muted-foreground">
            Twoja rola nie pozwala na edycję deala.
          </p>
        )}

        <DealTimeline
          workspaceId={workspaceId}
          dealId={deal.id}
          activities={timelineActivities}
          stages={stageLookup}
          users={userLookup}
          contacts={contactLookup}
        />
      </div>
    </main>
  );
}
