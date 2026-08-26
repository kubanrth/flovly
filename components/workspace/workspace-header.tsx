import { EditableWorkspaceName } from "@/components/workspaces/editable-workspace-name";
import { WorkspaceTabs } from "@/components/workspaces/workspace-tabs";

// Workspace-level header (name + Przegląd/Członkowie/Ustawienia tabs).
// Rendered by the workspace overview/members/settings pages — NOT by the
// layout, so board pages (which have their own header) don't get it.
export function WorkspaceHeader({
  workspace,
  canEditSettings,
}: {
  workspace: { id: string; name: string; slug: string; description?: string | null };
  canEditSettings: boolean;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between md:gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="eyebrow">Przestrzeń · /{workspace.slug}</span>
        <h1 className="text-xl font-semibold tracking-[-0.3px]">
          <EditableWorkspaceName workspaceId={workspace.id} name={workspace.name} canEdit={canEditSettings} />
        </h1>
        {workspace.description && (
          <p className="max-w-[64ch] text-sm text-muted-foreground max-md:line-clamp-2">{workspace.description}</p>
        )}
      </div>
      <WorkspaceTabs workspaceId={workspace.id} canEditSettings={canEditSettings} />
    </header>
  );
}
