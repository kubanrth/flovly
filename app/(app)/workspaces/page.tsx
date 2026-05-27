import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { WorkspacesLayoutToggle } from "@/components/workspaces/workspaces-layout-toggle";
import {
  SortableWorkspacesGrid,
  SortableWorkspacesList,
  type WorkspaceRow,
} from "@/components/workspaces/sortable-workspaces";
import { workspacePl } from "@/lib/pluralize";
import { AppShell } from "@/components/layout/app-shell";

export default async function WorkspacesPage() {
  const session = await auth();
  const user = session!.user;

  // Honour user-set drag-and-drop order; fall back to createdAt for fresh rows.
  const memberships = await db.workspaceMembership.findMany({
    where: { userId: user.id, workspace: { deletedAt: null } },
    include: {
      workspace: {
        include: {
          _count: { select: { boards: { where: { deletedAt: null } } } },
        },
      },
    },
    orderBy: [
      { workspace: { order: "asc" } },
      { workspace: { createdAt: "asc" } },
    ],
  });

  const rows: WorkspaceRow[] = memberships.map(({ workspace, role }) => ({
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    description: workspace.description,
    role,
    boardCount: workspace._count.boards,
  }));

  return (
    <AppShell>
      <div className="mb-10 flex flex-col gap-3">
        <span className="eyebrow">Twoje przestrzenie</span>
        <h1 className="font-display text-[2.4rem] font-bold leading-[1.05] tracking-[-0.03em]">
          Cześć, {user.name?.split(" ")[0] ?? "kolego"}.
        </h1>
        <p className="max-w-[52ch] text-[0.98rem] leading-[1.6] text-muted-foreground">
          Masz {memberships.length} {workspacePl(memberships.length)}. Wybierz
          jedną, żeby kontynuować, albo utwórz nową. Złap za uchwyt po lewej i
          przeciągnij żeby zmienić kolejność.
        </p>
      </div>

      <WorkspacesLayoutToggle
        grid={
          <div className="flex flex-col gap-5">
            <SortableWorkspacesGrid rows={rows} />
            <CreateWorkspaceDialog />
          </div>
        }
        list={
          <div className="flex flex-col gap-4">
            <SortableWorkspacesList rows={rows} />
            <div className="grid max-w-md">
              <CreateWorkspaceDialog />
            </div>
          </div>
        }
      />
    </AppShell>
  );
}
