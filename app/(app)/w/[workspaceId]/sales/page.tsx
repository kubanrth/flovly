import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { ensureDefaultStages } from "@/app/(app)/w/[workspaceId]/sales/actions";
import { SalesScreen, type PipelineDeal, type PipelineStage } from "@/components/sales/sales-screen";
import { StageManagerDialog } from "@/components/sales/stage-manager-dialog";

export default async function SalesPipelinePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  // Pierwsze wejście zasiewa domyślne etapy (idempotentne).
  await ensureDefaultStages(workspaceId);

  const [stages, deals] = await Promise.all([
    db.dealStage.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { order: "asc" },
      // Licznik zasila blokadę „nie skasujesz etapu z dealami" w dialogu etapów.
      include: { _count: { select: { deals: { where: { deletedAt: null } } } } },
    }),
    db.deal.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: [{ stageId: "asc" }, { rowOrder: "asc" }],
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
  ]);

  const stagesProp: PipelineStage[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    colorHex: s.colorHex,
    order: s.order,
    closedKind: s.closedKind === "won" || s.closedKind === "lost" ? s.closedKind : null,
  }));

  const dealsProp: PipelineDeal[] = deals.map((d) => {
    const person = [d.contact?.firstName, d.contact?.lastName].filter(Boolean).join(" ");
    return {
      id: d.id,
      stageId: d.stageId,
      rowOrder: d.rowOrder,
      title: d.title,
      valueAmount: d.valueAmount,
      valueCurrency: d.valueCurrency,
      expectedCloseAt: d.expectedCloseAt?.toISOString() ?? null,
      // Brak kolumny `closedAt` w schemacie (D7) — kafel „Wygrane Q<n>" liczy
      // po planowanej dacie zamknięcia, a gdy jej nie ma, po ostatniej zmianie.
      closedAt: (d.expectedCloseAt ?? d.updatedAt).toISOString(),
      reminderAt: d.reminderAt?.toISOString() ?? null,
      reminderNote: d.reminderNote,
      contact: d.contact
        ? { id: d.contact.id, name: d.contact.companyName ?? (person || "—") }
        : null,
      owner: d.owner
        ? { id: d.owner.id, name: d.owner.name ?? d.owner.email, avatarUrl: d.owner.avatarUrl }
        : null,
    };
  });

  return (
    <SalesScreen
      workspaceId={workspaceId}
      stages={stagesProp}
      initialDeals={dealsProp}
      canCreate={can(ctx.role, "deal.create")}
      stageManager={
        can(ctx.role, "dealStage.manage") ? (
          <StageManagerDialog
            workspaceId={workspaceId}
            initialStages={stages.map((s) => ({
              id: s.id,
              name: s.name,
              colorHex: s.colorHex,
              closedKind: s.closedKind === "won" || s.closedKind === "lost" ? s.closedKind : null,
              dealCount: s._count.deals,
            }))}
          />
        ) : null
      }
    />
  );
}
