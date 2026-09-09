import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { parseDetails } from "@/components/contracts/contracts-model";
import { ContractsTool } from "@/components/contracts/contracts-tool";

// F13 „Umowy" — kazdy czlonek przestrzeni widzi wszystkie umowy; tworzenie,
// edycja i kasowanie wymagaja `contract.manage` (ADMIN, MEMBER).
export default async function ContractsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);
  const rows = await db.contract.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, details: true, createdAt: true, updatedAt: true,
      creator: { select: { id: true, name: true, email: true } },
      files: { where: { deletedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true, filename: true, sizeBytes: true } },
    },
  });
  return (
    <ContractsTool
      workspaceId={workspaceId}
      canManage={can(ctx.role, "contract.manage")}
      contracts={rows.map((c) => ({
        id: c.id, title: c.title, details: parseDetails(c.details),
        createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
        creator: c.creator, files: c.files,
      }))}
    />
  );
}
