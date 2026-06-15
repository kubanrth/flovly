import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { EditableWorkspaceName } from "@/components/workspaces/editable-workspace-name";
import { WorkspaceTabs } from "@/components/workspaces/workspace-tabs";

export default async function WorkspaceLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
  });
  if (!workspace) notFound();

  const canEditSettings = can(ctx.role, "workspace.updateSettings");

  return (
    <>
      {/* F12-K47: mobile shell — kompaktowy padding + hide opisu + horizontal-
          scroll nav. Desktop bez zmian. */}
      <header className="flex flex-col gap-3 border-b border-border px-4 pb-4 pt-5 md:flex-row md:items-end md:justify-between md:gap-4 md:px-14 md:pb-6 md:pt-8">
        <div className="flex flex-col gap-1.5 md:gap-2">
          <span className="eyebrow">Przestrzeń · /{workspace.slug}</span>
          {/* F12-K61: inline edit — klik w h1, Enter zapisuje (admin only). */}
          <h1 className="font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.025em] text-foreground md:text-[2rem]">
            <EditableWorkspaceName
              workspaceId={workspace.id}
              name={workspace.name}
              canEdit={canEditSettings}
            />
          </h1>
          {workspace.description && (
            <p className="max-w-[64ch] text-[0.88rem] leading-[1.5] text-muted-foreground max-md:line-clamp-2 md:text-[0.95rem] md:leading-[1.55]">
              {workspace.description}
            </p>
          )}
        </div>

        <WorkspaceTabs
          workspaceId={workspace.id}
          canEditSettings={canEditSettings}
          roleLabel={ctx.role.toLowerCase()}
        />
      </header>

      <main className="flex-1 px-4 py-5 md:px-14 md:py-10">{children}</main>
      {modal}
    </>
  );
}
