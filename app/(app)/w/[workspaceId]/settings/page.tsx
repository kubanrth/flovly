import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { Forbidden } from "@/components/errors/forbidden";
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

  // AK187: rola bez uprawnień dostaje 403, nie mylące 404. Serwerowy guard
  // w `updateWorkspaceAction`/`deleteWorkspaceAction` zostaje — to tylko UI.
  if (!can(ctx.role, "workspace.updateSettings")) {
    return <Forbidden description="Ustawienia przestrzeni może zmieniać tylko administrator." backHref={`/w/${workspaceId}`} backLabel="Wróć do przestrzeni" />;
  }

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
  });
  if (!workspace) notFound();

  const canDelete = can(ctx.role, "workspace.delete");

  return (
    <div className="flex flex-col gap-4">
      <WorkspaceHeader workspace={workspace} canEditSettings />

      <section className="flex flex-col gap-2">
        <span className="eyebrow">Ustawienia ogólne</span>
        <p className="text-xs text-fg-2">Zmiany są widoczne dla wszystkich członków przestrzeni.</p>
        <UpdateWorkspaceForm
          workspaceId={workspace.id}
          initialName={workspace.name}
          initialDescription={workspace.description}
        />
      </section>

      {canDelete && (
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <span className="eyebrow text-danger-text">Strefa niebezpieczna</span>
          <DeleteWorkspaceForm workspaceId={workspace.id} workspaceName={workspace.name} />
        </section>
      )}
    </div>
  );
}
