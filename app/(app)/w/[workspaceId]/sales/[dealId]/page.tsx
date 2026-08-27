import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { deleteDealAction } from "@/app/(app)/w/[workspaceId]/sales/actions";
import { DealForm } from "@/components/sales/deal-form";
import { DealMobileActions } from "@/components/sales/deal-mobile-actions";
import { Button } from "@/components/ui/button";
import { IconChevronLeft, IconTrash } from "@/components/ui/icons";
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
      // closedKind dla mobile sticky-bottom won/lost button'ów (DealMobileActions).
      select: { id: true, name: true, colorHex: true, closedKind: true },
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

  // Mobile sticky bottom actions (spec B6): "Zmień stage + Zamknij wygrane/
  // przegrane". Pokazujemy tylko gdy user może zmieniać deala — bez tego
  // shortcut'y są wprowadzające w błąd.
  // Explicit cast bo Prisma zwraca `closedKind: string | null` — narrowing
  // ternarią nie zachowuje literalnego typu w mapie. Bezpieczne — sprawdzamy
  // dokładnie te dwie wartości.
  const mobileStages: {
    id: string;
    name: string;
    colorHex: string;
    closedKind: "won" | "lost" | null;
  }[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    colorHex: s.colorHex,
    closedKind:
      s.closedKind === "won"
        ? ("won" as const)
        : s.closedKind === "lost"
          ? ("lost" as const)
          : null,
  }));

  return (
    <div className="flex min-w-0 flex-1 flex-col" style={{ minHeight: "calc(100dvh - var(--topbar))" }}>
      <header className="flex shrink-0 items-center gap-2 px-8 pt-4 max-md:px-4">
        <Link
          href={`/w/${workspaceId}/sales`}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
        >
          <IconChevronLeft width={13} height={13} /> Plan sprzedaży
        </Link>
        <span aria-hidden className="shrink-0 text-n-400">/</span>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-[-0.3px]">{deal.title}</h1>
        {canDelete && (
          <form action={deleteDealAction} className="m-0 shrink-0">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="dealId" value={deal.id} />
            <Button type="submit" variant="secondary" className="hover:text-danger-text">
              <IconTrash width={14} height={14} /> Usuń
            </Button>
          </form>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-8 py-4 max-md:px-4">
        <div className="flex max-w-[980px] flex-col gap-5">
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
              reminderNote: deal.reminderNote,
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
          <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
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
      </div>

      {canEdit && (
        <DealMobileActions
          workspaceId={workspaceId}
          dealId={deal.id}
          currentStageId={deal.stageId}
          stages={mobileStages}
        />
      )}
    </div>
  );
}
