import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import {
  ensureDefaultStages,
  // imported for the type narrowing only — listed so it is not tree-shaken away
} from "@/app/(app)/w/[workspaceId]/sales/actions";
import {
  SalesPipeline,
  type PipelineDeal,
  type PipelineStage,
} from "@/components/sales/sales-pipeline";
import { StageManagerDialog } from "@/components/sales/stage-manager-dialog";
import {
  SalesRemindersTile,
  type SalesReminderRow,
} from "@/components/sales/sales-reminders-tile";

export default async function SalesPipelinePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  // First-ever access seeds the default stage set so the user sees something
  // instead of an empty board. Idempotent (no-op when stages already exist).
  await ensureDefaultStages(workspaceId);

  const [stages, deals] = await Promise.all([
    db.dealStage.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { order: "asc" },
      include: {
        // Live count drives the "can't delete this stage yet" disabled state
        // in the manage-stages dialog.
        _count: { select: { deals: { where: { deletedAt: null } } } },
      },
    }),
    db.deal.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: [{ stageId: "asc" }, { rowOrder: "asc" }],
      include: {
        contact: {
          select: { id: true, firstName: true, lastName: true, companyName: true },
        },
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    }),
  ]);

  const canCreate = can(ctx.role, "deal.create");
  const canManageStages = can(ctx.role, "dealStage.manage");
  const totalCount = deals.length;

  // Total value broken out by currency — mirrors per-column totals.
  const totalByCurrency = new Map<string, number>();
  for (const d of deals) {
    if (d.valueAmount == null) continue;
    totalByCurrency.set(
      d.valueCurrency,
      (totalByCurrency.get(d.valueCurrency) ?? 0) + d.valueAmount,
    );
  }

  const stagesProp: PipelineStage[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    colorHex: s.colorHex,
    order: s.order,
    closedKind: (s.closedKind === "won" || s.closedKind === "lost"
      ? s.closedKind
      : null) as "won" | "lost" | null,
  }));

  const dealsProp: PipelineDeal[] = deals.map((d) => {
    const personName = [d.contact?.firstName, d.contact?.lastName]
      .filter(Boolean)
      .join(" ");
    return {
      id: d.id,
      stageId: d.stageId,
      rowOrder: d.rowOrder,
      title: d.title,
      valueAmount: d.valueAmount,
      valueCurrency: d.valueCurrency,
      expectedCloseAt: d.expectedCloseAt ? d.expectedCloseAt.toISOString() : null,
      contact: d.contact
        ? {
            id: d.contact.id,
            name: personName || d.contact.companyName || "—",
            companyName: d.contact.companyName,
          }
        : null,
      owner: d.owner
        ? {
            id: d.owner.id,
            name: d.owner.name,
            email: d.owner.email,
            avatarUrl: d.owner.avatarUrl,
          }
        : null,
    };
  });

  // F12-K70: kafelek "Nadchodzące przypomnienia" — agregowany widok deal'i
  // z ustawionym reminderAt, posortowany rosnąco (najpilniejsze pierwsze).
  // Wykorzystujemy już-pobrane `deals` żeby uniknąć dodatkowego query'a.
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const reminderRows: SalesReminderRow[] = deals
    .filter((d) => d.reminderAt !== null)
    .sort((a, b) => (a.reminderAt!.getTime() - b.reminderAt!.getTime()))
    .map((d) => {
      const personName = [d.contact?.firstName, d.contact?.lastName]
        .filter(Boolean)
        .join(" ");
      const contactLabel = d.contact
        ? d.contact.companyName ??
          (personName !== "" ? personName : null)
        : null;
      const stage = stageById.get(d.stageId);
      return {
        dealId: d.id,
        title: d.title,
        reminderAt: d.reminderAt!.toISOString(),
        ownerName: d.owner?.name ?? null,
        contactLabel,
        stageName: stage?.name ?? "—",
        stageColor: stage?.colorHex ?? "#94A3B8",
        sent: d.reminderSentAt !== null,
        note: d.reminderNote,
      };
    });

  // py-16 zamiast py-14 żeby wyrównać do AppShell ("inne moduły systemu").
  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-16">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-5 md:gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Plan sprzedaży</span>
            <h1 className="font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
              Pipeline
            </h1>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
              <span>
                {totalCount} {totalCount === 1 ? "deal" : "deal'i"}
              </span>
              {[...totalByCurrency.entries()].map(([cur, sum]) => (
                <span key={cur}>
                  Suma: {new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(sum)} {cur}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManageStages && (
              <StageManagerDialog
                workspaceId={workspaceId}
                initialStages={stages.map((s) => ({
                  id: s.id,
                  name: s.name,
                  colorHex: s.colorHex,
                  closedKind:
                    s.closedKind === "won" || s.closedKind === "lost"
                      ? s.closedKind
                      : null,
                  dealCount: s._count.deals,
                }))}
              />
            )}
            {canCreate && (
              <Link
                href={`/w/${workspaceId}/sales/new`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-gradient px-3 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90"
              >
                <Plus size={13} /> Nowy deal
              </Link>
            )}
          </div>
        </div>

        {stagesProp.length === 0 ? (
          <p className="rounded-md border border-border bg-card px-4 py-12 text-center text-[0.88rem] text-muted-foreground">
            Brak etapów — odśwież stronę, defaultowe etapy zostały właśnie utworzone.
          </p>
        ) : (
          <>
            <SalesRemindersTile workspaceId={workspaceId} rows={reminderRows} />
            <SalesPipeline
              workspaceId={workspaceId}
              stages={stagesProp}
              initialDeals={dealsProp}
            />
          </>
        )}
      </div>
    </main>
  );
}
