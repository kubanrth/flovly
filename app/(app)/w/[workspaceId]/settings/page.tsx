import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import {
  DeleteWorkspaceForm,
  UpdateWorkspaceForm,
} from "@/components/workspaces/workspace-settings-forms";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  if (!can(ctx.role, "workspace.updateSettings")) notFound();

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
  });
  if (!workspace) notFound();

  const canDelete = can(ctx.role, "workspace.delete");

  return (
    <div className="flex flex-col gap-8 md:gap-12">
      <WorkspaceHeader workspace={workspace} canEditSettings={can(ctx.role, "workspace.updateSettings")} />
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow">Ustawienia ogólne</span>
          <h2 className="font-display text-[1.3rem] leading-[1.15] tracking-[-0.02em] md:text-[1.6rem]">
            Podstawowe informacje
          </h2>
          <p className="text-[0.88rem] leading-[1.5] text-muted-foreground md:text-[0.92rem] md:leading-[1.55]">
            Zmiany są widoczne dla wszystkich członków przestrzeni.
          </p>
        </div>
        <UpdateWorkspaceForm
          workspaceId={workspace.id}
          initialName={workspace.name}
          initialDescription={workspace.description}
        />
      </section>

      {canDelete && (
        <section className="flex flex-col gap-5 border-t border-border pt-8 md:pt-10">
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow text-destructive">Strefa niebezpieczna</span>
            <h2 className="font-display text-[1.15rem] leading-[1.15] tracking-[-0.02em] md:text-[1.3rem]">
              Usuń przestrzeń roboczą
            </h2>
          </div>
          <DeleteWorkspaceForm
            workspaceId={workspace.id}
            workspaceName={workspace.name}
          />
        </section>
      )}
    </div>
  );
}
