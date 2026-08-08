import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { SubscriptionsTable } from "@/components/subscriptions/subscriptions-table";

// F12-K140: moduł zarządzania subskrypcjami — "Excel, ale ładnie narysowany".
// Tabela aktywnych subskrypcji firmy z inline edycją kwoty + cyklu
// (miesięczny/roczny) i podsumowaniem na dole.
export default async function SubscriptionsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  await requireWorkspaceMembership(workspaceId);

  const rows = await db.subscription.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      url: true,
      amountCents: true,
      cycle: true,
      notes: true,
    },
  });

  return (
    <SubscriptionsTable
      workspaceId={workspaceId}
      rows={rows.map((r) => ({
        id: r.id,
        name: r.name,
        url: r.url,
        amountCents: r.amountCents,
        cycle: r.cycle,
        notes: r.notes,
      }))}
    />
  );
}
